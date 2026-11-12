"""UC-1000 View Personalised Health Action Plan (Table 3.26), as a day-by-day calendar (CHANGES.md #25).

The calendar is stored as JSON text in health_plans.plan_text:
{"format": "calendar", "length": 7 | 30, "start_date": "YYYY-MM-DD", "lifestyle": {...},
 "weeks": [{"week": 1, "theme": "...", "days": [{"day": 1, "date": "YYYY-MM-DD", "title": "...",
                                                  "blocks": {"morning": [...], "afternoon": [...], "evening": [...]}}]}]}
A 30-day plan is built one week at a time (POST /next-week); its last week has 2 days.
"""
import json
import math
from datetime import date, timedelta

from flask import Blueprint, g, jsonify
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app import db
from app.auth import login_required
from app.models import HealthPlan, latest_prediction, log_event
from app.routes.simulation import CHANGEABLE, NO_ASSESSMENT
from app.services.llm_service import DISCLAIMER, LLMUnavailable, health_week
from app.validation import assessment_problems, read_json

action_plan_bp = Blueprint("action_plan", __name__)

UNAVAILABLE = "Health Action Plan is currently unavailable. Please try again later."
NO_PLAN = "No health action plan yet."
LENGTHS = (7, 30)
LIFESTYLE_KEYS = ("smoke", "alco", "active", "weight", "bmi", "cigarettes_per_day", "drinks_per_week", "activity_minutes")


def _calendar_of(plan):
    """The stored calendar, or None for an old plain-text plan."""
    try:
        data = json.loads(plan.plan_text)
    except ValueError:
        return None
    return data if isinstance(data, dict) and data.get("format") == "calendar" else None


def _plan_dict(plan):
    return {"plan_text": plan.plan_text, "calendar": _calendar_of(plan),
            "generated_at": plan.generated_at.isoformat(), "prediction_id": plan.prediction_id}


def _add_week(prediction, calendar):
    """Ask the LLM for the next week and append it with day numbers and real dates."""
    done = sum(len(week["days"]) for week in calendar["weeks"])
    days_in_week = min(7, calendar["length"] - done)
    week_number = len(calendar["weeks"]) + 1
    top = (prediction.shap.all_shap_values if prediction.shap else [])[:3]
    week = health_week(prediction.risk_category, prediction.risk_score, top, calendar["lifestyle"],
                       week_number, math.ceil(calendar["length"] / 7), days_in_week,
                       [w["theme"] for w in calendar["weeks"]])
    start = date.fromisoformat(calendar["start_date"])
    for offset, day in enumerate(week["days"]):
        number = done + offset + 1
        day.update(day=number, date=(start + timedelta(days=number - 1)).isoformat())
    calendar["weeks"].append({"week": week_number, "theme": week["theme"], "days": week["days"]})


def _unavailable(prediction):
    db.session.commit()  # keep the LLM_CALL log
    return jsonify(error=UNAVAILABLE, risk_score=prediction.risk_score,
                   risk_category=prediction.risk_category), 503


@action_plan_bp.get("")
@login_required("general_user")
def get_plan():
    prediction = latest_prediction(g.user.user_id)
    if prediction is None:
        return jsonify(error=NO_ASSESSMENT), 404
    if prediction.health_plan is None:
        return jsonify(error=NO_PLAN), 404
    return jsonify(plan=_plan_dict(prediction.health_plan), disclaimer=DISCLAIMER)


@action_plan_bp.post("")
@login_required("general_user")
def create_plan():
    prediction = latest_prediction(g.user.user_id)
    if prediction is None:
        return jsonify(error=NO_ASSESSMENT), 404

    data = read_json() or {}
    length = data.get("length", 7)
    if length not in LENGTHS or isinstance(length, bool):
        return jsonify(error="Please choose a 7-day or 30-day plan."), 400
    # A1: lifestyle values from the What-If simulator replace the assessment values.
    changes = data.get("lifestyle") or {}
    if not isinstance(changes, dict) or set(changes) - set(CHANGEABLE):
        return jsonify(error="Only physical activity, smoking, alcohol and weight can be changed in the simulator."), 400
    values, fields = assessment_problems({**prediction.inputs.to_dict(), **changes})
    if fields:
        return jsonify(error="Please correct the highlighted fields.", fields=fields), 400

    calendar = {"format": "calendar", "length": length, "start_date": date.today().isoformat(),
                "lifestyle": {name: values[name] for name in LIFESTYLE_KEYS}, "weeks": []}
    try:
        _add_week(prediction, calendar)
    except LLMUnavailable:
        return _unavailable(prediction)
    text = json.dumps(calendar)

    # One plan per prediction (ERD): generating again replaces the old plan.
    plan = prediction.health_plan
    if plan is None:
        plan = HealthPlan(prediction_id=prediction.prediction_id, plan_text=text)
        db.session.add(plan)
    else:
        plan.plan_text = text
        plan.generated_at = func.now()
    log_event("HEALTH_PLAN", f"prediction_id={prediction.prediction_id} length={length}", user_id=g.user.user_id)
    try:
        db.session.commit()
    except IntegrityError:  # another request saved a plan at the same moment: replace it instead
        db.session.rollback()
        plan = HealthPlan.query.filter_by(prediction_id=prediction.prediction_id).one()
        plan.plan_text = text
        plan.generated_at = func.now()
        log_event("HEALTH_PLAN", f"prediction_id={prediction.prediction_id} length={length}", user_id=g.user.user_id)
        db.session.commit()
    db.session.refresh(plan)
    return jsonify(plan=_plan_dict(plan), disclaimer=DISCLAIMER), 201


@action_plan_bp.post("/next-week")
@login_required("general_user")
def next_week():
    """Add the next week to a 30-day plan (built week by week so each LLM reply stays short)."""
    prediction = latest_prediction(g.user.user_id)
    if prediction is None:
        return jsonify(error=NO_ASSESSMENT), 404
    plan = prediction.health_plan
    calendar = _calendar_of(plan) if plan else None
    if calendar is None:
        return jsonify(error=NO_PLAN), 404
    if calendar["length"] != 30:
        return jsonify(error="This is a 7-day plan. Create a 30-day plan to continue week by week."), 400
    if sum(len(week["days"]) for week in calendar["weeks"]) >= calendar["length"]:
        return jsonify(error="Your 30-day plan is complete."), 400

    try:
        _add_week(prediction, calendar)
    except LLMUnavailable:
        return _unavailable(prediction)
    plan.plan_text = json.dumps(calendar)
    log_event("HEALTH_PLAN", f"prediction_id={prediction.prediction_id} week={len(calendar['weeks'])}",
              user_id=g.user.user_id)
    db.session.commit()
    db.session.refresh(plan)
    return jsonify(plan=_plan_dict(plan), disclaimer=DISCLAIMER), 201
