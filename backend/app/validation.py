"""Input validation rules shared by the backend (use case descriptions, Chapter 3.5)."""
import re

from flask import request


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
