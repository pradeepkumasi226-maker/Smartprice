from sqlalchemy.orm import Session
from ...database import SessionLocal, engine, Base
from ..models import (
    User,
    Product,
    Sale,
    InventoryTransaction,
    PricingRecommendation,
    PricingDecision,
    WhatIfScenario,
    Forecast,
    ShapExplanation
)
import datetime

def seed_database(force: bool = False):
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Check if already seeded
        existing_count = db.query(Product).count()
        if existing_count > 0 and not force:
            print(f"[Seed] Database already contains {existing_count} products. Skipping seeding.")
            return

        if force:
            print("[Seed] Force reset requested. Purging existing tables...")
            db.query(Sale).delete()
            db.query(InventoryTransaction).delete()
            db.query(PricingRecommendation).delete()
            db.query(PricingDecision).delete()
            db.query(WhatIfScenario).delete()
            db.query(Forecast).delete()
            db.query(ShapExplanation).delete()
            db.query(Product).delete()
            db.query(User).delete()
            db.commit()

        print("[Seed] Seeding Users...")
        users = [
            User(id="usr-01", name="Pradeep K (Retail Lead)", identifier="pradeep.retail@smartprice.ai", role="Retail Pricing Manager"),
            User(id="usr-02", name="Sarah Jenkins", identifier="analyst.sarah@smartprice.ai", role="Senior Merchandising Analyst"),
            User(id="usr-03", name="Marcus Vance", identifier="+1 (555) 234-8910", role="Store Operations Director"),
            User(id="usr-04", name="Dr. Alex Rivera", identifier="data.alex@smartprice.ai", role="XAI Data Scientist")
        ]
        db.add_all(users)

        print("[Seed] Seeding Products...")
        products = [
            Product(
                id="prod-001",
                sku="ELC-4921",
                name="Ultra-HD Wireless Noise-Cancelling Headphones",
                category="Electronics",
                current_price=199.99,
                cost_price=95.00,
                competitor_price=209.99,
                stock_quantity=45,
                reorder_level=30,
                safety_stock=15,
                supplier="Global Audio Innovations Corp.",
                rating=4.8,
                elasticity=-1.45,
                predicted_demand=320
            ),
            Product(
                id="prod-002",
                sku="ELC-8812",
                name="4K Quantum-Dot OLED Smart TV (55-Inch)",
                category="Electronics",
                current_price=899.00,
                cost_price=540.00,
                competitor_price=949.00,
                stock_quantity=14,
                reorder_level=20,
                safety_stock=10,
                supplier="VisionTech Displays Inc.",
                rating=4.7,
                elasticity=-1.85,
                predicted_demand=140
            ),
            Product(
                id="prod-003",
                sku="APP-1029",
                name="Merino Wool Breathable Running Jacket",
                category="Apparel",
                current_price=89.00,
                cost_price=38.00,
                competitor_price=95.00,
                stock_quantity=62,
                reorder_level=25,
                safety_stock=10,
                supplier="Alpine Performance Apparel Ltd.",
                rating=4.6,
                elasticity=-0.95,
                predicted_demand=240,
                dynamic_pricing=False
            ),
            Product(
                id="prod-004",
                sku="APP-3041",
                name="Premium Ergonomic Everyday Denim Jeans",
                category="Apparel",
                current_price=64.50,
                cost_price=24.00,
                competitor_price=69.99,
                stock_quantity=110,
                reorder_level=40,
                safety_stock=15,
                supplier="Modern Thread Works LLC",
                rating=4.5,
                elasticity=-1.15,
                predicted_demand=450
            ),
            Product(
                id="prod-005",
                sku="HOM-5520",
                name="Smart Temperature Control Espresso Machine",
                category="Home Goods",
                current_price=249.00,
                cost_price=120.00,
                competitor_price=269.00,
                stock_quantity=28,
                reorder_level=25,
                safety_stock=10,
                supplier="Artisan Brew Tech GmbH",
                rating=4.9,
                elasticity=-1.35,
                predicted_demand=180
            ),
            Product(
                id="prod-006",
                sku="HOM-7193",
                name="Robot Vacuum & Mop with LiDAR Navigation",
                category="Home Goods",
                current_price=399.00,
                cost_price=195.00,
                competitor_price=429.00,
                stock_quantity=8,
                reorder_level=20,
                safety_stock=10,
                supplier="SmartLiving Automation Co.",
                rating=4.6,
                elasticity=-2.10,
                predicted_demand=110
            ),
            Product(
                id="prod-007",
                sku="SPT-2019",
                name="Carbon Fiber Lightweight Tennis Racket",
                category="Sports & Outdoors",
                current_price=145.00,
                cost_price=62.00,
                competitor_price=159.00,
                stock_quantity=35,
                reorder_level=20,
                safety_stock=10,
                supplier="Apex Athletics Equipment",
                rating=4.7,
                elasticity=-0.80,
                predicted_demand=160
            ),
            Product(
                id="prod-008",
                sku="SPT-8492",
                name="Pro Trail Running Hydration Backpack",
                category="Sports & Outdoors",
                current_price=78.00,
                cost_price=28.00,
                competitor_price=84.50,
                stock_quantity=55,
                reorder_level=20,
                safety_stock=8,
                supplier="TrailEdge Outdoor Gear",
                rating=4.8,
                elasticity=-1.05,
                predicted_demand=210
            ),
            Product(
                id="prod-009",
                sku="BEA-6601",
                name="Advanced Hyaluronic Acid Hydrating Serum",
                category="Beauty & Care",
                current_price=38.50,
                cost_price=11.50,
                competitor_price=42.00,
                stock_quantity=95,
                reorder_level=30,
                safety_stock=12,
                supplier="Lumina Derm Labs",
                rating=4.9,
                elasticity=-0.65,
                predicted_demand=580
            ),
            Product(
                id="prod-010",
                sku="BEA-9144",
                name="Organic Botanical Restorative Night Oil",
                category="Beauty & Care",
                current_price=52.00,
                cost_price=16.00,
                competitor_price=58.00,
                stock_quantity=40,
                reorder_level=20,
                safety_stock=8,
                supplier="PureFlora Organics",
                rating=4.6,
                elasticity=-0.75,
                predicted_demand=340
            )
        ]
        db.add_all(products)
        db.commit()

        print("[Seed] Seeding Pricing Recommendations...")
        recommendations = [
            PricingRecommendation(
                id="opt-prod-001",
                product_id="prod-001",
                recommended_price=219.50,
                expected_demand=348,
                expected_revenue=76386.0,
                expected_margin="56.7%",
                reason="Competitor stock shortage (+12.4% gap headroom) and high brand loyalty index.",
                status="Pending Approval"
            ),
            PricingRecommendation(
                id="opt-prod-002",
                product_id="prod-002",
                recommended_price=929.00,
                expected_demand=132,
                expected_revenue=122628.0,
                expected_margin="41.9%",
                reason="OLED panel procurement cost up +8%; competitor indexed at $949.00.",
                status="Pending Approval"
            ),
            PricingRecommendation(
                id="opt-prod-003",
                product_id="prod-003",
                recommended_price=98.00,
                expected_demand=235,
                expected_revenue=23030.0,
                expected_margin="61.2%",
                reason="Inelastic seasonal autumn transition demand curve.",
                status="Pending Approval"
            ),
            PricingRecommendation(
                id="opt-prod-006",
                product_id="prod-006",
                recommended_price=379.00,
                expected_demand=128,
                expected_revenue=48512.0,
                expected_margin="48.5%",
                reason="High price sensitivity (-2.10 elasticity); promo shift accelerates turnover.",
                status="Pending Approval"
            )
        ]
        db.add_all(recommendations)

        print("[Seed] Seeding What-If Scenarios...")
        scenarios = [
            WhatIfScenario(
                id="scen-1",
                product_id="prod-001",
                name="Weekend Flash Promo (-5% on Audio)",
                current_price=199.99,
                simulated_price=189.99,
                expected_demand=360,
                expected_revenue=68396.4,
                expected_margin="50.0%",
                expected_gross_profit=34196.4,
                status="Staged Draft"
            ),
            WhatIfScenario(
                id="scen-2",
                product_id="prod-003",
                name="Autumn Premium Margin Push (+10%)",
                current_price=89.00,
                simulated_price=97.90,
                expected_demand=220,
                expected_revenue=21538.0,
                expected_margin="61.2%",
                expected_gross_profit=13178.0,
                status="Staged Draft"
            )
        ]
        db.add_all(scenarios)

        print("[Seed] Seeding Inventory Transactions...")
        inv_txs = [
            InventoryTransaction(
                id="inv-tx-101",
                product_id="prod-001",
                transaction_type="RESTOCK",
                quantity=50,
                previous_stock=15,
                new_stock=65,
                unit_cost=95.00,
                reference="PO-REC-4821",
                user="Inventory Logistics Team",
                notes="Bi-weekly procurement batch delivery"
            ),
            InventoryTransaction(
                id="inv-tx-102",
                product_id="prod-006",
                transaction_type="SALE",
                quantity=-4,
                previous_stock=12,
                new_stock=8,
                unit_cost=195.00,
                reference="ORD-FLG-9102",
                user="Downtown POS Terminal #3",
                notes="In-store customer batch checkout"
            ),
            InventoryTransaction(
                id="inv-tx-103",
                product_id="prod-005",
                transaction_type="RESTOCK",
                quantity=20,
                previous_stock=8,
                new_stock=28,
                unit_cost=120.00,
                reference="PO-REC-5520",
                user="Inventory Logistics Team",
                notes="Expedited replenishment from Munich factory"
            )
        ]
        db.add_all(inv_txs)

        print("[Seed] Seeding Historical Sales...")
        # Deterministic 120 historical sales records spanning past 6 months
        stores = [
            "Downtown Flagship (Store #101)",
            "Westside Megastore (Store #102)",
            "Airport Terminal Hub (Store #103)",
            "E-Commerce Web Portal"
        ]

        sales = []
        import itertools
        dates = [
            "2026-01-15", "2026-01-28", "2026-02-10", "2026-02-22",
            "2026-03-08", "2026-03-24", "2026-04-12", "2026-04-26",
            "2026-05-05", "2026-05-19", "2026-06-02", "2026-06-18",
            "2026-07-04", "2026-07-20", "2026-08-05", "2026-08-18"
        ]

        idx = 1
        for p in products:
            for d in dates:
                store = stores[(idx % len(stores))]
                qty = (idx % 8) + 2
                sp = p.current_price
                cp = p.cost_price
                rev = round(qty * sp, 2)
                cost = round(qty * cp, 2)
                profit = round(rev - cost, 2)

                sales.append(
                    Sale(
                        id=f"sale-{idx:04d}",
                        product_id=p.id,
                        store=store,
                        sale_date=d,
                        quantity=qty,
                        selling_price=sp,
                        revenue=rev,
                        cost=cost,
                        profit=profit
                    )
                )
                idx += 1

        db.add_all(sales)
        db.commit()

        print(f"[Seed] Successfully seeded {len(products)} products, {len(sales)} sales, {len(recommendations)} recommendations, and {len(inv_txs)} transactions!")

    except Exception as e:
        db.rollback()
        print(f"[Seed Error] {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database(force=True)
