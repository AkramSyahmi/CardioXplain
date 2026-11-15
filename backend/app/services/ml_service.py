"""Risk prediction with the trained XGBoost model (section 3.2.9.3)."""
import json
import math
from functools import cache
from pathlib import Path

import pandas as pd
from xgboost import XGBClassifier

from ml.features import FEATURES, GENDER_CODES

MODEL_DIR = Path(__file__).resolve().parents[2] / "ml" / "output"

# Smoking effect from the Framingham Heart Study data (CHANGES.md #29, ml/framingham_smoking.py).
# The Kaggle data shows smokers with less heart disease, so the main model learns almost no smoking
# effect; this adds the Framingham effect (adjusted for age, sex, BP, cholesterol, BMI, glucose) on top.
_FRAMINGHAM = json.loads((MODEL_DIR / "framingham_smoking.json").read_text())
PER_CIGARETTE = _FRAMINGHAM["per_cigarette_per_day"]["log_odds"]
PER_SMOKER = _FRAMINGHAM["smoker_vs_non_smoker"]["log_odds"]  # assessments saved with Yes/No only
MAX_CIGARETTES = 40  # few people in the data smoke more, so heavier smoking counts as 40


@cache
def load_model():
    model = XGBClassifier()
    model.load_model(MODEL_DIR / "model.json")
    return model


def to_frame(values):
    """One-row table in the model's feature order, with gender coded as in the dataset."""
    row = {**values, "gender": GENDER_CODES[values["gender"]]}
    return pd.DataFrame([[row[name] for name in FEATURES]], columns=FEATURES)


def model_probability(values):
    """The XGBoost model's own probability, before the smoking adjustment."""
    return float(load_model().predict_proba(to_frame(values))[0, 1])


def smoking_log_odds(values):
    """How much smoking raises the log-odds: per cigarette when the amount is known, else Yes/No."""
    cigarettes = values.get("cigarettes_per_day")
    if cigarettes is not None:
        return PER_CIGARETTE * min(cigarettes, MAX_CIGARETTES)
    return PER_SMOKER if values["smoke"] else 0.0


def predict_probability(values):
    """Final risk: the model's probability with the smoking effect added on the log-odds scale."""
    p = model_probability(values)
    shift = smoking_log_odds(values)
    if shift == 0:
        return p
    return 1 / (1 + math.exp(-(math.log(p / (1 - p)) + shift)))
