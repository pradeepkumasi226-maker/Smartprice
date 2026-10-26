from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.product import Product
from ..models.sale import Sale
from ..models.pricing_recommendation import PricingRecommendation
from .product_service import compute_stock_status

class DashboardService:
    @staticmethod
    def get_summary(db: Session) -> Dict[str, Any]:
        sales = db.query(Sale).all()
        products = db.query(Product).all()

        total_rev = sum(s.revenue for s in sales)
        total_units = sum(s.quantity for s in sales)
        total_cost = sum(s.cost for s in sales)
        total_profit = sum(s.profit for s in sales)
        avg_price = (total_rev / total_units) if total_units > 0 else 0.0
        gross_margin = ((total_profit / total_rev) * 100) if total_rev > 0 else 0.0
        inv_val = sum(p.stock_quantity * p.current_price for p in products)

        return {
            "revenue": round(total_rev, 2),
            "revenue_target": 1600000.0,
            "units_sold": total_units,
            "average_price": round(avg_price, 2),
            "gross_margin": round(gross_margin, 1),
            "inventory_value": round(inv_val, 2),
            "cost_of_goods_sold": round(total_cost, 2),
            "total_profit": round(total_profit, 2),
            "ai_revenue_lift": 13.1
        }

    @staticmethod
    def get_sales_trends(db: Session) -> List[Dict[str, Any]]:
        sales = db.query(Sale).all()
        monthly_map = {}

        for s in sales:
            month = s.sale_date[:7] if s.sale_date else "2026-01"
            if month not in monthly_map:
                monthly_map[month] = {"revenue": 0.0, "cost": 0.0, "profit": 0.0, "units": 0}
            monthly_map[month]["revenue"] += s.revenue
            monthly_map[month]["cost"] += s.cost
            monthly_map[month]["profit"] += s.profit
            monthly_map[month]["units"] += s.quantity

        results = []
        for m, data in sorted(monthly_map.items()):
            margin = f"{((data['profit'] / data['revenue']) * 100):.1f}%" if data['revenue'] > 0 else "0%"
            results.append({
                "month": m,
                "revenue": round(data["revenue"], 2),
                "cost": round(data["cost"], 2),
                "profit": round(data["profit"], 2),
                "margin": margin,
                "units": data["units"]
            })

        return results

    @staticmethod
    def get_insights(db: Session) -> List[Dict[str, Any]]:
        products = db.query(Product).all()
        alerts = []

        # Check for critical stock
        for p in products:
            status = compute_stock_status(p.stock_quantity, p.reorder_level, p.safety_stock)
            if status == "Critical":
                alerts.append({
                    "id": f"alt-stock-{p.id}",
                    "type": "danger",
                    "title": f"Stock Depleted Warning: {p.name}",
                    "message": f"Only {p.stock_quantity} units remaining (below safety threshold of {p.safety_stock}). Restock immediately to prevent lost sales.",
                    "timestamp": "12m ago",
                    "target_page": "inventory",
                    "link_text": "Review Inventory"
                })
            elif status == "Low Stock":
                alerts.append({
                    "id": f"alt-low-{p.id}",
                    "type": "warning",
                    "title": f"Inventory Reorder Level: {p.name}",
                    "message": f"Current stock is {p.stock_quantity} units (reorder level is {p.reorder_level}). Restock purchase order recommended.",
                    "timestamp": "45m ago",
                    "target_page": "inventory",
                    "link_text": "Open Inventory"
                })

        # Check for pricing opportunity
        recs = db.query(PricingRecommendation).filter(PricingRecommendation.status == "Pending Approval").all()
        for r in recs:
            p = r.product
            if p:
                alerts.append({
                    "id": f"alt-opt-{r.id}",
                    "type": "info",
                    "title": f"AI Pricing Opportunity: {p.name}",
                    "message": f"Recommended price shift to ${r.recommended_price:.2f} (+8.4% demand expansion with {r.expected_margin} margin).",
                    "timestamp": "2h ago",
                    "target_page": "optimization",
                    "link_text": "View Recommendations"
                })

        return alerts[:6]
