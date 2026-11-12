"""UC-1000 View Personalised Health Action Plan (Table 3.26)."""
from flask import Blueprint, g, jsonify
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app import db
from app.auth import login_required
from app.models import HealthPlan, latest_prediction, log_event
from app.routes.simulation import CHANGEABLE, NO_ASSESSMENT
from app.services.llm_service import DISCLAIMER, LLMUnavailable, health_plan
from app.validation import assessment_problems, read_json

action_plan_bp = Blueprint("action_plan", __name__)

UNAVAILABLE = "Health Action Plan is currently unavailable. Please try again later."


def _plan_dict(plan):
    return {"plan_text": plan.plan_text, "generated_at": plan.generated_at.isoformat(),
            "prediction_id": plan.prediction_id}


@action_plan_bp.get("")
@login_required("general_user")
def get_plan():
    prediction = latest_prediction(g.user.user_id)
    if prediction is None:
        return jsonify(error=NO_ASSESSMENT), 404
    if prediction.health_plan is None:
        return jsonify(error="No health action plan yet."), 404
    return jsonify(plan=_plan_dict(prediction.health_plan), disclaimer=DISCLAIMER)


@action_plan_bp.post("")
@login_required("general_user")
def create_plan():
    prediction = latest_prediction(g.user.user_id)
    if prediction is None:
        return jsonify(error=NO_ASSESSMENT), 404

    # A1: lifestyle values from the What-If simulator replace the assessment values.
    changes = (read_json() or {}).get("lifestyle") or {}
    if not isinstance(changes, dict) or set(changes) - set(CHANGEABLE):
        return jsonify(error="Only physical activity, smoking, alcohol and weight can be changed in the simulator."), 400
    values, fields = assessment_problems({**prediction.inputs.to_dict(), **changes})
    if fields:
        return jsonify(error="Please correct the highlighted fields.", fields=fields), 400

    top = (prediction.shap.all_shap_values if prediction.shap else [])[:3]
    lifestyle = {name: values[name] for name in ("smoke", "alco", "active", "weight", "bmi")}
    try:
        text = health_plan(prediction.risk_category, prediction.risk_score, top, lifestyle)
    except LLMUnavailable:
        db.session.commit()  # keep the LLM_CALL log
        return jsonify(error=UNAVAILABLE, risk_score=prediction.risk_score,
                       risk_category=prediction.risk_category), 503

    # One plan per prediction (ERD): generating again replaces the old plan.
    plan = prediction.health_plan
    if plan is None:
        plan = HealthPlan(prediction_id=prediction.prediction_id, plan_text=text)
        db.session.add(plan)
    else:
        plan.plan_text = text
        plan.generated_at = func.now()
    log_event("HEALTH_PLAN", f"prediction_id={prediction.prediction_id}", user_id=g.user.user_id)
    try:
        db.session.commit()
    except IntegrityError:  # another request saved a plan at the same moment: replace it instead
        db.session.rollback()
        plan = HealthPlan.query.filter_by(prediction_id=prediction.prediction_id).one()
        plan.plan_text = text
        plan.generated_at = func.now()
        log_event("HEALTH_PLAN", f"prediction_id={prediction.prediction_id}", user_id=g.user.user_id)
        db.session.commit()
    db.session.refresh(plan)
    return jsonify(plan=_plan_dict(plan), disclaimer=DISCLAIMER), 201
