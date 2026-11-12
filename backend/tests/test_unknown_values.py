"""Extra task: "I don't know" for health measurements (CHANGES.md #23)."""
from app.models import Prediction, PredictionInput


def test_unknown_values_use_typical_and_are_flagged(client, user_headers, fake_llm, valid_input):
    body = {**valid_input, "ap_hi": "unknown", "ap_lo": "unknown", "gluc": "unknown"}
    response = client.post("/api/predict", json=body, headers=user_headers)
    assert response.status_code == 201
    result = response.get_json()
    assert result["estimated_fields"] == ["ap_hi", "ap_lo", "gluc"]
    assert result["inputs"]["ap_hi"] == 120 and result["inputs"]["ap_lo"] == 80 and result["inputs"]["gluc"] == 1
    assert result["inputs"]["cholesterol"] == 2  # known value kept
    assert Prediction.query.one().estimated_fields == ["ap_hi", "ap_lo", "gluc"]
    assert PredictionInput.query.one().ap_hi == 120


def test_known_values_have_no_estimate(client, user_headers, fake_llm, valid_input):
    result = client.post("/api/predict", json=valid_input, headers=user_headers).get_json()
    assert result["estimated_fields"] == []


def test_unknown_only_allowed_for_health_measurements(client, user_headers, fake_llm, valid_input):
    response = client.post("/api/predict", json={**valid_input, "age": "unknown", "weight": "unknown"},
                           headers=user_headers)
    assert response.status_code == 400
    assert set(response.get_json()["fields"]) == {"age", "weight"}


def test_history_detail_keeps_estimated_fields(client, user_headers, fake_llm, valid_input):
    created = client.post("/api/predict", json={**valid_input, "cholesterol": "unknown"},
                          headers=user_headers).get_json()
    detail = client.get(f"/api/history/{created['prediction_id']}", headers=user_headers).get_json()
    assert detail["estimated_fields"] == ["cholesterol"]


def test_narrative_mentions_estimated_values(client, user_headers, fake_llm, valid_input):
    client.post("/api/predict", json={**valid_input, "ap_hi": "unknown", "ap_lo": "unknown"}, headers=user_headers)
    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "did not know" in prompt and "Systolic blood pressure" in prompt


def test_fallback_narrative_mentions_estimated_values(client, user_headers, fake_llm, valid_input):
    fake_llm.fail = True
    result = client.post("/api/predict", json={**valid_input, "ap_hi": "unknown", "ap_lo": "unknown"},
                         headers=user_headers).get_json()
    assert "estimated" in result["narrative"]["text"] and "blood pressure" in result["narrative"]["text"].lower()
