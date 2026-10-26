from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models.product import Product
from ..schemas.product import ProductCreate, ProductUpdate

def compute_stock_status(stock: int, reorder: int, safety: int) -> str:
    if stock <= safety:
        return "Critical"
    elif stock <= reorder:
        return "Low Stock"
    elif stock > (reorder * 3.5):
        return "Overstocked"
    return "Optimal"

class ProductService:
    @staticmethod
    def _resolve_product_recommendation(p: Product, min_margin_pct: Optional[float] = None) -> dict:
        from .pricing_service import PricingService

        cost_p = round(p.cost_price, 2)
        current_p = round(p.current_price, 2)

        # 1. Determine safe minimum floor
        if min_margin_pct is not None:
            try:
                m = float(min_margin_pct)
            except (TypeError, ValueError):
                raise ValueError(f"Minimum margin percentage must be a valid number: {min_margin_pct}")
            if m < 0.0 or m >= 100.0:
                raise ValueError(f"Minimum margin percentage must be >= 0.0 and < 100.0: {m}%")
            margin_floor = PricingService.calculate_margin_floor(cost_p, m)
            effective_floor = max(cost_p, margin_floor)
        else:
            # If catalog endpoint cannot access guardrail configuration:
            # Do not silently hardcode 25% or invent new configuration source.
            # Wholesale unit cost floor is the fundamental safe floor.
            effective_floor = cost_p

        # 2. Inspect recommendation history and active recommendations
        recs = p.pricing_recommendations or []
        pending_recs = [r for r in recs if r.status == "Pending Approval"]
        approved_recs = [r for r in recs if r.status == "Approved"]

        # Check for historical below-cost overrides in pricing_decisions or approved_recs
        decisions = p.pricing_decisions or []
        override_decision = next(
            (d for d in decisions if d.decision in ("OVERRIDDEN_BELOW_COST", "OVERRIDDEN")),
            None
        )
        below_cost_approved = next(
            (r for r in approved_recs if r.recommended_price < cost_p or (r.reason and "below-cost override" in r.reason.lower())),
            None
        )

        has_override = bool(override_decision or below_cost_approved)
        override_price = None
        override_reason = None
        if override_decision:
            override_price = override_decision.approved_price
        elif below_cost_approved:
            override_price = below_cost_approved.recommended_price

        if below_cost_approved and below_cost_approved.reason:
            override_reason = below_cost_approved.reason

        # 3. Resolve recommended_price
        has_active = len(pending_recs) > 0
        if has_active:
            active_rec = pending_recs[0]
            rec_val = active_rec.recommended_price
            if rec_val >= effective_floor:
                final_rec = round(rec_val, 2)
            else:
                # Active recommendation violates floor: elevate to safe floor
                final_rec = effective_floor
        else:
            # No active pending recommendation.
            # Historical approved prices (including stale overrides like ELC-8812's ₹500)
            # must NOT be presented as active safe recommendations.
            # If current shelf price meets or exceeds the effective floor, current price is safe.
            if current_p >= effective_floor:
                final_rec = current_p
            else:
                final_rec = effective_floor

        return {
            "recommended_price": final_rec,
            "has_active_recommendation": has_active,
            "has_historical_override": has_override,
            "historical_override_price": override_price,
            "override_reason": override_reason
        }

    @staticmethod
    def _build_product_dict(p: Product, min_margin_pct: Optional[float] = None) -> dict:
        st = compute_stock_status(p.stock_quantity, p.reorder_level, p.safety_stock)
        rec_info = ProductService._resolve_product_recommendation(p, min_margin_pct=min_margin_pct)

        return {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "current_price": p.current_price,
            "cost_price": p.cost_price,
            "competitor_price": p.competitor_price,
            "stock_quantity": p.stock_quantity,
            "reorder_level": p.reorder_level,
            "safety_stock": p.safety_stock,
            "supplier": p.supplier,
            "rating": p.rating,
            "elasticity": p.elasticity,
            "predicted_demand": p.predicted_demand,
            "dynamic_pricing": bool(p.dynamic_pricing if p.dynamic_pricing is not None else True),
            "status": st,
            "recommended_price": rec_info["recommended_price"],
            "has_active_recommendation": rec_info["has_active_recommendation"],
            "has_historical_override": rec_info["has_historical_override"],
            "historical_override_price": rec_info["historical_override_price"],
            "override_reason": rec_info["override_reason"],
            "created_at": p.created_at,
            "updated_at": p.updated_at
        }

    @staticmethod
    def get_products(
        db: Session,
        search: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        min_margin_pct: Optional[float] = None
    ) -> List[dict]:
        query = db.query(Product)

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(or_(Product.name.ilike(s), Product.sku.ilike(s), Product.category.ilike(s)))

        if category and category.lower() != "all":
            query = query.filter(Product.category == category)

        products = query.order_by(Product.name).all()
        results = []

        for p in products:
            st = compute_stock_status(p.stock_quantity, p.reorder_level, p.safety_stock)
            if status and status.lower() != "all":
                if status.lower() in ("in stock", "optimal"):
                    if st.lower() not in ("in stock", "optimal"):
                        continue
                elif st.lower() != status.lower():
                    continue

            results.append(ProductService._build_product_dict(p, min_margin_pct=min_margin_pct))

        return results

    @staticmethod
    def get_product_by_sku(db: Session, sku: str, min_margin_pct: Optional[float] = None) -> Optional[dict]:
        p = db.query(Product).filter(or_(Product.sku == sku, Product.id == sku)).first()
        if not p:
            return None
        return ProductService._build_product_dict(p, min_margin_pct=min_margin_pct)

    @staticmethod
    def create_product(db: Session, data: ProductCreate) -> dict:
        import time
        pid = f"prod-{int(time.time()) % 10000:04d}"
        product = Product(
            id=pid,
            sku=data.sku,
            name=data.name,
            category=data.category,
            current_price=data.current_price,
            cost_price=data.cost_price,
            competitor_price=data.competitor_price or round(data.current_price * 1.05, 2),
            stock_quantity=data.stock_quantity,
            reorder_level=data.reorder_level,
            safety_stock=data.safety_stock,
            supplier=data.supplier or "Global Direct Vendor Ltd.",
            rating=data.rating or 4.5,
            elasticity=data.elasticity or -1.25,
            predicted_demand=data.predicted_demand or 100,
            dynamic_pricing=data.dynamic_pricing if data.dynamic_pricing is not None else True
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return ProductService.get_product_by_sku(db, product.sku)

    @staticmethod
    def update_product(db: Session, sku: str, data: ProductUpdate) -> Optional[dict]:
        product = db.query(Product).filter(or_(Product.sku == sku, Product.id == sku)).first()
        if not product:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if hasattr(product, key) and value is not None:
                setattr(product, key, value)

        db.commit()
        db.refresh(product)
        return ProductService.get_product_by_sku(db, product.sku)

    @staticmethod
    def delete_product(db: Session, sku: str) -> bool:
        product = db.query(Product).filter(or_(Product.sku == sku, Product.id == sku)).first()
        if not product:
            return False
        db.delete(product)
        db.commit()
        return True

    @staticmethod
    def batch_delete_products(db: Session, skus_or_ids: List[str]) -> List[str]:
        deleted = []
        for item in skus_or_ids:
            product = db.query(Product).filter(or_(Product.sku == item, Product.id == item)).first()
            if product:
                deleted.append(product.sku)
                db.delete(product)
        if deleted:
            db.commit()
        return deleted

    @staticmethod
    def batch_apply_ai_prices(db: Session, skus_or_ids: List[str]) -> List[dict]:
        from .pricing_service import PricingService
        updated = []
        for item in skus_or_ids:
            product = db.query(Product).filter(or_(Product.sku == item, Product.id == item)).first()
            if product:
                rec_data = PricingService.calculate_product_recommendation(product=product)
                rec_price = rec_data.get("recommended_price") or round(product.current_price * 1.05, 2)
                try:
                    res = PricingService.approve_recommendation(
                        db=db,
                        sku_or_id=product.sku,
                        approved_price=rec_price,
                        user="Batch AI Process",
                        allow_below_cost=False
                    )
                    if res and res.get("product"):
                        updated.append(res["product"])
                except Exception as e:
                    print(f"Batch AI price failed for {product.sku}: {e}")
        return updated
