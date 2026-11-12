"""Administrator functions: UC-900 Monitor Model Performance (and UC-800 User Management)."""
import json

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

from app import db
from app.auth import login_required
from app.models import Prediction, SystemLog, User, log_event
from app.routes.auth import account_problems, user_to_dict
from app.services.ml_service import MODEL_DIR
from app.validation import password_problem, read_json

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/metrics")
@login_required("admin")
def metrics():
    """Model results on the unseen test set (UC-900 step 3). Read-only."""
    try:
        return jsonify(metrics=json.loads((MODEL_DIR / "metrics.json").read_text()),
                       training=json.loads((MODEL_DIR / "training_summary.json").read_text()))
    except FileNotFoundError:  # model not trained yet (run ml/train_model.py)
        return jsonify(error="Model metrics are not available yet."), 503


@admin_bp.get("/stats")
@login_required("admin")
def stats():
    """Anonymous usage counts (UC-900 step 4). No personal or health data."""
    distribution = dict(db.session.query(Prediction.risk_category, func.count())
                        .group_by(Prediction.risk_category).all())
    llm = SystemLog.query.filter_by(action="LLM_CALL")
    return jsonify(
        total_users=User.query.count(),
        total_assessments=Prediction.query.count(),
        risk_distribution={name: distribution.get(name, 0) for name in ("Low", "Moderate", "High")},
        llm_calls={"success": llm.filter(SystemLog.description.like("success%")).count(),
                   "failed": llm.filter(SystemLog.description.like("failed%")).count()},
    )


@admin_bp.get("/logs")
@login_required("admin")
def logs():
    """Recent system activity (UC-900 step 5), newest first."""
    limit = min(max(request.args.get("limit", 50, type=int), 1), 200)
    rows = SystemLog.query.order_by(SystemLog.timestamp.desc(), SystemLog.log_id.desc()).limit(limit).all()
    return jsonify(logs=[{"log_id": r.log_id, "user_id": r.user_id, "action": r.action,
                          "description": r.description, "timestamp": r.timestamp.isoformat()}
                         for r in rows])


# ---- UC-800 Manage User Accounts (Table 3.24) ----

ROLES = ("admin", "general_user")
STATUSES = ("active", "inactive")


def admin_user_dict(user):
    return {**user_to_dict(user), "status": user.status, "created_at": user.created_at.isoformat()}


def _other_active_admins(user):
    return User.query.filter(User.role == "admin", User.status == "active",
                             User.user_id != user.user_id).count()


@admin_bp.get("/users")
@login_required("admin")
def list_users():
    return jsonify(users=[admin_user_dict(u) for u in User.query.order_by(User.user_id).all()])


@admin_bp.get("/users/<int:user_id>")
@login_required("admin")
def user_detail(user_id):
    """Profile and activity summary only; admins cannot see users' health data (UC-800 constraint)."""
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify(error="User not found."), 404
    return jsonify(**admin_user_dict(user),
                   assessment_count=Prediction.query.filter_by(user_id=user_id).count())


@admin_bp.post("/users")
@login_required("admin")
def create_user():
    """Create an account with a temporary password (replaces the registration email, CHANGES.md #17)."""
    data = read_json() or {}
    values, fields = account_problems(data)
    role = data.get("role")
    if role not in ROLES:
        fields["role"] = "Please choose a valid role."
    if fields:
        return jsonify(error="Please correct the highlighted fields.", fields=fields), 400
    if User.query.filter_by(email=values["email"]).first():
        return jsonify(error="This email is already registered."), 409

    user = User(full_name=values["full_name"], email=values["email"], role=role, status="active",
                password_hash=generate_password_hash(values["password"]))
    db.session.add(user)
    try:
        db.session.flush()
    except IntegrityError:  # same email saved at the same moment
        db.session.rollback()
        return jsonify(error="This email is already registered."), 409
    log_event("CREATE_USER", f"user_id={user.user_id} role={role}", user_id=g.user.user_id)
    db.session.commit()
    return jsonify(user=admin_user_dict(user)), 201


@admin_bp.patch("/users/<int:user_id>")
@login_required("admin")
def update_user(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify(error="User not found."), 404
    data = read_json() or {}
    if not data:
        return jsonify(error="Please choose a change to make."), 400
    if set(data) - {"role", "status", "password"}:
        return jsonify(error="Only role, status and password can be changed."), 400

    fields = {}
    if "role" in data and data["role"] not in ROLES:
        fields["role"] = "Please choose a valid role."
    if "status" in data and data["status"] not in STATUSES:
        fields["status"] = "Please choose Active or Inactive."
    if "password" in data:
        password = data["password"] if isinstance(data["password"], str) else ""
        if problem := password_problem(password):
            fields["password"] = problem
    if fields:
        return jsonify(error="Please correct the highlighted fields.", fields=fields), 400

    new_role = data.get("role", user.role)
    new_status = data.get("status", user.status)
    if user.user_id == g.user.user_id and new_status == "inactive":
        return jsonify(error="You cannot deactivate your own administrator account."), 400
    # UC-800 rule: at least one active administrator must always exist.
    loses_admin = user.role == "admin" and user.status == "active" and (new_role != "admin" or new_status != "active")
    if loses_admin and _other_active_admins(user) == 0:
        return jsonify(error="At least one active administrator account must exist."), 400

    if new_role != user.role:
        log_event("CHANGE_ROLE", f"user_id={user.user_id} {user.role}->{new_role}", user_id=g.user.user_id)
        user.role = new_role
    if new_status != user.status:
        action = "DEACTIVATE_USER" if new_status == "inactive" else "ACTIVATE_USER"
        log_event(action, f"user_id={user.user_id}", user_id=g.user.user_id)
        user.status = new_status
    if "password" in data:
        user.password_hash = generate_password_hash(data["password"])
        log_event("RESET_PASSWORD", f"user_id={user.user_id}", user_id=g.user.user_id)
    db.session.commit()
    return jsonify(user=admin_user_dict(user))
