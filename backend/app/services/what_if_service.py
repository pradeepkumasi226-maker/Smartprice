import time
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from ..models.product import Product
from ..models.what_if_scenario import WhatIfScenario
from ..schemas.what_if import WhatIfScenarioCreate

class WhatIfService:
    @staticmethod
    def simulate(
        db: Session,
        sku_or_id: Optional[str],
        simulated_price: float,
        competitor_offset: float = 0.0,
        elasticity_multiplier: float = 1.0,
        promo_discount: float = 0.0
    ) -> Dict[str, Any]:
        product = None
        if sku_or_id:
            product = db.query(Product).filter(or_(Product.sku == sku_or_id, Product.id == sku_or_id)).first()
        if not product:
            product = db.query(Product).first()

        current_p = product.current_price
        base_c = product.cost_price
        base_d = product.predicted_demand
        e = product.elasticity * elasticity_multiplier

        # Deterministic Elasticity formula
        price_delta = simulated_price - current_p
        price_percent_delta = (price_delta / current_p) if current_p > 0 else 0

        # Promo discount boosts demand slightly
        promo_boost = (promo_discount / 100) * 0.4
        demand_percent_delta = (e * price_percent_delta) + promo_boost

        simulated_demand = max(10, round(base_d * (1 + demand_percent_delta)))
        demand_delta = simulated_demand - base_d

        simulated_revenue = round(simulated_price * simulated_demand, 2)
        baseline_revenue = round(current_p * base_d, 2)
        revenue_delta = round(simulated_revenue - baseline_revenue, 2)
        revenue_percent_delta = round(((revenue_delta / baseline_revenue) * 100), 1) if baseline_revenue > 0 else 0.0

        simulated_cost = round(base_c * simulated_demand, 2)
        baseline_cost = round(base_c * base_d, 2)

        simulated_profit = round(simulated_revenue - simulated_cost, 2)
        baseline_profit = round(baseline_revenue - baseline_cost, 2)
        profit_delta = round(simulated_profit - baseline_profit, 2)

        sim_margin = f"{((simulated_profit / simulated_revenue) * 100):.1f}%" if simulated_revenue > 0 else "0%"
        base_margin = f"{((baseline_profit / baseline_revenue) * 100):.1f}%" if baseline_revenue > 0 else "0%"

        comp_p = product.competitor_price or round(current_p * 1.05, 2)
        if competitor_offset != 0:
            comp_p = round(comp_p * (1 + (competitor_offset / 100)), 2)

        return {
            "product_id": product.id,
            "sku": product.sku,
            "product_name": product.name,
            "simulated_price": round(simulated_price, 2),
            "baseline_price": current_p,
            "price_delta": round(price_delta, 2),
            "price_percent_delta": round(price_percent_delta * 100, 1),
            "simulated_demand": simulated_demand,
            "baseline_demand": base_d,
            "demand_delta": demand_delta,
            "demand_percent_delta": round(demand_percent_delta * 100, 1),
            "simulated_revenue": simulated_revenue,
            "baseline_revenue": baseline_revenue,
            "revenue_delta": revenue_delta,
            "revenue_percent_delta": revenue_percent_delta,
            "simulated_profit": simulated_profit,
            "baseline_profit": baseline_profit,
            "profit_delta": profit_delta,
            "simulated_margin": sim_margin,
            "baseline_margin": base_margin,
            "competitor_price": comp_p,
            "is_price_higher_than_competitor": simulated_price > comp_p
        }

    @staticmethod
    def get_scenarios(db: Session) -> List[Dict[str, Any]]:
        scenarios = db.query(WhatIfScenario).order_by(desc(WhatIfScenario.created_at)).all()
        results = []
        for s in scenarios:
            p = s.product
            sku = p.sku if p else "N/A"
            pname = p.name if p else s.name
            results.append({
                "id": s.id,
                "product_id": s.product_id,
                "sku": sku,
                "product_name": pname,
                "name": s.name,
                "current_price": s.current_price,
                "simulated_price": s.simulated_price,
                "expected_demand": s.expected_demand,
                "expected_revenue": s.expected_revenue,
                "expected_margin": s.expected_margin,
                "expected_gross_profit": s.expected_gross_profit,
                "status": s.status,
                "created_at": s.created_at,
                "updated_at": s.updated_at
            })
        return results

    @staticmethod
    def create_scenario(db: Session, data: WhatIfScenarioCreate) -> Dict[str, Any]:
        scen_id = f"scen-{int(time.time() * 1000)}"
        product = db.query(Product).filter(or_(Product.id == data.product_id, Product.sku == data.product_id)).first()
        resolved_pid = product.id if product else data.product_id
        scenario = WhatIfScenario(
            id=scen_id,
            product_id=resolved_pid,
            name=data.name,
            current_price=data.current_price,
            simulated_price=data.simulated_price,
            expected_demand=data.expected_demand,
            expected_revenue=data.expected_revenue,
            expected_margin=data.expected_margin,
            expected_gross_profit=data.expected_gross_profit,
            status=data.status or "Staged Draft"
        )
        db.add(scenario)
        db.commit()
        db.refresh(scenario)

        p = scenario.product
        return {
            "id": scenario.id,
            "product_id": scenario.product_id,
            "sku": p.sku if p else "N/A",
            "product_name": p.name if p else scenario.name,
            "name": scenario.name,
            "current_price": scenario.current_price,
            "simulated_price": scenario.simulated_price,
            "expected_demand": scenario.expected_demand,
            "expected_revenue": scenario.expected_revenue,
            "expected_margin": scenario.expected_margin,
            "expected_gross_profit": scenario.expected_gross_profit,
            "status": scenario.status,
            "created_at": scenario.created_at,
            "updated_at": scenario.updated_at
        }

    @staticmethod
    def delete_scenario(db: Session, scenario_id: str) -> bool:
        scenario = db.query(WhatIfScenario).filter(WhatIfScenario.id == scenario_id).first()
        if not scenario:
            return False
        db.delete(scenario)
        db.commit()
        return True
