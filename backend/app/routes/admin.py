"""Administrator functions: UC-900 Monitor Model Performance (and UC-800 User Management)."""
import json

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app import db
from app.auth import login_required
from app.models import Prediction, SystemLog, User
from app.services.ml_service import MODEL_DIR

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/metrics")
@login_required("admin")
def metrics():
    """Model results on the unseen test set (UC-900 step 3). Read-only."""
    return jsonify(metrics=json.loads((MODEL_DIR / "metrics.json").read_text()),
                   training=json.loads((MODEL_DIR / "training_summary.json").read_text()))


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
