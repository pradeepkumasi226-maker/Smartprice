import time
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models.product import Product
from ..models.pricing_recommendation import PricingRecommendation
from ..models.pricing_decision import PricingDecision
from .product_service import ProductService

try:
    from ml.optimization.inference import ElasticityInferenceBridge
    _elasticity_bridge = ElasticityInferenceBridge()
except Exception:
    _elasticity_bridge = None

class PricingService:
    @staticmethod
    def calculate_product_recommendation(
        product: Product,
        guardrails: Optional[Dict[str, Any]] = None,
        stored_status: Optional[str] = None,
        stored_rec_price: Optional[float] = None,
        stored_reason: Optional[str] = None,
        force_recalculate: bool = False
    ) -> Dict[str, Any]:
        guardrails = guardrails or {}
        min_margin_pct = float(guardrails.get("min_margin_pct", 5.0))
        max_price_change_pct = float(guardrails.get("max_price_change_pct", 30.0))
        allow_below_cost = bool(guardrails.get("allow_below_cost", False))

        current_p = round(product.current_price, 2)
        cost_p = round(product.cost_price, 2)
        comp_p = round(product.competitor_price or 0.0, 2)
        base_d = product.predicted_demand or 100

        # Resolve elasticity via ML inference bridge if reliable, else safe catalog fallback
        catalog_elasticity = product.elasticity if product.elasticity is not None else -1.25
        elasticity = catalog_elasticity
        elasticity_source = "fallback_catalog"
        elasticity_reliable = False
        elasticity_status = "CATALOG_FALLBACK"
        elasticity_explanation = "Using catalog empirical elasticity fallback."

        if _elasticity_bridge and _elasticity_bridge.is_available():
            try:
                el_info = _elasticity_bridge.get_sku_elasticity(product.sku, catalog_fallback=catalog_elasticity)
                elasticity = float(el_info.get("elasticity", catalog_elasticity))
                elasticity_source = el_info.get("source", "fallback_catalog")
                elasticity_reliable = bool(el_info.get("is_reliable", False))
                elasticity_status = str(el_info.get("reliability_status", "CATALOG_FALLBACK"))
                elasticity_explanation = str(el_info.get("explanation", ""))
            except Exception:
                pass

        stock_qty = product.stock_quantity if product.stock_quantity is not None else 0
        reorder_lvl = product.reorder_level or 30
        safety_stk = product.safety_stock or 15

        # 1. Guardrail boundaries
        cost_floor = cost_p
        min_allowed_price = cost_p if not allow_below_cost else 0.01
        min_guardrail = max(min_allowed_price, round(cost_p * (1 + min_margin_pct / 100), 2))
        max_guardrail = round(current_p * (1 + max_price_change_pct / 100), 2)

        # 2. Inventory Scarcity / Surplus analysis
        if stock_qty <= safety_stk:
            stock_status = "Critical"
            inv_factor_text = f"Critical inventory ({stock_qty}u <= safety {safety_stk}u); price scarcity protection active."
            scarcity_pressure = 0.04
        elif stock_qty <= reorder_lvl:
            stock_status = "Low Stock"
            inv_factor_text = f"Low inventory ({stock_qty}u <= reorder {reorder_lvl}u); preserving margin and preventing stockout."
            scarcity_pressure = 0.02
        elif stock_qty > (reorder_lvl * 2.5):
            stock_status = "Overstocked"
            inv_factor_text = f"Surplus stock ({stock_qty}u > 2.5x reorder); promo shift incentivized for turnover."
            scarcity_pressure = -0.04
        else:
            stock_status = "Optimal"
            inv_factor_text = f"Healthy inventory depth ({stock_qty} units); balanced elasticity optimization."
            scarcity_pressure = 0.0

        # 3. Target price determination
        if stored_rec_price is not None and not force_recalculate:
            optimal_p = round(stored_rec_price, 2)
            # Ensure hard cost floor rule unless permitted
            if not allow_below_cost and optimal_p < cost_floor:
                optimal_p = min_guardrail
            # Calculate optimal demand for this stored price
            p_pct_init = (optimal_p - current_p) / current_p if current_p > 0 else 0
            optimal_d = max(10, round(base_d * (1 + (elasticity * p_pct_init))))
        else:
            # Grid search for profit-maximizing price within guardrails
            best_p = current_p
            best_profit = (current_p - cost_p) * base_d
            best_d = base_d

            min_step = -int(min(max_price_change_pct, 40))
            max_step = int(min(max_price_change_pct, 40)) + 1

            for step in range(min_step, max_step):
                candidate_p = round(current_p * (1 + (step * 0.01)), 2)

                # Guardrails check
                if not allow_below_cost and candidate_p < cost_floor:
                    continue
                if candidate_p < min_guardrail or candidate_p > max_guardrail:
                    continue

                p_pct = (candidate_p - current_p) / current_p if current_p > 0 else 0
                comp_adj = 0.0
                if comp_p > 0:
                    if candidate_p > comp_p * 1.05 and elasticity < -1.0:
                        comp_adj = -0.04
                    elif candidate_p <= comp_p and elasticity < -1.0:
                        comp_adj = 0.03

                d_mult = 1.0 + (elasticity * p_pct) + scarcity_pressure + comp_adj
                d = max(10, round(base_d * d_mult))
                profit = (candidate_p - cost_p) * d

                if profit > best_profit:
                    best_profit = profit
                    best_p = candidate_p
                    best_d = d

            optimal_p = best_p
            optimal_d = best_d

        # 4. Deltas & Percentage changes
        delta = round(optimal_p - current_p, 2)
        if delta > 0:
            price_delta = f"+₹{delta:.2f}"
        elif delta < 0:
            price_delta = f"-₹{abs(delta):.2f}"
        else:
            price_delta = "₹0.00"

        pct_change_val = round((delta / current_p * 100), 1) if current_p > 0 else 0.0
        price_change_pct = f"{'+' if pct_change_val >= 0 else ''}{pct_change_val:.1f}%"

        # 5. Baseline vs Expected Financials
        cur_rev = round(current_p * base_d, 2)
        cur_profit = round((current_p - cost_p) * base_d, 2)
        cur_margin_pct = round(((current_p - cost_p) / current_p * 100), 1) if current_p > 0 else 0.0

        status = stored_status or "Pending Approval"
        is_stale = False
        stale_reason = None

        if status == "Pending Approval" and delta == 0:
            is_stale = True
            stale_reason = f"Product is already priced at ₹{current_p:.2f}. No price delta remaining."
        elif status == "Pending Approval" and optimal_p < cost_floor and not allow_below_cost:
            is_stale = True
            stale_reason = f"Recommended price ₹{optimal_p:.2f} violates cost floor of ₹{cost_p:.2f}."

        if status == "Approved" and delta == 0:
            exp_demand = base_d
            exp_rev = round(optimal_p * exp_demand, 2)
            exp_profit = round((optimal_p - cost_p) * exp_demand, 2)
            exp_margin_pct = round(((optimal_p - cost_p) / optimal_p * 100), 1) if optimal_p > 0 else 0.0

            demand_delta = "+0.0%"
            revenue_lift_val = 0.0
            revenue_lift = "+0.0%"
            profit_lift_val = 0.0
            profit_lift = "+0.0%"
            margin_delta = "+0.0%"
        else:
            p_pct = (optimal_p - current_p) / current_p if current_p > 0 else 0
            exp_demand = optimal_d or max(10, round(base_d * (1 + (elasticity * p_pct))))
            exp_rev = round(optimal_p * exp_demand, 2)
            exp_profit = round((optimal_p - cost_p) * exp_demand, 2)
            exp_margin_pct = round(((optimal_p - cost_p) / optimal_p * 100), 1) if optimal_p > 0 else 0.0

            d_diff_pct = ((exp_demand - base_d) / base_d * 100) if base_d > 0 else 0.0
            demand_delta = f"{'+' if d_diff_pct >= 0 else ''}{d_diff_pct:.1f}%"

            revenue_lift_val = round(exp_rev - cur_rev, 2)
            rev_diff_pct = ((exp_rev - cur_rev) / cur_rev * 100) if cur_rev > 0 else 0.0
            revenue_lift = f"{'+' if rev_diff_pct >= 0 else ''}{rev_diff_pct:.1f}%"

            profit_lift_val = round(exp_profit - cur_profit, 2)
            profit_diff_pct = ((exp_profit - cur_profit) / cur_profit * 100) if cur_profit > 0 else 0.0
            profit_lift = f"{'+' if profit_diff_pct >= 0 else ''}{profit_diff_pct:.1f}%"

            m_diff = round(exp_margin_pct - cur_margin_pct, 1)
            margin_delta = f"{'+' if m_diff >= 0 else ''}{m_diff:.1f}%"

        # Guardrail compliance check
        guardrail_passed = (optimal_p >= min_guardrail) and (optimal_p <= max_guardrail) and (allow_below_cost or optimal_p >= cost_floor)
        guardrail_status = "Pass" if guardrail_passed else "Warning"
        guardrail_details = f"Cost floor: ₹{cost_floor:.2f} | Min Guardrail: ₹{min_guardrail:.2f} | Max Guardrail: ₹{max_guardrail:.2f}"

        # Explain why this price is recommended
        if status == "Approved" and delta == 0:
            e_label = "inelastic" if abs(elasticity) < 1.0 else "moderately elastic" if abs(elasticity) <= 1.5 else "highly price-sensitive"
            comp_text = f"Competitor at ₹{comp_p:.2f}." if comp_p > 0 else "No competitor benchmark."
            rationale = f"Approved at target price ₹{current_p:.2f}. Live shelf price aligns with profit-optimal elasticity of {elasticity:.2f} ({e_label}). {inv_factor_text} {comp_text} Cost floor ₹{cost_floor:.2f} protected."
        elif stored_reason and not force_recalculate:
            rationale = stored_reason
        else:
            e_label = "inelastic" if abs(elasticity) < 1.0 else "moderately elastic" if abs(elasticity) <= 1.5 else "highly price-sensitive"
            if delta > 0:
                direction_text = f"Recommends {price_change_pct} price increase (₹{current_p:.2f} ➔ ₹{optimal_p:.2f}) to maximize gross profit."
            elif delta < 0:
                direction_text = f"Recommends {price_change_pct} promotional adjustment (₹{current_p:.2f} ➔ ₹{optimal_p:.2f}) to stimulate demand."
            else:
                direction_text = f"Current price ₹{current_p:.2f} matches optimal margin target."

            comp_text = f"Competitor at ₹{comp_p:.2f}." if comp_p > 0 else "No competitor benchmark."
            rationale = f"{direction_text} Elasticity {elasticity:.2f} ({e_label}). {inv_factor_text} {comp_text} Cost floor ₹{cost_floor:.2f} protected."


        pricing_drivers = {
            "elasticity_score": elasticity,
            "elasticity_label": "Highly Elastic" if abs(elasticity) > 1.5 else "Moderately Elastic" if abs(elasticity) >= 1.0 else "Inelastic",
            "elasticity_source": elasticity_source,
            "elasticity_reliable": elasticity_reliable,
            "elasticity_status": elasticity_status,
            "elasticity_explanation": elasticity_explanation,
            "inventory_stock": stock_qty,
            "inventory_status": stock_status,
            "inventory_factor": inv_factor_text,
            "competitor_price": comp_p,
            "competitor_gap": round(comp_p - current_p, 2) if comp_p > 0 else 0.0,
            "cost_floor": cost_floor,
            "min_guardrail": min_guardrail,
            "max_guardrail": max_guardrail,
            "allow_below_cost": allow_below_cost
        }

        return {
            "id": f"opt-{product.id}",
            "product_id": product.id,
            "sku": product.sku,
            "product_name": product.name,
            "current_price": current_p,
            "recommended_price": optimal_p,
            "cost_price": cost_p,
            "competitor_price": comp_p,
            "price_delta": price_delta,
            "price_delta_val": delta,
            "price_change_pct": price_change_pct,
            "price_change_pct_val": pct_change_val,
            "stock_quantity": stock_qty,
            "reorder_level": reorder_lvl,
            "safety_stock": safety_stk,
            "stock_status": stock_status,
            "cost_floor": cost_floor,
            "min_guardrail": min_guardrail,
            "max_guardrail": max_guardrail,
            "guardrail_status": guardrail_status,
            "guardrail_details": guardrail_details,
            "pricing_drivers": pricing_drivers,
            "baseline_demand": base_d,
            "expected_demand": exp_demand,
            "demand_delta": demand_delta,
            "current_revenue": cur_rev,
            "expected_revenue": exp_rev,
            "revenue_lift_val": revenue_lift_val,
            "revenue_lift": revenue_lift,
            "current_profit": cur_profit,
            "expected_profit": exp_profit,
            "profit_lift_val": profit_lift_val,
            "profit_lift": profit_lift,
            "current_margin": f"{cur_margin_pct:.1f}%",
            "expected_margin": f"{exp_margin_pct:.1f}%",
            "margin_delta": margin_delta,
            "elasticity_score": elasticity,
            "elasticity_label": pricing_drivers["elasticity_label"],
            "elasticity_source": elasticity_source,
            "elasticity_reliable": elasticity_reliable,
            "elasticity_status": elasticity_status,
            "rationale": rationale,
            "status": status,
            "is_stale": is_stale,
            "stale_reason": stale_reason,
            "created_at": product.created_at,
            "updated_at": product.updated_at
        }

    @staticmethod
    def get_recommendations(
        db: Session,
        include_all: bool = False,
        guardrails: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        if not include_all:
            recs = db.query(PricingRecommendation).all()
            results = []
            for r in recs:
                p = r.product
                if not p:
                    continue
                rec_data = PricingService.calculate_product_recommendation(
                    product=p,
                    guardrails=guardrails,
                    stored_status=r.status,
                    stored_rec_price=r.recommended_price,
                    stored_reason=r.reason
                )
                rec_data["id"] = r.id
                rec_data["created_at"] = r.created_at
                rec_data["updated_at"] = r.updated_at
                results.append(rec_data)
            return results

        # include_all=True: Return recommendations for all products in catalog
        products = db.query(Product).order_by(Product.name).all()
        recs_map = {r.product_id: r for r in db.query(PricingRecommendation).all()}
        results = []
        for p in products:
            r = recs_map.get(p.id)
            if r:
                rec_data = PricingService.calculate_product_recommendation(
                    product=p,
                    guardrails=guardrails,
                    stored_status=r.status,
                    stored_rec_price=r.recommended_price,
                    stored_reason=r.reason
                )
                rec_data["id"] = r.id
                rec_data["created_at"] = r.created_at
                rec_data["updated_at"] = r.updated_at
            else:
                rec_data = PricingService.calculate_product_recommendation(
                    product=p,
                    guardrails=guardrails
                )
            results.append(rec_data)
        return results

    @staticmethod
    def generate_all_recommendations(
        db: Session,
        guardrails: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        products = db.query(Product).all()
        results = []
        for p in products:
            rec_data = PricingService.calculate_product_recommendation(
                product=p,
                guardrails=guardrails,
                force_recalculate=True
            )
            rec = db.query(PricingRecommendation).filter(PricingRecommendation.product_id == p.id).first()
            if not rec:
                rec = PricingRecommendation(
                    id=f"opt-{p.id}",
                    product_id=p.id,
                    recommended_price=rec_data["recommended_price"],
                    expected_demand=rec_data["expected_demand"],
                    expected_revenue=rec_data["expected_revenue"],
                    expected_margin=rec_data["expected_margin"],
                    reason=rec_data["rationale"],
                    status="Pending Approval"
                )
                db.add(rec)
            else:
                rec.recommended_price = rec_data["recommended_price"]
                rec.expected_demand = rec_data["expected_demand"]
                rec.expected_revenue = rec_data["expected_revenue"]
                rec.expected_margin = rec_data["expected_margin"]
                rec.reason = rec_data["rationale"]
                rec.status = "Pending Approval"
            results.append(rec_data)
        db.commit()
        return results

    @staticmethod
    def approve_recommendation(
        db: Session,
        sku_or_id: str,
        approved_price: Optional[float] = None,
        user: str = "Retail Pricing Manager",
        allow_below_cost: bool = False,
        override_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        product = db.query(Product).filter(or_(Product.sku == sku_or_id, Product.id == sku_or_id)).first()
        if not product:
            raise ValueError(f"Product '{sku_or_id}' not found.")

        rec = db.query(PricingRecommendation).filter(PricingRecommendation.product_id == product.id).first()
        target_price = approved_price if approved_price is not None else (rec.recommended_price if rec else product.current_price)

        if target_price <= 0:
            raise ValueError("Approved price must be greater than zero.")

        # Guardrail check: Do not allow selling below cost price unless permitted
        is_below_cost = target_price < product.cost_price
        if is_below_cost and not allow_below_cost:
            raise ValueError(
                f"Approved price ₹{target_price:.2f} violates margin guardrail: cannot sell below cost price ₹{product.cost_price:.2f}."
            )

        previous_price = product.current_price
        product.current_price = round(target_price, 2)
        decision_label = "OVERRIDDEN_BELOW_COST" if is_below_cost else "APPROVED"

        if rec:
            rec.status = "Approved"
            rec.recommended_price = round(target_price, 2)
            if is_below_cost:
                reason_note = f" Reason: {override_reason}" if override_reason else ""
                rec.reason = f"Executive below-cost override authorized by {user}. Approved price ₹{target_price:.2f} is below wholesale cost floor ₹{product.cost_price:.2f}.{reason_note}"
            else:
                rec.reason = f"Approved at target price ₹{target_price:.2f}. Live shelf price aligns with profit-optimal margin target. Wholesale cost floor ₹{product.cost_price:.2f} protected."

        # Record in PricingDecision audit table
        decision = PricingDecision(
            id=f"dec-{int(time.time() * 1000)}",
            product_id=product.id,
            previous_price=previous_price,
            approved_price=target_price,
            decision=decision_label,
            user=user
        )
        db.add(decision)
        db.commit()
        db.refresh(product)
        if rec:
            db.refresh(rec)

        return {
            "success": True,
            "product": ProductService.get_product_by_sku(db, product.sku),
            "previous_price": previous_price,
            "approved_price": target_price,
            "status": "Approved",
            "decision": decision_label
        }

    @staticmethod
    def reject_recommendation(
        db: Session,
        sku_or_id: str,
        user: str = "Retail Pricing Manager"
    ) -> Dict[str, Any]:
        product = db.query(Product).filter(or_(Product.sku == sku_or_id, Product.id == sku_or_id)).first()
        if not product:
            raise ValueError(f"Product '{sku_or_id}' not found.")

        rec = db.query(PricingRecommendation).filter(PricingRecommendation.product_id == product.id).first()
        if rec:
            rec.status = "Declined"

        decision = PricingDecision(
            id=f"dec-{int(time.time() * 1000)}",
            product_id=product.id,
            previous_price=product.current_price,
            approved_price=product.current_price,
            decision="REJECTED",
            user=user
        )
        db.add(decision)
        db.commit()
        if rec:
            db.refresh(rec)

        return {
            "success": True,
            "product_id": product.id,
            "sku": product.sku,
            "status": "Declined"
        }

    @staticmethod
    def recalculate_recommendation(
        db: Session,
        sku_or_id: str,
        guardrails: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        product = db.query(Product).filter(or_(Product.sku == sku_or_id, Product.id == sku_or_id)).first()
        if not product:
            raise ValueError(f"Product '{sku_or_id}' not found.")

        rec_data = PricingService.calculate_product_recommendation(
            product=product,
            guardrails=guardrails,
            force_recalculate=True
        )

        rec = db.query(PricingRecommendation).filter(PricingRecommendation.product_id == product.id).first()
        if not rec:
            rec = PricingRecommendation(
                id=f"opt-{product.id}",
                product_id=product.id,
                recommended_price=rec_data["recommended_price"],
                expected_demand=rec_data["expected_demand"],
                expected_revenue=rec_data["expected_revenue"],
                expected_margin=rec_data["expected_margin"],
                reason=rec_data["rationale"],
                status="Pending Approval"
            )
            db.add(rec)
        else:
            rec.recommended_price = rec_data["recommended_price"]
            rec.expected_demand = rec_data["expected_demand"]
            rec.expected_revenue = rec_data["expected_revenue"]
            rec.expected_margin = rec_data["expected_margin"]
            rec.status = "Pending Approval"
            rec.reason = rec_data["rationale"]

        db.commit()
        db.refresh(rec)

        return {
            "success": True,
            "product_id": product.id,
            "sku": product.sku,
            "current_price": rec_data["current_price"],
            "recommended_price": rec_data["recommended_price"],
            "price_delta": rec_data["price_delta"],
            "price_change_pct": rec_data["price_change_pct"],
            "expected_demand": rec_data["expected_demand"],
            "expected_revenue": rec_data["expected_revenue"],
            "expected_margin": rec_data["expected_margin"],
            "status": "Pending Approval",
            "rationale": rec_data["rationale"]
        }

    @staticmethod
    def get_elasticity_curve(db: Session, sku_or_id: str) -> Dict[str, Any]:
        product = db.query(Product).filter(or_(Product.sku == sku_or_id, Product.id == sku_or_id)).first()
        if not product:
            product = db.query(Product).first()

        base_p = product.current_price
        base_c = product.cost_price
        base_d = product.predicted_demand or 100
        catalog_e = product.elasticity if product.elasticity is not None else -1.25
        e = catalog_e
        e_source = "fallback_catalog"
        e_reliable = False
        e_status = "CATALOG_FALLBACK"

        if _elasticity_bridge and _elasticity_bridge.is_available():
            try:
                el_info = _elasticity_bridge.get_sku_elasticity(product.sku, catalog_fallback=catalog_e)
                e = float(el_info.get("elasticity", catalog_e))
                e_source = el_info.get("source", "fallback_catalog")
                e_reliable = bool(el_info.get("is_reliable", False))
                e_status = str(el_info.get("reliability_status", "CATALOG_FALLBACK"))
            except Exception:
                pass

        # Generate points around baseline price (-35% to +35%)
        points = []
        optimal_price = base_p
        max_profit = 0

        for i in range(-7, 8):
            mult = 1 + (i * 0.05)
            p = round(base_p * mult, 2)
            p_delta = (p - base_p) / base_p
            d_delta = e * p_delta
            d = max(10, round(base_d * (1 + d_delta)))
            rev = round(p * d, 2)
            cost = round(base_c * d, 2)
            profit = round(rev - cost, 2)
            margin = f"{((profit / rev) * 100):.1f}%" if rev > 0 else "0%"

            if profit > max_profit:
                max_profit = profit
                optimal_price = p

            points.append({
                "price": p,
                "demand": d,
                "revenue": rev,
                "profit": profit,
                "margin": margin,
                "isOptimal": False
            })

        for pt in points:
            if pt["price"] == optimal_price:
                pt["isOptimal"] = True

        return {
            "product_id": product.id,
            "sku": product.sku,
            "base_price": base_p,
            "optimal_price": optimal_price,
            "elasticity_score": e,
            "elasticity_source": e_source,
            "elasticity_reliable": e_reliable,
            "elasticity_status": e_status,
            "points": points
        }
