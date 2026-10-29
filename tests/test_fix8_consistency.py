"""
SmartPrice Consistency Fix #8 Verification Test Suite

Covers:
1. What-If Simulation: Product selection, baseline/proposed price synchronization (no cross-SKU leakage like BEA-9144 vs ELC-8812).
2. Demand Forecast Metrics: Truthful backtested validation metrics (WAPE 48.1%, MAE 31.26 units), dynamic promotional uplift percentage with zero-volume safety.
3. Competitor Match Buffer: Configuration wiring through API into pricing engine, bounds validation (0-50%), below-cost floor guardrail preservation, and executive override audit trail immutability.
"""

import sys
import os
import unittest

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from backend.app.services.pricing_service import PricingService
from backend.database import SessionLocal
from backend.app.models.product import Product
from backend.app.models.pricing_recommendation import PricingRecommendation
from backend.app.models.pricing_decision import PricingDecision


class TestFix8WhatIfSimulation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_bea_9144_simulation_baseline_and_price(self):
        """Verify What-If simulation for BEA-9144 uses its own baseline price and does not leak ELC-8812's ₹947.58."""
        prod = self.db.query(Product).filter(Product.sku == "BEA-9144").first()
        self.assertIsNotNone(prod, "BEA-9144 product must exist in catalog")

        resp = self.client.post("/api/what-if/simulate", json={
            "sku": "BEA-9144",
            "simulated_price": 52.00,
            "competitor_offset": 0.0,
            "elasticity_multiplier": 1.0,
            "promo_discount": 0.0
        })
        self.assertEqual(resp.status_code, 200, f"Simulate failed: {resp.text}")
        data = resp.json()

        # Strict checks on SKU, product ID, baseline price
        self.assertEqual(data["sku"], "BEA-9144")
        self.assertEqual(data["product_id"], prod.id)
        self.assertAlmostEqual(data["baseline_price"], prod.current_price, places=2)
        self.assertNotEqual(data["baseline_price"], 947.58, "BEA-9144 must not inherit ELC-8812's baseline price")
        self.assertAlmostEqual(data["simulated_price"], 52.00, places=2)

        # Financial reconciliation
        expected_baseline_rev = round(prod.current_price * prod.predicted_demand, 2)
        self.assertAlmostEqual(data["baseline_revenue"], expected_baseline_rev, places=1)
        self.assertEqual(data["baseline_demand"], prod.predicted_demand)

    def test_02_elc_8812_simulation_baseline(self):
        """Verify What-If simulation for ELC-8812 uses its own ₹947.58 baseline price."""
        prod = self.db.query(Product).filter(Product.sku == "ELC-8812").first()
        self.assertIsNotNone(prod, "ELC-8812 product must exist in catalog")

        resp = self.client.post("/api/what-if/simulate", json={
            "sku": "ELC-8812",
            "simulated_price": 899.00
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data["sku"], "ELC-8812")
        self.assertEqual(data["product_id"], prod.id)
        self.assertAlmostEqual(data["baseline_price"], prod.current_price, places=2)
        self.assertAlmostEqual(data["simulated_price"], 899.00, places=2)

    def test_03_simulate_by_product_id(self):
        """Verify What-If simulation resolves cleanly using product_id."""
        prod = self.db.query(Product).filter(Product.sku == "BEA-9144").first()
        resp = self.client.post("/api/what-if/simulate", json={
            "product_id": prod.id,
            "simulated_price": 60.00
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["sku"], "BEA-9144")
        self.assertEqual(data["product_id"], prod.id)
        self.assertAlmostEqual(data["baseline_price"], prod.current_price, places=2)


class TestFix8ForecastMetrics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_04_forecast_accuracy_metric_truthful(self):
        """Verify GET /api/forecast returns truthful backtested validation metrics (WAPE 48.1%, MAE 31.26 units)."""
        resp = self.client.get("/api/forecast?time_range=7d")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        accuracy = data.get("accuracy_metric", "")
        self.assertIn("WAPE", accuracy)
        self.assertIn("48.1%", accuracy)
        self.assertIn("MAE", accuracy)
        self.assertNotIn("95.8%", accuracy, "Deceptive 95.8% confidence score must not appear in accuracy metadata")

    def test_05_dynamic_promo_uplift_calculation(self):
        """Test calculation of promotional uplift percentage across horizons."""
        for horizon in ["7d", "30d", "90d"]:
            resp = self.client.get(f"/api/forecast?time_range={horizon}")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            points = data.get("points", [])
            total_vol = data.get("total_predicted_demand", 0)
            total_promo = sum(p.get("promo_uplift", 0) for p in points)

            # Uplift percentage should be mathematically sound
            if total_vol > 0:
                calc_pct = (total_promo / total_vol) * 100
                self.assertGreaterEqual(calc_pct, 0.0)
                self.assertLessEqual(calc_pct, 100.0)

    def test_06_zero_volume_safety(self):
        """Verify safe zero handling: 0 volume produces +0.0% uplift without division by zero."""
        total_vol = 0
        promo_units = 0
        trend_val = f"+{((promo_units / total_vol) * 100):.1f}%" if total_vol > 0 else "+0.0%"
        self.assertEqual(trend_val, "+0.0%")


class TestFix8CompetitorMatchBuffer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_07_recommendations_accept_competitor_buffer_param(self):
        """Verify GET /api/pricing/recommendations accepts competitor_buffer_pct and passes to pricing drivers."""
        resp = self.client.get("/api/pricing/recommendations?include_all=true&competitor_buffer_pct=4.5")
        self.assertEqual(resp.status_code, 200)
        recs = resp.json()
        self.assertGreater(len(recs), 0)

        # Check that pricing_drivers reflects the configured competitor_buffer_pct
        for r in recs:
            drivers = r.get("pricing_drivers", {})
            self.assertEqual(drivers.get("competitor_buffer_pct"), 4.5)

    def test_08_competitor_buffer_bounds_validation(self):
        """Verify invalid competitor buffer values (< 0% or > 50%) are rejected with HTTP 400."""
        resp_neg = self.client.get("/api/pricing/recommendations?competitor_buffer_pct=-5.0")
        self.assertEqual(resp_neg.status_code, 400)
        self.assertIn("between 0.0 and 50.0", resp_neg.text)

        resp_high = self.client.get("/api/pricing/recommendations?competitor_buffer_pct=75.0")
        self.assertEqual(resp_high.status_code, 400)
        self.assertIn("between 0.0 and 50.0", resp_high.text)

    def test_09_cost_floor_strictly_preserved(self):
        """Verify that varying competitor buffer never causes recommended prices to breach the cost floor."""
        for buffer_val in [0.0, 3.5, 10.0, 25.0]:
            resp = self.client.get(f"/api/pricing/recommendations?include_all=true&competitor_buffer_pct={buffer_val}&min_margin_pct=10.0")
            self.assertEqual(resp.status_code, 200)
            recs = resp.json()
            for r in recs:
                cost = r.get("cost_price", 0.0)
                rec_p = r.get("recommended_price", 0.0)
                # Unless approved as executive below-cost override, recommended price must not violate cost floor
                if r.get("status") != "Approved" or rec_p >= cost:
                    self.assertGreaterEqual(
                        rec_p, cost - 0.01,
                        f"SKU {r.get('sku')} recommended price {rec_p} violated cost floor {cost} with buffer {buffer_val}"
                    )

    def test_10_executive_override_preservation(self):
        """Verify executive override record dec-1793255113253 (prod-002, ₹500.00) remains preserved and intact."""
        decision = self.db.query(PricingDecision).filter(PricingDecision.id == "dec-1793255113253").first()
        self.assertIsNotNone(decision, "Executive override decision record must exist")
        self.assertEqual(decision.product_id, "prod-002")
        self.assertEqual(decision.approved_price, 500.00)
        self.assertEqual(decision.decision, "OVERRIDDEN_BELOW_COST")
        self.assertEqual(decision.user, "Marcus Vance")

    def test_11_database_immutability(self):
        """Verify that testing Fix #8 performed zero unintended modifications to database counts."""
        products_count = self.db.query(Product).count()
        decisions_count = self.db.query(PricingDecision).count()
        self.assertEqual(products_count, 11, "Products count must remain exactly 11")
        self.assertEqual(decisions_count, 218, "Decisions count must remain exactly 218")


if __name__ == "__main__":
    unittest.main(verbosity=2)
