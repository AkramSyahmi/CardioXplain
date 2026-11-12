"""UC-700 Use Virtual Care Navigator (Table 3.23). Conversations are not stored."""
from flask import Blueprint, g, jsonify

from app import db
from app.auth import login_required
from app.models import latest_prediction, log_event
from app.services.llm_service import DISCLAIMER, LLMUnavailable, navigator_reply
from app.validation import read_json

navigator_bp = Blueprint("navigator", __name__)

MAX_QUESTION = 1000
MAX_HISTORY = 10


def _clean_history(history):
    """Keep only user/assistant text messages (a 'system' message could override the safety rules)."""
    if not isinstance(history, list):
        return []
    cleaned = [{"role": m["role"], "content": m["content"][:MAX_QUESTION]} for m in history
               if isinstance(m, dict) and m.get("role") in ("user", "assistant")
               and isinstance(m.get("content"), str) and m["content"].strip()]
    return cleaned[-MAX_HISTORY:]


@navigator_bp.post("")
@login_required("general_user")
def ask():
    data = read_json() or {}
    message = data.get("message")
    if not isinstance(message, str) or not message.strip():
        return jsonify(error="Please type a question."), 400
    if len(message) > MAX_QUESTION:
        return jsonify(error="Please keep your question under 1000 characters."), 400

    prediction = latest_prediction(g.user.user_id)
    category = prediction.risk_category if prediction else None
    top = (prediction.shap.all_shap_values[:3] if prediction and prediction.shap else None)
    messages = [*_clean_history(data.get("history")), {"role": "user", "content": message.strip()}]
    try:
        reply = navigator_reply(messages, category, top)
    except LLMUnavailable:
        db.session.commit()  # keep the LLM_CALL log
        return jsonify(error="The Virtual Care Navigator is currently unavailable. Please try again later."), 503

    log_event("NAVIGATOR", "question answered", user_id=g.user.user_id)  # no message text (privacy)
    db.session.commit()
    return jsonify(reply=reply, disclaimer=DISCLAIMER)
