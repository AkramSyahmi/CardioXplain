"""UC-500 Simulate Lifestyle Changes (What-If simulator, Table 3.21)."""
from flask import Blueprint, current_app, g, jsonify

from app import db
from app.auth import login_required
from app.models import latest_prediction, log_event
from app.routes.predict import SHAP_ERROR
from app.services.llm_service import DISCLAIMER, simulation_narrative
from app.services.ml_service import predict_probability
from app.services.shap_service import explain
from app.validation import assessment_problems, read_json
from ml.features import risk_category

simulation_bp = Blueprint("simulation", __name__)

NO_ASSESSMENT = "Please complete a Risk Assessment first."
# UC-500 rule: only lifestyle values change; BMI changes through weight. Clinical values stay fixed.
CHANGEABLE = ("smoke", "alco", "active", "weight")


def _score(risk_score):
    return {"risk_score": risk_score, "risk_percent": round(risk_score * 100),
            "risk_category": risk_category(risk_score)}


@simulation_bp.get("")
@login_required("general_user")
def prefill():
    prediction = latest_prediction(g.user.user_id)
    if prediction is None:
        return jsonify(error=NO_ASSESSMENT), 404
    return jsonify(inputs=prediction.inputs.to_dict())


@simulation_bp.post("")
@login_required("general_user")
def simulate():
    prediction = latest_prediction(g.user.user_id)
    if prediction is None:
        return jsonify(error=NO_ASSESSMENT), 404

    changes = read_json() or {}
    if not changes:
        return jsonify(error="Please change at least one lifestyle value."), 400
    if set(changes) - set(CHANGEABLE):
        return jsonify(error="Only physical activity, smoking, alcohol and weight can be changed in the simulator."), 400

    original_inputs = prediction.inputs.to_dict()
    values, fields = assessment_problems({**original_inputs, **changes})
    if fields:
        return jsonify(error="Please correct the highlighted fields.", fields=fields), 400

    simulated_score = round(predict_probability(values), 4)
    original = _score(prediction.risk_score)
    simulated = {**_score(simulated_score), "inputs": values}
    try:
        simulated["shap"] = explain(values)
    except Exception:  # same as UC-300 E1: still show the simulated score
        current_app.logger.exception("SHAP calculation failed")
        simulated["shap"], simulated["shap_error"] = None, SHAP_ERROR
    changed = {name: (original_inputs[name], values[name])
               for name in CHANGEABLE if values[name] != original_inputs[name]}
    narrative, source = simulation_narrative(original, simulated, changed)

    # Nothing is stored except the log (UC-500 post-condition).
    log_event("SIMULATE", f"prediction_id={prediction.prediction_id}", user_id=g.user.user_id)
    db.session.commit()
    return jsonify(original=original, simulated=simulated,
                   change_percent_points=round((simulated_score - prediction.risk_score) * 100, 1),
                   narrative={"text": narrative, "source": source}, disclaimer=DISCLAIMER)
