"""Task 3: UC-200/300/400 POST /api/predict."""
import time

from ml.features import risk_percent
from app.models import LlmNarrative, Prediction, PredictionInput, ShapExplanation, SystemLog
from ml.features import risk_category

DISCLAIMER = "This result is for educational purposes only and does not replace professional medical advice."


def predict(client, headers, body):
    return client.post("/api/predict", json=body, headers=headers)


def test_predict_returns_full_result(client, user_headers, fake_llm, valid_input):
    response = predict(client, user_headers, valid_input)
    assert response.status_code == 201
    body = response.get_json()
    assert 0 <= body["risk_score"] <= 1
    assert body["risk_percent"] == risk_percent(body["risk_score"])
    assert body["risk_category"] == risk_category(body["risk_score"])
    assert body["inputs"]["bmi"] == 27.68
    assert len(body["shap"]) == 12
    assert body["narrative"] == {"text": fake_llm.reply, "source": "llm"}
    assert body["disclaimer"] == DISCLAIMER


def test_predict_saves_all_records(client, user_headers, fake_llm, valid_input):
    body = predict(client, user_headers, valid_input).get_json()
    prediction = Prediction.query.one()
    assert prediction.prediction_id == body["prediction_id"]
    assert PredictionInput.query.one().ap_hi == 140
    shap_row = ShapExplanation.query.one()
    assert shap_row.feature_1 == body["shap"][0]["feature"]
    assert len(shap_row.all_shap_values) == 12
    assert LlmNarrative.query.one().narrative_text == fake_llm.reply
    assert SystemLog.query.filter_by(action="PREDICT").count() == 1


def test_predict_rejects_out_of_range(client, user_headers, valid_input):
    response = predict(client, user_headers, {**valid_input, "ap_hi": 350})
    assert response.status_code == 400
    body = response.get_json()
    assert body["error"] == "Please correct the highlighted fields."
    assert body["fields"]["ap_hi"] == "Systolic blood pressure must be between 60 and 300 mmHg."
    assert Prediction.query.count() == 0


def test_predict_rejects_wrong_types_and_missing_body(client, user_headers, valid_input):
    wrong = predict(client, user_headers, {**valid_input, "age": "abc", "smoke": "yes"})
    assert wrong.status_code == 400 and set(wrong.get_json()["fields"]) == {"age", "smoke"}
    empty = client.post("/api/predict", data="x", content_type="text/plain", headers=user_headers)
    assert empty.status_code == 400 and len(empty.get_json()["fields"]) == 11


def test_predict_requires_login(client, valid_input):
    assert client.post("/api/predict", json=valid_input).status_code == 401


def test_predict_admin_is_forbidden(client, admin_headers, valid_input):
    assert predict(client, admin_headers, valid_input).status_code == 403


def test_predict_uses_fallback_when_llm_fails(client, user_headers, fake_llm, valid_input):
    fake_llm.fail = True
    response = predict(client, user_headers, valid_input)
    assert response.status_code == 201
    body = response.get_json()
    assert body["narrative"]["source"] == "fallback"
    assert LlmNarrative.query.one().narrative_text == body["narrative"]["text"]


def test_predict_uses_fallback_when_llm_text_unsafe(client, user_headers, fake_llm, valid_input):
    fake_llm.reply = "You should take 20 mg of a statin."
    body = predict(client, user_headers, valid_input).get_json()
    assert body["narrative"]["source"] == "fallback"
    assert "20 mg" not in body["narrative"]["text"]


def test_predict_shap_failure_still_returns_score(client, user_headers, fake_llm, valid_input, monkeypatch):
    from app.routes import predict as predict_route

    def broken(_values):
        raise RuntimeError("shap broke")
    monkeypatch.setattr(predict_route, "explain", broken)
    response = predict(client, user_headers, valid_input)
    assert response.status_code == 201
    body = response.get_json()
    assert body["shap"] is None
    assert body["shap_error"] == "The explanation could not be generated. Please try the assessment again."
    assert body["risk_category"] in {"Low", "Moderate", "High"}
    assert ShapExplanation.query.count() == 0 and Prediction.query.count() == 1


def test_predict_is_fast(client, user_headers, fake_llm, valid_input):
    predict(client, user_headers, valid_input)  # first call loads the model
    start = time.perf_counter()
    response = predict(client, user_headers, valid_input)
    assert response.status_code == 201
    assert time.perf_counter() - start < 5  # NFR01 (LLM faked)
