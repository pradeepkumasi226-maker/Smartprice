"""
SmartPrice Inventory Intelligence Module - Regression Test Suite
Verifies:
1. Stock consistency and transaction history for SKU SPT-2019.
2. Accurate stock status calculation and reorder thresholds.
3. Status filters (Critical, Low Stock, In Stock, Overstocked).
4. Relational inventory transaction ledger response fields (remaining_stock, new_stock, date).
5. Mathematical integrity (new_stock == previous_stock + quantity) across ledger rows.
NOTE: This test suite is strictly read-only and does not mutate existing products or transactions.
"""

import sys
from pathlib import Path

# Add project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import SessionLocal
from backend.app.models.product import Product
from backend.app.models.inventory_transaction import InventoryTransaction
from backend.app.services.product_service import compute_stock_status, ProductService
from backend.app.services.inventory_service import InventoryService
from fastapi.testclient import TestClient
from backend.main import app

def run_tests():
    print("\n==================================================")
    print("INVENTORY INTELLIGENCE REGRESSION TEST SUITE")
    print("==================================================\n")

    passed = 0
    total = 0

    def assert_check(condition, name, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            print(f"[PASS] [{total:02d}]: {name}")
            if details:
                print(f"       -> {details}")
            passed += 1
        else:
            print(f"[FAIL] [{total:02d}]: {name}")
            if details:
                print(f"       -> {details}")

    db = SessionLocal()
    client = TestClient(app)

    try:
        # ----------------------------------------------------
        # ISSUE 1: Stock Consistency & Status for SPT-2019
        # ----------------------------------------------------
        spt = db.query(Product).filter(Product.sku == "SPT-2019").first()
        assert_check(spt is not None, "Product SPT-2019 exists in database", f"ID: {spt.id if spt else 'None'}")
        assert_check(spt.stock_quantity == 40, "SPT-2019 has current stock quantity of 40 units", f"Stock: {spt.stock_quantity}")
        assert_check(spt.reorder_level == 20, "SPT-2019 has reorder_level of 20 units", f"Reorder: {spt.reorder_level}")
        assert_check(spt.safety_stock == 10, "SPT-2019 has safety_stock of 10 units", f"Safety: {spt.safety_stock}")

        # Check transaction history for SPT-2019 (prod-007)
        txs = db.query(InventoryTransaction).filter(InventoryTransaction.product_id == spt.id).all()
        assert_check(len(txs) == 1, "SPT-2019 has exactly 1 inventory transaction recorded", f"Count: {len(txs)}")

        restock_tx = txs[0] if txs else None
        assert_check(
            restock_tx is not None and restock_tx.transaction_type == "RESTOCK" and restock_tx.quantity == 24,
            "+24 RESTOCK transaction is present in database for SPT-2019",
            f"Tx ID: {restock_tx.id if restock_tx else 'None'}, Qty: {restock_tx.quantity if restock_tx else 'None'}"
        )
        assert_check(
            restock_tx is not None and restock_tx.previous_stock == 16 and restock_tx.new_stock == 40,
            "Transaction applied exactly once: 16 (prev) + 24 (qty) = 40 (new)",
            f"Prev: {restock_tx.previous_stock if restock_tx else 'None'} -> New: {restock_tx.new_stock if restock_tx else 'None'}"
        )
        assert_check(
            spt.stock_quantity == restock_tx.new_stock,
            "Current stock quantity agrees with transaction history",
            f"Product Stock: {spt.stock_quantity}, Ledger New Stock: {restock_tx.new_stock}"
        )

        # Verify stock status calculation
        status_at_16 = compute_stock_status(16, spt.reorder_level, spt.safety_stock)
        assert_check(status_at_16 == "Low Stock", "Stock status at 16 units correctly computes to 'Low Stock'", f"Computed: {status_at_16}")

        status_at_40 = compute_stock_status(40, spt.reorder_level, spt.safety_stock)
        assert_check(status_at_40 == "Optimal", "Stock status at 40 units correctly computes to 'Optimal'", f"Computed: {status_at_40}")

        assert_check(compute_stock_status(8, 20, 10) == "Critical", "Stock status <= safety computes to 'Critical'")
        assert_check(compute_stock_status(75, 20, 10) == "Overstocked", "Stock status > reorder * 3.5 computes to 'Overstocked'")

        # ----------------------------------------------------
        # ISSUE 1: Status Filters
        # ----------------------------------------------------
        all_prods = ProductService.get_products(db, status="All")
        assert_check(len(all_prods) >= 10, "Status filter 'All' returns all operational products (>= 10)", f"Found: {len(all_prods)}")

        crit_prods = ProductService.get_products(db, status="Critical")
        assert_check(len(crit_prods) == 0, "Status filter 'Critical' returns 0 products", f"Found: {len(crit_prods)}")

        low_prods = ProductService.get_products(db, status="Low Stock")
        assert_check(
            len(low_prods) == 1 and low_prods[0]["sku"] == "APP-3041",
            "Status filter 'Low Stock' correctly identifies APP-3041 (stock 30 <= reorder 40)",
            f"Found: {[p['sku'] for p in low_prods]}"
        )

        in_stock_prods = ProductService.get_products(db, status="In Stock")
        assert_check(
            len(in_stock_prods) == 9 and any(p["sku"] == "SPT-2019" for p in in_stock_prods),
            "Status filter 'In Stock' returns all 9 healthy products including SPT-2019",
            f"Found: {len(in_stock_prods)} SKUs: {[p['sku'] for p in in_stock_prods]}"
        )

        opt_prods = ProductService.get_products(db, status="Optimal")
        assert_check(
            len(opt_prods) == 9 and any(p["sku"] == "SPT-2019" for p in opt_prods),
            "Status filter 'Optimal' returns the identical 9 products",
            f"Found: {len(opt_prods)}"
        )

        over_prods = ProductService.get_products(db, status="Overstocked")
        assert_check(
            len(over_prods) == 1 and over_prods[0]["sku"] == "HOM-7193",
            "Status filter 'Overstocked' returns exactly HOM-7193 (248 units)",
            f"Found: {[p['sku'] for p in over_prods]}"
        )

        # ----------------------------------------------------
        # ISSUE 2: Inventory Movement Ledger & Remaining Balance
        # ----------------------------------------------------
        logs = InventoryService.get_transactions(db, limit=50)
        assert_check(len(logs) <= 50 and len(logs) > 0, "InventoryService.get_transactions respects maximum limit=50 cap", f"Count: {len(logs)}")

        first_log = logs[0]
        assert_check("remaining_stock" in first_log, "Transaction record contains 'remaining_stock' field", f"Value: {first_log.get('remaining_stock')}")
        assert_check("new_stock" in first_log, "Transaction record contains 'new_stock' field", f"Value: {first_log.get('new_stock')}")
        assert_check("date" in first_log and first_log["date"] is not None, "Transaction record contains formatted 'date' string", f"Date: {first_log.get('date')}")
        assert_check(isinstance(first_log["remaining_stock"], int), "'remaining_stock' is an integer", f"Type: {type(first_log['remaining_stock'])}")
        assert_check(first_log["remaining_stock"] == first_log["new_stock"], "'remaining_stock' equals 'new_stock'", f"{first_log['remaining_stock']} == {first_log['new_stock']}")

        # Verify mathematical consistency across ALL transactions in database
        all_txs = db.query(InventoryTransaction).all()
        consistent_count = 0
        for t in all_txs:
            if t.previous_stock + t.quantity == t.new_stock:
                consistent_count += 1
        assert_check(
            consistent_count == len(all_txs),
            f"All {len(all_txs)} database transactions satisfy new_stock == previous_stock + quantity",
            f"Consistent: {consistent_count}/{len(all_txs)}"
        )

        # ----------------------------------------------------
        # API Endpoint GET /api/inventory
        # ----------------------------------------------------
        res = client.get("/api/inventory")
        assert_check(res.status_code == 200, "GET /api/inventory returns HTTP 200")
        inv_data = res.json()
        assert_check("summary" in inv_data and "logs" in inv_data and "products" in inv_data, "Response has summary, products, and logs")
        assert_check(inv_data["summary"]["optimal_count"] == 9, "Inventory summary has optimal_count == 9", f"Count: {inv_data['summary']['optimal_count']}")
        assert_check(inv_data["summary"]["overstocked_count"] == 1, "Inventory summary has overstocked_count == 1", f"Count: {inv_data['summary']['overstocked_count']}")
        assert_check(inv_data["summary"]["low_stock_count"] == 1, "Inventory summary has low_stock_count == 1 (APP-3041)", f"Count: {inv_data['summary']['low_stock_count']}")
        assert_check(inv_data["summary"]["critical_count"] == 0, "Inventory summary has critical_count == 0")

        # Verify first log in API response
        api_first_log = inv_data["logs"][0]
        assert_check(
            api_first_log.get("remaining_stock") is not None and isinstance(api_first_log.get("remaining_stock"), int),
            "API response log has non-null integer remaining_stock",
            f"remaining_stock: {api_first_log.get('remaining_stock')}"
        )
        assert_check(
            api_first_log.get("date") is not None,
            "API response log has non-null date",
            f"date: {api_first_log.get('date')}"
        )

    finally:
        db.close()

    print(f"\n==================================================")
    print(f"REGRESSION TEST SUMMARY: {passed}/{total} TESTS PASSED")
    print(f"==================================================\n")
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
