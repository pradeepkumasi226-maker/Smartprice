"""
SmartPrice ML Optimization - Econometric Log-Log Demand Regression

Implements Ordinary Least Squares (OLS) estimation for the log-log demand specification:
    ln(Q) = alpha + epsilon * ln(P) + e

Where:
    - Q: Quantity demanded (Q > 0)
    - P: Selling price (P > 0)
    - epsilon: Price elasticity of demand (constant elasticity)

Provides full regression diagnostics:
    - Elasticity point estimate (epsilon)
    - Standard error of elasticity SE(epsilon)
    - R-squared (R2)
    - t-statistic and approximate p-value
    - 95% confidence intervals
    - Safe handling for zero variance in price, nonpositive inputs, and small samples
"""
import math
from typing import List, Dict, Optional, Tuple, Any

def approx_t_pvalue(t_stat: float, df: int) -> float:
    """
    Computes an approximate two-tailed p-value for the Student's t-distribution.
    Uses standard normal approximation for df > 30, and regularized approximation for small df.
    """
    if df <= 0 or math.isnan(t_stat):
        return 1.0
    x = abs(t_stat)
    # Hill's approximation / normal tail approximation
    # For moderate to large df:
    z = x * (1.0 - 1.0 / (4.0 * df)) / math.sqrt(1.0 + (x * x) / (2.0 * df))
    # Standard normal CDF approximation (Abramowitz & Stegun formula 7.1.26)
    b0 = 0.2316419
    b1 = 0.319381530
    b2 = -0.356563782
    b3 = 1.781477937
    b4 = -1.821255978
    b5 = 1.330274429
    t = 1.0 / (1.0 + b0 * z)
    poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t
    phi = (1.0 / math.sqrt(2.0 * math.pi)) * math.exp(-0.5 * z * z)
    tail = phi * poly
    return max(0.0, min(1.0, 2.0 * tail))

class LogLogDemandRegression:
    """
    Log-log ordinary least squares regression for estimating price elasticity of demand.
    """

    def __init__(self):
        self.is_fitted = False
        self.elasticity: Optional[float] = None
        self.intercept: Optional[float] = None
        self.std_error: Optional[float] = None
        self.r_squared: Optional[float] = None
        self.t_stat: Optional[float] = None
        self.p_value: Optional[float] = None
        self.conf_interval_95: Tuple[float, float] = (0.0, 0.0)
        self.sample_size: int = 0
        self.dropped_records: int = 0
        self.diagnostics: Dict[str, Any] = {}

    def fit(self, prices: List[float], quantities: List[float]) -> "LogLogDemandRegression":
        """
        Fits ln(Q) = alpha + epsilon * ln(P).
        """
        if len(prices) != len(quantities):
            raise ValueError("Prices and quantities arrays must have identical length.")

        # Filter positive pairs (P > 0 and Q > 0 required for natural log)
        clean_p: List[float] = []
        clean_q: List[float] = []
        dropped = 0

        for p, q in zip(prices, quantities):
            if p is not None and q is not None and p > 0 and q > 0:
                clean_p.append(float(p))
                clean_q.append(float(q))
            else:
                dropped += 1

        self.dropped_records = dropped
        self.sample_size = len(clean_p)

        # Diagnostic 1: Sample size threshold
        if self.sample_size < 3:
            self.is_fitted = False
            self.diagnostics = {
                "error": "insufficient_sample_size",
                "message": f"Sample size {self.sample_size} is too small for regression (minimum 3 required).",
                "sample_size": self.sample_size,
                "dropped_records": dropped
            }
            return self

        # Natural log transformations
        ln_p = [math.log(p) for p in clean_p]
        ln_q = [math.log(q) for q in clean_q]

        mean_ln_p = sum(ln_p) / self.sample_size
        mean_ln_q = sum(ln_q) / self.sample_size

        # Sums of squares
        ss_xx = sum((x - mean_ln_p) ** 2 for x in ln_p)
        ss_yy = sum((y - mean_ln_q) ** 2 for y in ln_q)
        ss_xy = sum((x - mean_ln_p) * (y - mean_ln_q) for x, y in zip(ln_p, ln_q))

        # Diagnostic 2: Zero variance in price check
        # If all prices are identical, ss_xx == 0 and elasticity cannot be identified
        if ss_xx <= 1e-12:
            self.is_fitted = False
            distinct_p = sorted(list(set(clean_p)))
            self.diagnostics = {
                "error": "zero_price_variance",
                "message": (
                    "Price variation is zero (all observed prices are constant). "
                    "Econometric elasticity cannot be identified without price movement."
                ),
                "distinct_prices": distinct_p,
                "price_range": (min(clean_p), max(clean_p)),
                "sample_size": self.sample_size
            }
            return self

        # OLS parameter estimates
        epsilon = ss_xy / ss_xx
        alpha = mean_ln_q - (epsilon * mean_ln_p)

        # Residuals and standard error
        residuals = [y - (alpha + epsilon * x) for x, y in zip(ln_p, ln_q)]
        df = self.sample_size - 2
        ss_res = sum(r ** 2 for r in residuals)
        s_squared = ss_res / max(1, df)
        se_epsilon = math.sqrt(s_squared / ss_xx)

        # R-squared
        r_squared = (ss_xy ** 2) / (ss_xx * ss_yy) if (ss_xx * ss_yy) > 0 else 0.0

        # t-statistic and approximate p-value
        t_stat = epsilon / se_epsilon if se_epsilon > 0 else 0.0
        p_val = approx_t_pvalue(t_stat, df)

        # 95% Confidence Interval (approx. critical t ~ 2.0 for df >= 10)
        t_crit = 2.228 if df < 10 else 2.042 if df < 30 else 1.960
        ci_lower = round(epsilon - t_crit * se_epsilon, 4)
        ci_upper = round(epsilon + t_crit * se_epsilon, 4)

        self.elasticity = round(epsilon, 4)
        self.intercept = round(alpha, 4)
        self.std_error = round(se_epsilon, 4)
        self.r_squared = round(r_squared, 4)
        self.t_stat = round(t_stat, 3)
        self.p_value = round(p_val, 4)
        self.conf_interval_95 = (ci_lower, ci_upper)
        self.is_fitted = True

        self.diagnostics = {
            "sample_size": self.sample_size,
            "degrees_of_freedom": df,
            "dropped_records": self.dropped_records,
            "r_squared": self.r_squared,
            "std_error": self.std_error,
            "t_statistic": self.t_stat,
            "p_value": self.p_value,
            "conf_interval_95": self.conf_interval_95,
            "price_variance": round(ss_xx / self.sample_size, 6),
            "demand_variance": round(ss_yy / self.sample_size, 6)
        }

        return self

    def predict_demand(self, price: float) -> Optional[float]:
        """Predicts expected demand Q given a price P: Q = exp(alpha) * P^epsilon."""
        if not self.is_fitted or price <= 0:
            return None
        ln_p = math.log(price)
        ln_q = self.intercept + (self.elasticity * ln_p)
        return max(1.0, math.exp(ln_q))
