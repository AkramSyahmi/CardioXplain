"""UC-600 View Prediction History (Table 3.22). Read-only."""
from flask import Blueprint, g, jsonify

from app.auth import login_required
from app.models import Prediction
from app.services.llm_service import DISCLAIMER
from ml.features import risk_percent

history_bp = Blueprint("history", __name__)


def _summary(p):
    return {"prediction_id": p.prediction_id, "prediction_date": p.prediction_date.isoformat(),
            "risk_score": p.risk_score, "risk_percent": risk_percent(p.risk_score),
            "risk_category": p.risk_category}


def prediction_to_dict(p):
    """Full stored result, in the same shape as the POST /api/predict response."""
    return {**_summary(p),
            "inputs": p.inputs.to_dict(),
            "estimated_fields": p.estimated_fields or [],
            "shap": p.shap.all_shap_values if p.shap else None,
            "narrative": {"text": p.narrative.narrative_text} if p.narrative else None,
            "disclaimer": DISCLAIMER}


@history_bp.get("")
@login_required("general_user")
def list_history():
    predictions = (Prediction.query.filter_by(user_id=g.user.user_id)
                   .order_by(Prediction.prediction_date.desc(), Prediction.prediction_id.desc()).all())
    if not predictions:
        return jsonify(predictions=[], message="No prediction history found. Please complete a Risk Assessment.")
    return jsonify(predictions=[_summary(p) for p in predictions])


@history_bp.get("/<int:prediction_id>")
@login_required("general_user")
def history_detail(prediction_id):
    # Someone else's record looks exactly like a missing one, so ids cannot be probed.
    p = Prediction.query.filter_by(prediction_id=prediction_id, user_id=g.user.user_id).first()
    if p is None:
        return jsonify(error="Prediction not found."), 404
    return jsonify(prediction_to_dict(p))
