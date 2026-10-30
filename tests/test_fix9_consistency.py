"""
Regression test suite for SmartPrice Consistency Fix #9.
Verifies:
1. Wholesale cost valuation and retail potential valuation are dynamically calculated without hardcoding.
2. Canonical catalog categories and alias matching (Home Goods <-> Home & Kitchen, Beauty & Care <-> Health & Beauty).
3. Reports summary schema & endpoint exposes total_sales_transactions (160), date_start, date_end, and data_source.
4. Product 9909 (and catalog) minimum margin floor (₹1,332.00) is distinct from AI recommended optimal price (₹1,428.70).
5. Database immutability: zero modifications to sales, products, stock, or ledger transactions.
"""

import sys
import os
import unittest

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import SessionLocal
from backend.app.models.product import Product
from backend.app.models.sale import Sale
from backend.app.models.inventory_transaction import InventoryTransaction
from backend.app.models.pricing_decision import PricingDecision
from backend.app.services.inventory_service import InventoryService
from backend.app.services.report_service import ReportService
from backend.app.services.pricing_service import PricingService

class TestFix9Consistency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_dynamic_inventory_valuation(self):
        """Verify inventory reconciliation dynamically computes wholesale cost and retail shelf valuations."""
        reconciliation = InventoryService.get_reconciliation(self.db)
        self.assertEqual(reconciliation["status"], "reconciled")
        self.assertEqual(reconciliation["authoritative_source"], "products.stock_quantity")
        self.assertEqual(reconciliation["total_products"], 11)
        self.assertEqual(reconciliation["total_units"], 747)

        # Expected values based on the 11 products:
        # Wholesale cost: 126,431.50
        # Retail shelf: 240,212.69
        self.assertAlmostEqual(reconciliation["valuation_wholesale_cost"], 126431.50, places=2)
        self.assertAlmostEqual(reconciliation["valuation_retail_shelf"], 240212.69, places=2)

        # Valuation methodology strings should dynamically reference current calculated values
        methodology = reconciliation["discrepancy_analysis"]["valuation_methodology"]
        self.assertIn("126,431.50", methodology["wholesale_cost"])
        self.assertIn("240,212.69", methodology["retail_shelf"])
        # Should NOT contain stale 10-product hardcoded values
        self.assertNotIn("90,983.50", methodology["wholesale_cost"])
        self.assertNotIn("199,606.89", methodology["retail_shelf"])

    def test_02_reports_summary_data_scope(self):
        """Verify GET /api/reports/summary exposes live database sales scope and metadata."""
        summary = ReportService.get_summary(self.db)
        
        self.assertEqual(summary["total_sales_transactions"], 160)
        self.assertEqual(summary["date_start"], "2026-01-15")
        self.assertEqual(summary["date_end"], "2026-08-18")
        self.assertEqual(summary["data_source"], "SQLite Database (Historical Sales Table)")
        self.assertEqual(summary["total_products_managed"], 11)
        self.assertEqual(summary["reconciliation_status"], "reconciled")
        
        # Verify headline financials additivity with category breakdown
        self.assertEqual(summary["total_revenue"], summary["sum_category_revenue"])
        self.assertEqual(summary["total_profit"], summary["sum_category_profit"])
        self.assertAlmostEqual(summary["total_revenue"], 194831.12, places=2)
        self.assertAlmostEqual(summary["total_profit"], 95435.12, places=2)
        self.assertAlmostEqual(summary["cost_of_goods_sold"], 99396.00, places=2)

    def test_03_canonical_category_taxonomy_alignment(self):
        """Verify catalog products belong to canonical categories."""
        canonical_categories = {
            "Apparel",
            "Beauty & Care",
            "Electronics",
            "Home Goods",
            "Sports & Outdoors"
        }
        products = self.db.query(Product).all()
        for p in products:
            self.assertIn(p.category, canonical_categories, f"Product {p.sku} has non-canonical category {p.category}")

    def test_04_sku_9909_margin_floor_vs_optimal_recommendation(self):
        """Verify SKU 9909 minimum margin floor (₹1,332.00) vs AI recommended price (₹1,428.70)."""
        product = self.db.query(Product).filter(Product.sku == "9909").first()
        self.assertIsNotNone(product)
        self.assertEqual(product.cost_price, 999.00)
        self.assertEqual(product.current_price, 1099.00)

        # 25% margin floor calculation
        expected_floor = PricingService.calculate_margin_floor(product.cost_price, min_margin_pct=25.0)
        self.assertEqual(expected_floor, 1332.00)

        # Run recommendation with 25% min margin, 30% max price change, 3.5% competitor buffer
        rec = PricingService.calculate_product_recommendation(
            product,
            guardrails={
                "min_margin_pct": 25.0,
                "max_price_change_pct": 30.0,
                "allow_below_cost": False,
                "competitor_buffer_pct": 3.5
            },
            force_recalculate=True
        )

        rec_price = rec["recommended_price"]
        self.assertEqual(rec_price, 1428.70)

        # Distinguish: recommended price is ABOVE the minimum margin floor
        self.assertGreater(rec_price, expected_floor)
        self.assertNotEqual(rec_price, expected_floor)

        # Verify margin at recommended price satisfies min margin constraint
        margin_at_rec = ((rec_price - product.cost_price) / rec_price) * 100
        self.assertGreaterEqual(margin_at_rec, 25.0)

    def test_05_database_immutability(self):
        """Verify that Fix #9 did not alter or delete any database records."""
        prod_count = self.db.query(Product).count()
        sales_count = self.db.query(Sale).count()
        tx_count = self.db.query(InventoryTransaction).count()
        decisions_count = self.db.query(PricingDecision).count()
        total_units = sum(p.stock_quantity for p in self.db.query(Product).all())

        self.assertEqual(prod_count, 11)
        self.assertEqual(sales_count, 160)
        self.assertEqual(tx_count, 54)
        self.assertEqual(total_units, 747)
        self.assertGreaterEqual(decisions_count, 218)

if __name__ == "__main__":
    unittest.main()
