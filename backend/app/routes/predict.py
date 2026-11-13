"""UC-200 Perform Risk Assessment, with UC-300 SHAP explanation and UC-400 LLM narrative."""
from flask import Blueprint, current_app, g, jsonify

from app import db
from app.auth import login_required
from app.models import LlmNarrative, Prediction, PredictionInput, ShapExplanation, log_event
from app.services.llm_service import DISCLAIMER, risk_narrative
from app.services.ml_service import predict_probability
from app.services.shap_service import explain
from app.validation import assessment_problems, fill_unknown, lifestyle_conflicts, read_json
from ml.features import risk_category, risk_percent

predict_bp = Blueprint("predict", __name__)

SHAP_ERROR = "The explanation could not be generated. Please try the assessment again."


@predict_bp.post("")
@login_required("general_user")
def create_prediction():
    data, estimated = fill_unknown(read_json() or {})
    values, fields = assessment_problems(data)
    fields.update(lifestyle_conflicts(data))
    if fields:
        return jsonify(error="Please correct the highlighted fields.", fields=fields), 400

    risk_score = round(predict_probability(values), 4)
    category = risk_category(risk_score)

    try:
        shap_items = explain(values)
    except Exception:  # UC-300 E1: still show the score and category
        current_app.logger.exception("SHAP calculation failed")
        shap_items = None
    top = (shap_items or [])[:3]
    narrative, source = risk_narrative(risk_score, category, top, estimated, values)

    prediction = Prediction(user_id=g.user.user_id, risk_score=risk_score, risk_category=category,
                            estimated_fields=estimated)
    db.session.add(prediction)
    db.session.flush()
    db.session.add(PredictionInput(prediction_id=prediction.prediction_id, **values))
    if shap_items:
        db.session.add(ShapExplanation(
            prediction_id=prediction.prediction_id,
            feature_1=top[0]["feature"], shap_value_1=top[0]["shap"],
            feature_2=top[1]["feature"], shap_value_2=top[1]["shap"],
            feature_3=top[2]["feature"], shap_value_3=top[2]["shap"],
            all_shap_values=shap_items,
        ))
    db.session.add(LlmNarrative(prediction_id=prediction.prediction_id, narrative_text=narrative))
    log_event("PREDICT", f"prediction_id={prediction.prediction_id}", user_id=g.user.user_id)
    db.session.commit()

    result = {
        "prediction_id": prediction.prediction_id,
        "risk_score": risk_score,
        "risk_percent": risk_percent(risk_score),
        "risk_category": category,
        "inputs": values,
        "estimated_fields": estimated,
        "shap": shap_items,
        "narrative": {"text": narrative, "source": source},
        "disclaimer": DISCLAIMER,
    }
    if shap_items is None:
        result["shap_error"] = SHAP_ERROR
    return jsonify(result), 201
