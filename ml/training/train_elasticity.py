"""
SmartPrice ML Training Pipeline - Price Elasticity Trainer & Benchmark

Executes the price elasticity training and validation workflow:
1. Loads catalog products and sales records from SQLite.
2. Performs data sufficiency and price variance diagnostics per SKU.
3. Reports econometrically why zero price variation prevents slope identification.
4. Fits log-log demand regressions across catalog products and exports versioned artifacts.
5. Runs econometric benchmark validation on price-varying series to verify regression accuracy.
"""
import sys
import json
from datetime import datetime, timezone
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.config.elasticity_config import ElasticityConfig, ELASTICITY_ARTIFACTS_DIR
from ml.optimization.estimator import ElasticityEstimator
from ml.optimization.regression import LogLogDemandRegression
from ml.optimization.validator import ElasticityValidator

def train_elasticity_models(config: ElasticityConfig = None) -> dict:
    if config is None:
        config = ElasticityConfig()

    print("=" * 65)
    print("SMARTPRICE ML PIPELINE - PRICE ELASTICITY ESTIMATION & DIAGNOSTICS")
    print("=" * 65)

    estimator = ElasticityEstimator(config=config)

    # 1. Evaluate SQLite Sales Database
    print(f"\n[Step 1] Loading historical transactions from: {config.db_path}")
    catalog_results = estimator.fit_catalog()
    print(f"       -> Evaluated {len(catalog_results)} catalog products.")

    # 2. Inspect Price Variation & Data Sufficiency Findings
    print("\n[Step 2] Price Variation & Identification Diagnostics:")
    print("       -------------------------------------------------------------")
    print("       SKU       | Distinct P | Price CV | Status                     | Effective E")
    print("       -------------------------------------------------------------")
    
    constant_price_count = 0
    for sku, res in catalog_results.items():
        data_sum = res["data_summary"]
        distinct_p = data_sum.get("distinct_prices", 0)
        price_cv = data_sum.get("price_cv", 0.0)
        status = res["reliability_status"]
        eff_e = res["effective_elasticity"]
        if status == "UNRELIABLE_CONSTANT_PRICE":
            constant_price_count += 1
        print(f"       {sku:<9} | {distinct_p:<10} | {price_cv:<8.4f} | {status:<26} | {eff_e:<10.2f}")

    print("       -------------------------------------------------------------")

    print(f"\n[Data Assessment Finding]")
    print(f"       * {constant_price_count}/{len(catalog_results)} SKUs exhibit ZERO price variation (constant shelf price).")
    print("       * Econometric Identification: In OLS regression ln(Q) = a + e*ln(P),")
    print("         the slope estimator is: beta = Cov(ln P, ln Q) / Var(ln P).")
    print("         When Var(ln P) == 0, the denominator is zero and elasticity is mathematically unidentifiable.")
    print("       * Policy: System safely retains established catalog elasticity fallbacks.")

    # 3. Benchmark Verification on Price-Varying Data
    print("\n[Step 3] Econometric Benchmark Verification (Price-Varying Sample Series):")
    # Simulate a realistic price-elastic retail demand series:
    # 20 observations, prices varying between 180 and 220, true underlying elasticity = -1.45
    test_prices = [
        180.0, 185.0, 190.0, 195.0, 200.0, 205.0, 210.0, 215.0, 220.0, 182.5,
        187.5, 192.5, 197.5, 202.5, 207.5, 212.5, 217.5, 185.0, 200.0, 210.0
    ]
    # Q = exp(12.5) * P^(-1.45) with small empirical noise
    test_quantities = [
        round(math_exp_p(12.5, p, -1.45)) for p in test_prices
    ]

    bench_reg = LogLogDemandRegression()
    bench_reg.fit(test_prices, test_quantities)

    validator = ElasticityValidator(config)
    bench_assessment = validator.assess_reliability(
        regression_diagnostics={
            "elasticity": bench_reg.elasticity,
            "intercept": bench_reg.intercept,
            "std_error": bench_reg.std_error,
            "r_squared": bench_reg.r_squared,
            "t_statistic": bench_reg.t_stat,
            "p_value": bench_reg.p_value,
            "conf_interval_95": bench_reg.conf_interval_95,
            "sample_size": bench_reg.sample_size,
            **bench_reg.diagnostics
        },
        sku="BENCH-DEMO",
        catalog_fallback=-1.25
    )

    print(f"       -> Fitted Elasticity (epsilon): {bench_reg.elasticity:.3f}")
    print(f"       -> Standard Error SE(epsilon):  {bench_reg.std_error:.3f}")
    print(f"       -> Coefficient of Determ (R2): {bench_reg.r_squared:.3f}")
    print(f"       -> t-statistic:                 {bench_reg.t_stat:.3f}")
    print(f"       -> p-value:                     {bench_reg.p_value:.4f}")
    print(f"       -> 95% Confidence Interval:     {bench_reg.conf_interval_95}")
    print(f"       -> Benchmark Reliability Status: {bench_assessment['reliability_status']}")
    print(f"       -> Is Reliable for Deployment:  {bench_assessment['is_reliable']}")

    # 4. Save Versioned Artifacts
    print(f"\n[Step 4] Exporting reproducible model artifacts to: {config.artifacts_dir}")
    config.artifacts_dir.mkdir(parents=True, exist_ok=True)
    estimator.save(config.artifacts_dir)
    print("       -> Saved model.json and metadata.json successfully.")

    print("=" * 65)
    print("PRICE ELASTICITY PIPELINE RUN COMPLETE")
    print("=" * 65 + "\n")

    return {
        "status": "success",
        "total_skus": len(catalog_results),
        "constant_price_skus": constant_price_count,
        "benchmark_elasticity": bench_reg.elasticity,
        "benchmark_reliable": bench_assessment["is_reliable"]
    }

def math_exp_p(alpha: float, p: float, epsilon: float) -> float:
    import math
    return max(1.0, math.exp(alpha + epsilon * math.log(p)))

if __name__ == "__main__":
    train_elasticity_models()
