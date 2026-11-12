"""Input validation rules shared by the backend (use case descriptions, Chapter 3.5)."""
import math
import re

from flask import request

from ml.features import GENDER_CODES, VALID_RANGES


def password_problem(password):
    """UC-100 rule: at least 8 characters with uppercase, lowercase, and a number.

    Returns an error message, or None if the password is valid.
    """
    if (len(password) < 8 or not re.search(r"[A-Z]", password)
            or not re.search(r"[a-z]", password) or not re.search(r"\d", password)):
        return "Password must contain at least 8 characters including uppercase, lowercase, and a number."
    return None


def read_json():
    """Return the request body as a dict, or None if it is missing or not a JSON object."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else None


REQUIRED = "This field is required."
NOT_A_NUMBER = "Please enter a number."
NOT_WHOLE = "Please enter a whole number."
RANGE_MESSAGES = {
    "age": "Age must be between {low} and {high} years.",
    "height": "Height must be between {low} and {high} cm.",
    "weight": "Weight must be between {low} and {high} kg.",
    "ap_hi": "Systolic blood pressure must be between {low} and {high} mmHg.",
    "ap_lo": "Diastolic blood pressure must be between {low} and {high} mmHg.",
}
WHOLE_NUMBER_FIELDS = {"age", "ap_hi", "ap_lo"}
LEVEL_MESSAGES = {
    "cholesterol": "Please choose a cholesterol level (Normal, Above normal, or Well above normal).",
    "gluc": "Please choose a glucose level (Normal, Above normal, or Well above normal).",
}
YES_NO_FIELDS = ("smoke", "alco", "active")


def _number(value):
    """Return a float from a number or numeric string, or None. Booleans are not numbers here."""
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):  # OverflowError: a number with hundreds of digits
        return None
    return number if math.isfinite(number) else None


def assessment_problems(data):
    """Validate the risk assessment form (UC-200 E1, Table 3.30 with CHANGES.md #11).

    Returns (clean_values, field_errors). clean_values includes the calculated BMI.
    """
    values, fields = {}, {}

    for name, (low, high) in VALID_RANGES.items():
        raw = data.get(name)
        number = _number(raw)
        if raw is None or raw == "":
            fields[name] = REQUIRED
        elif number is None:
            fields[name] = NOT_A_NUMBER
        elif name in WHOLE_NUMBER_FIELDS and not number.is_integer():
            fields[name] = NOT_WHOLE
        elif not low <= number <= high:
            fields[name] = RANGE_MESSAGES[name].format(low=low, high=high)
        else:
            values[name] = int(number) if name in WHOLE_NUMBER_FIELDS else number

    if "ap_hi" in values and "ap_lo" in values and values["ap_lo"] > values["ap_hi"]:
        fields["ap_lo"] = "Diastolic blood pressure cannot be higher than systolic blood pressure."

    gender = data.get("gender")
    if isinstance(gender, str) and gender.strip().lower() in GENDER_CODES:
        values["gender"] = gender.strip().lower()
    else:
        fields["gender"] = "Please choose Male or Female."

    for name, message in LEVEL_MESSAGES.items():
        number = _number(data.get(name))
        if number in (1, 2, 3):
            values[name] = int(number)
        else:
            fields[name] = message

    for name in YES_NO_FIELDS:
        raw = data.get(name)
        if isinstance(raw, bool):
            values[name] = int(raw)
        elif _number(raw) in (0, 1):
            values[name] = int(_number(raw))
        else:
            fields[name] = "Please choose Yes or No."

    if "height" in values and "weight" in values:
        values["bmi"] = round(values["weight"] / (values["height"] / 100) ** 2, 2)
    return values, fields
