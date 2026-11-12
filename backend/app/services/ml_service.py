"""Risk prediction with the trained XGBoost model (section 3.2.9.3)."""
from functools import cache
from pathlib import Path

import pandas as pd
from xgboost import XGBClassifier

from ml.features import FEATURES, GENDER_CODES

MODEL_DIR = Path(__file__).resolve().parents[2] / "ml" / "output"


@cache
def load_model():
    model = XGBClassifier()
    model.load_model(MODEL_DIR / "model.json")
    return model


def to_frame(values):
    """One-row table in the model's feature order, with gender coded as in the dataset."""
    row = {**values, "gender": GENDER_CODES[values["gender"]]}
    return pd.DataFrame([[row[name] for name in FEATURES]], columns=FEATURES)


def predict_probability(values):
    return float(load_model().predict_proba(to_frame(values))[0, 1])
