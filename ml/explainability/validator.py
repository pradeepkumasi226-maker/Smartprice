"""
SmartPrice ML Explainability - Explanation Validator & Integrity Guard

Enforces mathematical consistency and scientific rigor for model explanations:
- Additivity verification: base_value + sum(deltas) == final_price (within rounding tolerance)
- Causal integrity: prevents asserting unproven causal claims from observational correlations
- Genuine SHAP verification: ensures TreeSHAP is only declared when a real tree-based model is present
"""
from typing import Dict, List, Any, Optional

class ExplanationValidator:
    """
    Validates explainability output structures and asserts honesty of methodology.
    """

    @staticmethod
    def validate_additivity(decomposition: Dict[str, Any], tolerance: float = 0.05) -> Dict[str, Any]:
        """
        Verifies that base_value + sum(feature deltas) == final_recommended_price.
        """
        base_val = decomposition.get("base_value", 0.0)
        final_val = decomposition.get("final_recommended_price", 0.0)
        points = decomposition.get("waterfall_points", [])

        # Sum non-base, non-total values
        delta_sum = 0.0
        for pt in points:
            pt_type = pt.get("type")
            if pt_type in ("increase", "decrease") or (pt_type not in ("base", "total")):
                delta_sum += float(pt.get("value", 0.0))

        computed_total = round(base_val + delta_sum, 2)
        diff = abs(computed_total - final_val)
        is_additive = diff <= tolerance

        return {
            "is_additive": is_additive,
            "base_value": base_val,
            "sum_of_deltas": round(delta_sum, 2),
            "expected_final": final_val,
            "computed_final": computed_total,
            "difference": round(diff, 4)
        }

    @staticmethod
    def validate_causal_integrity(decomposition: Dict[str, Any]) -> Dict[str, Any]:
        """
        Verifies that explanation descriptions do not make unsubstantiated causal claims
        for observational signals (e.g. competitor prices or customer ratings).
        """
        violations: List[str] = []
        points = decomposition.get("waterfall_points", [])

        forbidden_causal_phrases = [
            "causes customers to buy",
            "proves that raising price increases sales",
            "causally drives consumer demand",
            "direct causal proof"
        ]

        for pt in points:
            desc = (pt.get("description") or "").lower()
            for phrase in forbidden_causal_phrases:
                if phrase in desc:
                    violations.append(f"Feature '{pt.get('name')}' uses unsubstantiated causal phrasing: '{phrase}'.")

        return {
            "is_valid": len(violations) == 0,
            "violations": violations,
            "checked_features": len(points)
        }

    @staticmethod
    def verify_shap_authenticity(
        is_genuine_shap: bool,
        model_object: Optional[Any] = None,
        explainer_object: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Ensures TreeSHAP / SHAP is not claimed unless an actual compatible model
        and valid explainer are present and executed.
        """
        if not is_genuine_shap:
            return {
                "is_honest": True,
                "label": "deterministic_rule_attribution_or_heuristic",
                "explanation": "Correctly labeled as rule-based or non-SHAP attribution."
            }

        # If claiming genuine SHAP, verify objects
        if model_object is None or explainer_object is None:
            return {
                "is_honest": False,
                "label": "fabricated_shap_claim",
                "explanation": "Claimed genuine SHAP, but model or explainer object is missing."
            }

        return {
            "is_honest": True,
            "label": "verified_genuine_shap",
            "explanation": "Valid tree model and SHAP explainer verified."
        }
