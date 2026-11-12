"""UC-100 Register & Login (Table 3.17)."""
import re

from flask import Blueprint, g, jsonify
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from app import db
from app.auth import login_required, make_token
from app.models import User, log_event
from app.validation import password_problem, read_json

auth_bp = Blueprint("auth", __name__)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def user_to_dict(user):
    return {"user_id": user.user_id, "full_name": user.full_name,
            "email": user.email, "role": user.role}


def _text(data, key):
    value = data.get(key)
    return value.strip() if isinstance(value, str) else ""


def account_problems(data):
    """Check name, email and password (UC-100 E1). Returns (clean_values, field_errors)."""
    full_name = _text(data, "full_name")
    email = _text(data, "email").lower()
    password = data.get("password") if isinstance(data.get("password"), str) else ""

    fields = {}
    if not full_name:
        fields["full_name"] = "Please enter your full name."
    elif len(full_name) > 100:
        fields["full_name"] = "Full name must be 100 characters or fewer."
    if not email:
        fields["email"] = "Please enter your email address."
    elif len(email) > 150 or not EMAIL_PATTERN.match(email):
        fields["email"] = "Please enter a valid email address."
    if problem := password_problem(password):
        fields["password"] = problem
    return {"full_name": full_name, "email": email, "password": password}, fields


@auth_bp.post("/register")
def register():
    values, fields = account_problems(read_json() or {})
    if fields:
        return jsonify(error="Please correct the highlighted fields.", fields=fields), 400
    if User.query.filter_by(email=values["email"]).first():
        return jsonify(error="This email is already registered."), 409

    # Public registration always creates a General User; admins are created separately (CHANGES.md #10).
    user = User(full_name=values["full_name"], email=values["email"], role="general_user",
                status="active", password_hash=generate_password_hash(values["password"]))
    db.session.add(user)
    try:
        db.session.flush()
    except IntegrityError:  # same email registered at the same moment
        db.session.rollback()
        return jsonify(error="This email is already registered."), 409
    log_event("REGISTER", user_id=user.user_id)
    db.session.commit()
    return jsonify(message="Registration successful. Please log in."), 201


@auth_bp.post("/login")
def login():
    data = read_json() or {}
    email = _text(data, "email").lower()
    password = data.get("password") if isinstance(data.get("password"), str) else ""

    user = User.query.filter_by(email=email).first() if email else None
    if user is None or not check_password_hash(user.password_hash, password):
        # Same message for wrong email and wrong password, so emails cannot be guessed (UC-100 E2).
        log_event("LOGIN_FAILED", "Invalid email or password")
        db.session.commit()
        return jsonify(error="Invalid email or password"), 401
    if user.status != "active":
        return jsonify(error="This account has been deactivated."), 403

    log_event("LOGIN", user_id=user.user_id)
    db.session.commit()
    return jsonify(token=make_token(user), user=user_to_dict(user))


@auth_bp.get("/me")
@login_required()
def me():
    return jsonify(user=user_to_dict(g.user))
