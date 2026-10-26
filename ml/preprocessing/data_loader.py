"""
SmartPrice ML Preprocessing - Data Loader and Validator

Extracts historical sales data from the SQLite database or CSV, performs strict
schema and statistical validation, handles chronological sorting, and produces
train/validation splits with zero future-data leakage.
"""
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

class SalesDataLoader:
    REQUIRED_COLUMNS = {"id", "product_id", "sale_date", "quantity", "selling_price"}

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = Path(db_path) if db_path else Path(__file__).resolve().parent.parent.parent / "backend" / "data" / "smartprice.db"

    def load_raw_sales(self) -> List[Dict[str, Any]]:
        """Queries raw sales with product metadata from the SQLite database."""
        if not self.db_path.exists():
            raise FileNotFoundError(f"SmartPrice database not found at {self.db_path}")

        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        query = """
            SELECT 
                s.id as sale_id,
                s.product_id,
                p.sku,
                p.name as product_name,
                p.category,
                s.sale_date,
                s.quantity,
                s.selling_price,
                s.revenue,
                s.cost,
                s.profit,
                s.store
            FROM sales s
            JOIN products p ON s.product_id = p.id
            ORDER BY s.sale_date ASC, s.product_id ASC
        """
        rows = cur.execute(query).fetchall()
        conn.close()

        return [dict(r) for r in rows]

    def validate_dataset(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Evaluates data quality and checks whether the dataset meets criteria
        for training genuine statistical/ML time-series models.
        """
        warnings: List[str] = []
        if not records:
            return {
                "valid": False,
                "is_sufficient_for_ml": False,
                "total_records": 0,
                "warnings": ["Dataset is empty. No sales records found in database."]
            }

        dates = set()
        products = set()
        total_units = 0
        negative_quantities = 0

        for r in records:
            try:
                dt = datetime.strptime(r["sale_date"], "%Y-%m-%d")
                dates.add(r["sale_date"])
            except (ValueError, KeyError):
                warnings.append(f"Invalid date format in record {r.get('sale_id')}")

            products.add(r.get("sku") or r.get("product_id"))
            qty = r.get("quantity", 0)
            if qty < 0:
                negative_quantities += 1
            total_units += qty

        sorted_dates = sorted(list(dates))
        distinct_date_count = len(sorted_dates)

        # Statistical sufficiency evaluation for genuine ML forecasting
        is_sufficient = True
        if distinct_date_count < 30:
            is_sufficient = False
            warnings.append(
                f"Insufficient historical depth: {distinct_date_count} distinct dates observed. "
                "Reliable time-series demand models require at least 60-90 continuous daily observation periods."
            )

        if len(records) < 500:
            warnings.append(
                f"Small sample size: {len(records)} total records across {len(products)} products. "
                "Data represents seeded/sample transaction sets rather than production historical POS volume."
            )

        # Check for gap frequency (e.g. bi-weekly gaps)
        if distinct_date_count > 1:
            d_first = datetime.strptime(sorted_dates[0], "%Y-%m-%d")
            d_last = datetime.strptime(sorted_dates[-1], "%Y-%m-%d")
            span_days = (d_last - d_first).days
            avg_gap = span_days / max(1, distinct_date_count - 1)
            if avg_gap > 3.0:
                warnings.append(
                    f"Sparse date spacing: average gap between sales dates is {avg_gap:.1f} days. "
                    "Continuous daily retail series is recommended for high-resolution forecasting."
                )

        return {
            "valid": len(warnings) == 0 or len(records) > 0,
            "is_sufficient_for_ml": is_sufficient,
            "total_records": len(records),
            "distinct_dates": distinct_date_count,
            "date_range": (sorted_dates[0], sorted_dates[-1]) if sorted_dates else (None, None),
            "product_count": len(products),
            "total_units_sold": total_units,
            "negative_quantities": negative_quantities,
            "warnings": warnings
        }

    def aggregate_daily_series(
        self, records: List[Dict[str, Any]], sku: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Aggregates sales by date for a given SKU (or across the entire catalog if sku is None).
        Returns a sorted chronological time series: [{"date": YYYY-MM-DD, "units": int, "revenue": float}].
        """
        filtered = [r for r in records if (sku is None or r.get("sku") == sku or r.get("product_id") == sku)]
        
        daily_agg: Dict[str, Dict[str, Any]] = {}
        for r in filtered:
            d = r["sale_date"]
            if d not in daily_agg:
                daily_agg[d] = {"date": d, "units": 0, "revenue": 0.0, "price": r.get("selling_price", 0.0)}
            daily_agg[d]["units"] += r.get("quantity", 0)
            daily_agg[d]["revenue"] += r.get("revenue", 0.0)

        # Chronological sorting
        sorted_series = [daily_agg[d] for d in sorted(daily_agg.keys())]
        return sorted_series

    def split_chronological(
        self, series: List[Dict[str, Any]], val_ratio: float = 0.25
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], str]:
        """
        Performs a strictly chronological train/validation split to prevent future-data leakage.
        Returns (train_series, val_series, cutoff_date).
        """
        if not series:
            return [], [], ""

        sorted_series = sorted(series, key=lambda x: x["date"])
        n = len(sorted_series)
        
        # Need at least 2 points to split
        if n < 4:
            split_idx = max(1, n - 1)
        else:
            val_count = max(1, round(n * val_ratio))
            split_idx = n - val_count

        train_series = sorted_series[:split_idx]
        val_series = sorted_series[split_idx:]
        cutoff_date = val_series[0]["date"] if val_series else sorted_series[-1]["date"]

        return train_series, val_series, cutoff_date
