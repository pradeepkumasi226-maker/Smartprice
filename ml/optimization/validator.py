"""
SmartPrice ML Optimization - Elasticity Reliability Validator & Diagnostics

Evaluates the statistical reliability, data sufficiency, and economic plausibility
of estimated price elasticity models. Identifies observational data limitations
such as omitted variable bias, simultaneous supply/demand shifts, and price endogeneity.
"""
import math
from typing import Dict, List, Optional, Any
from ..config.elasticity_config import ElasticityConfig

class ElasticityValidator:
    def __init__(self, config: Optional[ElasticityConfig] = None):
        self.config = config or ElasticityConfig()

    def validate_raw_data(self, prices: List[float], quantities: List[float]) -> Dict[str, Any]:
        """
        Validates raw price and sales volume inputs before attempting regression.
        """
        reasons: List[str] = []
        valid_pairs: List[tuple] = []

        if not prices or not quantities:
            return {
                "is_valid": False,
                "reason": "Input prices or quantities are empty.",
                "sample_size": 0,
                "distinct_prices": 0,
                "price_cv": 0.0
            }

        for p, q in zip(prices, quantities):
            if p is not None and q is not None and p > 0 and q > 0:
                valid_pairs.append((float(p), float(q)))

        sample_size = len(valid_pairs)
        if sample_size < self.config.min_observations:
            reasons.append(
                f"Sample size ({sample_size}) is below minimum threshold ({self.config.min_observations})."
            )

        clean_prices = [p for p, _ in valid_pairs]
        distinct_prices = sorted(list(set(clean_prices)))
        num_distinct = len(distinct_prices)

        price_cv = 0.0
        if sample_size > 1:
            mean_p = sum(clean_prices) / sample_size
            var_p = sum((p - mean_p) ** 2 for p in clean_prices) / (sample_size - 1)
            std_p = math.sqrt(var_p)
            price_cv = (std_p / mean_p) if mean_p > 0 else 0.0

        if num_distinct < self.config.min_distinct_prices:
            reasons.append(
                f"Constant or near-constant pricing: only {num_distinct} distinct price point(s) observed. "
                "Elasticity cannot be econometrically identified without price movement."
            )
        elif price_cv < self.config.min_price_cv:
            reasons.append(
                f"Price variation is too small: coefficient of variation {price_cv:.4f} < {self.config.min_price_cv}."
            )

        is_valid = len(reasons) == 0
        return {
            "is_valid": is_valid,
            "sample_size": sample_size,
            "distinct_prices": num_distinct,
            "price_range": (min(clean_prices), max(clean_prices)) if clean_prices else (0.0, 0.0),
            "price_cv": round(price_cv, 4),
            "warnings": reasons
        }

    def assess_reliability(
        self,
        regression_diagnostics: Dict[str, Any],
        sku: str,
        catalog_fallback: float
    ) -> Dict[str, Any]:
        """
        Assesses whether a fitted elasticity model meets reliability criteria for automated pricing.
        If unreliable, explicitly categorizes the cause and dictates fallback usage.
        """
        # Case 1: Regression failed to fit (e.g. constant prices or zero sample)
        if "error" in regression_diagnostics:
            err = regression_diagnostics["error"]
            if err == "zero_price_variance":
                status = "UNRELIABLE_CONSTANT_PRICE"
                explanation = (
                    "Observed historical sales have zero price variance (constant shelf price). "
                    "Econometric slope beta1 = Cov(ln P, ln Q) / Var(ln P) is mathematically undefined."
                )
            else:
                status = "UNRELIABLE_INSUFFICIENT_DATA"
                explanation = regression_diagnostics.get("message", "Insufficient observations.")

            return {
                "sku": sku,
                "reliability_status": status,
                "is_reliable": False,
                "recommended_elasticity": catalog_fallback,
                "source": "fallback_catalog",
                "explanation": explanation,
                "observational_limitations": self._get_limitations_notice()
            }

        epsilon = regression_diagnostics.get("elasticity")
        p_val = regression_diagnostics.get("p_value", 1.0)
        se = regression_diagnostics.get("std_error", 999.0)
        sample_size = regression_diagnostics.get("sample_size", 0)

        # Case 2: Positive elasticity anomaly (Upward sloping demand curve)
        # Often caused by omitted variables (e.g. festive surges coinciding with high prices)
        if epsilon is not None and epsilon > 0:
            return {
                "sku": sku,
                "reliability_status": "UNRELIABLE_POSITIVE_ELASTICITY",
                "is_reliable": False,
                "fitted_elasticity": epsilon,
                "recommended_elasticity": catalog_fallback,
                "source": "fallback_catalog",
                "explanation": (
                    f"Fitted elasticity is positive (+{epsilon:.2f}), violating the Law of Demand. "
                    "This reflects omitted variable bias (e.g. peak seasonal demand coinciding with peak prices) "
                    "rather than genuine price responsiveness."
                ),
                "observational_limitations": self._get_limitations_notice()
            }

        # Case 3: Extreme value beyond economic plausibility
        if epsilon is not None and (
            epsilon < self.config.min_plausible_elasticity or epsilon > self.config.max_plausible_elasticity
        ):
            return {
                "sku": sku,
                "reliability_status": "UNRELIABLE_EXTREME_VALUE",
                "is_reliable": False,
                "fitted_elasticity": epsilon,
                "recommended_elasticity": catalog_fallback,
                "source": "fallback_catalog",
                "explanation": (
                    f"Fitted elasticity ({epsilon:.2f}) falls outside plausible retail bounds "
                    f"[{self.config.min_plausible_elasticity}, {self.config.max_plausible_elasticity}]."
                ),
                "observational_limitations": self._get_limitations_notice()
            }

        # Case 4: High statistical uncertainty / insignificance
        se_ratio = (se / abs(epsilon)) if (epsilon and abs(epsilon) > 0) else 1.0
        if p_val > self.config.max_p_value or se_ratio > self.config.max_std_err_ratio:
            return {
                "sku": sku,
                "reliability_status": "UNRELIABLE_INSIGNIFICANT",
                "is_reliable": False,
                "fitted_elasticity": epsilon,
                "recommended_elasticity": catalog_fallback,
                "source": "fallback_catalog",
                "explanation": (
                    f"Fitted elasticity ({epsilon:.2f}) is not statistically distinguishable from zero "
                    f"(p-value = {p_val:.3f} > {self.config.max_p_value}, SE ratio = {se_ratio:.2f})."
                ),
                "observational_limitations": self._get_limitations_notice()
            }

        # Case 5: Fully reliable econometric estimate
        return {
            "sku": sku,
            "reliability_status": "RELIABLE_FITTED",
            "is_reliable": True,
            "fitted_elasticity": epsilon,
            "recommended_elasticity": epsilon,
            "source": "fitted_log_log_model",
            "confidence_interval_95": regression_diagnostics.get("conf_interval_95"),
            "r_squared": regression_diagnostics.get("r_squared"),
            "p_value": p_val,
            "explanation": f"Fitted log-log regression passed all econometric stability and significance guardrails (epsilon = {epsilon:.2f}).",
            "observational_limitations": self._get_limitations_notice()
        }

    @staticmethod
    def _get_limitations_notice() -> str:
        return (
            "Caution regarding observational retail data: Estimated regression coefficients reflect "
            "historical conditional associations. Observational price changes may be confounded by "
            "simultaneous promotional marketing campaigns, stockouts, supply shifts, and seasonal footfall. "
            "Coefficients should not be interpreted as pure causal elasticity without exogenous price experiments (A/B testing)."
        )
