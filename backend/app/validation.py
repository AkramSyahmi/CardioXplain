"""Input validation rules shared by the backend (use case descriptions, Chapter 3.5)."""
import re


def password_problem(password):
    """UC-100 rule: at least 8 characters with uppercase, lowercase, and a number.

    Returns an error message, or None if the password is valid.
    """
    if (len(password) < 8 or not re.search(r"[A-Z]", password)
            or not re.search(r"[a-z]", password) or not re.search(r"\d", password)):
        return "Password must contain at least 8 characters including uppercase, lowercase, and a number."
    return None
