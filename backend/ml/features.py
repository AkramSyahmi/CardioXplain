"""Settings shared by model training (ml/train_model.py) and the backend (app/services).

Keeping them in one place guarantees the form, the cleaning rules and the model use the same values.
"""
import math

# Model input features (Table 3.35), in the order the model expects them.
FEATURES = ["age", "gender", "height", "weight", "bmi", "ap_hi", "ap_lo",
            "cholesterol", "gluc", "smoke", "alco", "active"]
TARGET = "cardio"

# Dataset codes gender as 1/2. Mean height is 161 cm for 1 and 170 cm for 2, so 1 = female.
GENDER_CODES = {"female": 1, "male": 2}

# Valid input ranges. Used for cleaning and for form validation, so the model only
# predicts inside the ranges it was trained on (CHANGES.md #11).
VALID_RANGES = {
    "age": (30, 65),        # dataset only covers ages 30 to 65
    "height": (120, 250),   # under 120 cm is almost always a typing error in this dataset
    "weight": (20, 300),
    "ap_hi": (60, 300),
    "ap_lo": (40, 200),
}

# Plain names shown to users and given to the LLM.
FEATURE_LABELS = {
    "age": "Age", "gender": "Gender", "height": "Height", "weight": "Weight",
    "bmi": "Body mass index (BMI)", "ap_hi": "Systolic blood pressure",
    "ap_lo": "Diastolic blood pressure", "cholesterol": "Cholesterol level",
    "gluc": "Glucose level", "smoke": "Smoking", "alco": "Alcohol intake",
    "active": "Physical activity",
}


def risk_category(score):
    """Risk category thresholds from Table 3.36."""
    if score < 0.40:
        return "Low"
    if score < 0.70:
        return "Moderate"
    return "High"


def risk_percent(score):
    """Whole percent shown to users, rounded down so it never crosses a category threshold
    (0.3951 is 39% Low, not 40%). Rounding to 6 places first removes float noise (0.29 * 100)."""
    return math.floor(round(score * 100, 6))
