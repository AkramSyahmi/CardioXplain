"""Token login (NFR04): signed tokens sent as `Authorization: Bearer <token>` (CHANGES.md #15)."""
import hashlib
from functools import wraps

from flask import current_app, g, jsonify, request
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app import db
from app.models import User


def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="auth-token")


def _password_fingerprint(user):
    """Short value that changes when the password changes, so a reset ends old sessions."""
    return hashlib.sha256(user.password_hash.encode()).hexdigest()[:16]


def make_token(user):
    return _serializer().dumps({"user_id": user.user_id, "pw": _password_fingerprint(user)})


def login_required(role=None):
    """Allow the request only for a logged-in, active user (and the given role, if any).

    The user is loaded again on every request, so a deactivated account stops working at once.
    """
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""
            try:
                data = _serializer().loads(token, max_age=current_app.config["TOKEN_MAX_AGE_SECONDS"])
            except BadSignature:  # also covers expired tokens (SignatureExpired)
                return jsonify(error="Please log in again."), 401

            user = db.session.get(User, data.get("user_id"))
            if (user is None or user.status != "active"
                    or data.get("pw") != _password_fingerprint(user)):
                return jsonify(error="Please log in again."), 401
            if role and user.role != role:
                return jsonify(error="You do not have permission to access this page."), 403

            g.user = user
            return view(*args, **kwargs)
        return wrapper
    return decorator
