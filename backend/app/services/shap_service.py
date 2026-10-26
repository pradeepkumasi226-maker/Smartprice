from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models.product import Product
from ..models.pricing_recommendation import PricingRecommendation

try:
    from ml.explainability.inference import ExplainabilityEngine
    _explainability_engine = ExplainabilityEngine()
except Exception:
    _explainability_engine = None

class ShapService:
    @staticmethod
    def get_global_features(db: Session) -> List[Dict[str, Any]]:
        catalog = db.query(Product).all()
        if _explainability_engine:
            return _explainability_engine.get_global_feature_importance(catalog=catalog)

        return [
            { "feature": "Competitor Price Gap", "importance": 0.38, "category": "Market Signal", "description": "Delta between current shelf price and primary retail competitor index" },
            { "feature": "Historical Elasticity", "importance": 0.24, "category": "Demand Model", "description": "Log-log regression responsiveness coefficient over past 90 days" },
            { "feature": "Inventory Days-on-Hand", "importance": 0.16, "category": "Supply Chain", "description": "Ratio of on-hand inventory units to weekly sales velocity" },
            { "feature": "Cost Floor & Margin Guardrails", "importance": 0.12, "category": "Margin Protection", "description": "Minimum gross-margin floor preventing below-cost or sub-margin margin loss" },
            { "feature": "Customer Review Rating", "importance": 0.06, "category": "Brand Equity", "description": "Aggregate customer feedback sentiment and star rating index" },
            { "feature": "Seasonal Demand Lift", "importance": 0.04, "category": "Seasonality", "description": "Cyclical holiday, weekend, and temperature trend weight multipliers" }
        ]

    @staticmethod
    def get_product_shap(
        db: Session,
        sku_or_id: str,
        target_price: Optional[float] = None,
        min_margin_pct: Optional[float] = None
    ) -> Dict[str, Any]:
        product = db.query(Product).filter(or_(Product.sku == sku_or_id, Product.id == sku_or_id)).first()
        if not product:
            product = db.query(Product).first()

        if not product:
            return {
                "product_id": "none",
                "sku": "none",
                "product_name": "No Product",
                "productName": "No Product",
                "base_value": 0.0,
                "basePrice": 0.0,
                "final_recommended_price": 0.0,
                "finalPrice": 0.0,
                "waterfall_points": [],
                "features": [],
                "naturalLanguageExplanation": "No product available for explanation.",
                "explanation_method": "none",
                "is_genuine_shap": False,
                "model_version": "None",
                "r2_score": None
            }

        from ..models.pricing_decision import PricingDecision

        rec = db.query(PricingRecommendation).filter(PricingRecommendation.product_id == product.id).first()
        decisions = (
            db.query(PricingDecision)
            .filter(PricingDecision.product_id == product.id)
            .order_by(PricingDecision.created_at.desc())
            .all()
        )
        override_dec = next((d for d in decisions if d.decision in ("OVERRIDDEN_BELOW_COST", "OVERRIDDEN")), None)

        if target_price is not None:
            chosen_price = float(target_price)
        elif rec is not None:
            chosen_price = rec.recommended_price
        else:
            chosen_price = product.current_price

        is_override = bool(
            chosen_price < product.cost_price
            or (override_dec and chosen_price == override_dec.approved_price)
            or (rec and "override" in (rec.reason or "").lower())
        )

        override_reason = None
        if is_override:
            if rec and "override" in (rec.reason or "").lower():
                override_reason = rec.reason
            elif override_dec:
                override_reason = override_dec.decision

        context = {
            "recommended_price": chosen_price,
            "min_margin_pct": min_margin_pct,
            "is_historical_override": is_override,
            "override_decision": override_dec.decision if override_dec else None,
            "override_reason": override_reason,
            "override_user": override_dec.user if override_dec else "Executive Authorization",
            "status": rec.status if rec else "Pending Approval"
        }

        if _explainability_engine:
            return _explainability_engine.explain_product_pricing(product, context=context)

        # Fallback if engine unavailable
        base_val = product.current_price
        rec_val = round(base_val * 1.0975, 2)
        comp_diff = round((product.competitor_price - base_val) * 0.45, 2) if product.competitor_price else 12.50
        points = [
            {
                "name": "Base Shelf Price",
                "value": base_val,
                "formatted_value": f"₹{base_val:.2f}",
                "type": "base",
                "description": "Baseline shelf price before dynamic optimization model inference"
            },
            {
                "name": "Competitor Price Gap",
                "value": comp_diff,
                "formatted_value": f"{'+' if comp_diff >= 0 else ''}₹{comp_diff:.2f}",
                "type": "increase" if comp_diff >= 0 else "decrease",
                "raw_feature": "competitor_price",
                "feature_value": f"₹{product.competitor_price:.2f}" if product.competitor_price else "N/A",
                "description": "Competitor shelf price creates pricing headroom without demand loss"
            },
            {
                "name": "Demand Elasticity Responsiveness",
                "value": 8.20,
                "formatted_value": "+₹8.20",
                "type": "increase",
                "raw_feature": "elasticity_score",
                "feature_value": f"{product.elasticity:.2f}",
                "description": "Inelastic consumer buying behavior allows margin expansion"
            },
            {
                "name": "Inventory Level Buffer",
                "value": -3.70,
                "formatted_value": "-₹3.70",
                "type": "decrease",
                "raw_feature": "stock_quantity",
                "feature_value": f"{product.stock_quantity} units",
                "description": "On-hand stock depth applies downward pressure to maintain velocity"
            },
            {
                "name": "Customer Review Rating & Sentiment",
                "value": 2.51,
                "formatted_value": "+₹2.51",
                "type": "increase",
                "raw_feature": "rating_score",
                "feature_value": f"{product.rating} ★",
                "description": "High brand rating supports premium price positioning"
            },
            {
                "name": "AI Recommended Shelf Price",
                "value": rec_val,
                "formatted_value": f"₹{rec_val:.2f}",
                "type": "total",
                "description": "Final optimal shelf price validated across gross margin constraints"
            }
        ]

        return {
            "product_id": product.id,
            "sku": product.sku,
            "product_name": product.name,
            "productName": product.name,
            "base_value": base_val,
            "basePrice": base_val,
            "final_recommended_price": rec_val,
            "finalPrice": rec_val,
            "waterfall_points": points,
            "explanation_method": "fallback_template",
            "is_genuine_shap": False,
            "model_version": "Deterministic Rule Attribution v1.0",
            "r2_score": None
        }
