"""SHAP explanation in probability mode (section 3.2.7, CHANGES.md #13)."""
from functools import cache

import pandas as pd
import shap

from app.services.ml_service import MODEL_DIR, load_model, model_probability, predict_probability, to_frame
from ml.features import FEATURE_LABELS, FEATURES


@cache
def _explainer():
    background = pd.read_csv(MODEL_DIR / "shap_background.csv")
    return shap.TreeExplainer(load_model(), data=background, model_output="probability",
                              feature_perturbation="interventional")


def baseline():
    """Average predicted probability of the background people (the SHAP starting point)."""
    return float(_explainer().expected_value)


def explain(values):
    """All 12 features with their SHAP value (change in probability), biggest effect first."""
    shap_values = _explainer().shap_values(to_frame(values))[0]
    # The Framingham smoking adjustment (CHANGES.md #29) belongs to the Smoking row, so the rows
    # still add up to the final risk.
    extra = predict_probability(values) - model_probability(values)
    items = [{"feature": name, "label": FEATURE_LABELS[name], "value": values[name],
              "shap": round(float(value) + (extra if name == "smoke" else 0), 4)}
             for name, value in zip(FEATURES, shap_values)]
    if extra:
        next(item for item in items if item["feature"] == "smoke")["adjusted"] = True
    return sorted(items, key=lambda item: abs(item["shap"]), reverse=True)
