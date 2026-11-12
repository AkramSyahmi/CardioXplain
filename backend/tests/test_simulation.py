"""Task 4: UC-500 What-If simulator."""
import pytest

from app.models import Prediction, SystemLog

FIRST_MESSAGE = "Please complete a Risk Assessment first."


@pytest.fixture
def assessed(client, user_headers, fake_llm, valid_input):
    """A user who smokes, is inactive and has done one assessment."""
    body = {**valid_input, "smoke": 1, "active": 0, "weight": 92}
    assert client.post("/api/predict", json=body, headers=user_headers).status_code == 201
    return body


def simulate(client, headers, changes):
    return client.post("/api/simulation", json=changes, headers=headers)


def test_simulation_prefill_returns_latest_inputs(client, user_headers, assessed):
    response = client.get("/api/simulation", headers=user_headers)
    assert response.status_code == 200
    inputs = response.get_json()["inputs"]
    assert inputs["smoke"] == 1 and inputs["weight"] == 92 and inputs["ap_hi"] == 140
    assert inputs["bmi"] == 31.83


def test_simulation_without_assessment_is_404(client, user_headers):
    get = client.get("/api/simulation", headers=user_headers)
    post = simulate(client, user_headers, {"active": 1})
    assert get.status_code == post.status_code == 404
    assert get.get_json()["error"] == post.get_json()["error"] == FIRST_MESSAGE


def test_simulation_returns_before_and_after(client, user_headers, assessed, fake_llm):
    response = simulate(client, user_headers, {"active": 1, "weight": 80})
    assert response.status_code == 200
    body = response.get_json()
    original = Prediction.query.one()
    assert body["original"]["risk_score"] == original.risk_score
    assert body["simulated"]["inputs"]["active"] == 1
    assert body["simulated"]["inputs"]["bmi"] == 27.68
    assert len(body["simulated"]["shap"]) == 12
    expected_change = round((body["simulated"]["risk_score"] - original.risk_score) * 100, 1)
    assert body["change_percent_points"] == expected_change
    assert body["narrative"]["source"] == "llm" and body["disclaimer"]


def test_simulation_becoming_active_lowers_or_keeps_risk(client, user_headers, assessed):
    body = simulate(client, user_headers, {"active": 1}).get_json()
    assert body["change_percent_points"] <= 0


def test_simulation_stop_smoking_never_raises_risk(client, user_headers, assessed):
    body = simulate(client, user_headers, {"smoke": 0}).get_json()
    assert body["change_percent_points"] <= 0


def test_simulation_rejects_clinical_fields(client, user_headers, assessed):
    response = simulate(client, user_headers, {"active": 1, "ap_hi": 120})
    assert response.status_code == 400
    assert response.get_json()["error"] == (
        "Only physical activity, smoking, alcohol and weight can be changed in the simulator.")


def test_simulation_needs_at_least_one_change(client, user_headers, assessed):
    assert simulate(client, user_headers, {}).status_code == 400
    empty = client.post("/api/simulation", data="x", content_type="text/plain", headers=user_headers)
    assert empty.status_code == 400


def test_simulation_validates_weight_range(client, user_headers, assessed):
    response = simulate(client, user_headers, {"weight": 10})
    assert response.status_code == 400
    assert response.get_json()["fields"]["weight"] == "Weight must be between 20 and 300 kg."


def test_simulation_fallback_when_llm_fails(client, user_headers, assessed, fake_llm):
    fake_llm.fail = True
    body = simulate(client, user_headers, {"active": 1}).get_json()
    assert body["narrative"]["source"] == "fallback"
    assert "compared with" in body["narrative"]["text"]


def test_simulation_prompt_describes_the_change(client, user_headers, assessed, fake_llm):
    simulate(client, user_headers, {"active": 1, "weight": 80})
    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "Physical activity: No -> Yes" in prompt and "Weight: 92 -> 80" in prompt


def test_simulation_saves_nothing_new(client, user_headers, assessed):
    simulate(client, user_headers, {"active": 1})
    assert Prediction.query.count() == 1
    assert SystemLog.query.filter_by(action="SIMULATE").count() == 1


def test_simulation_admin_is_forbidden(client, admin_headers):
    assert client.get("/api/simulation", headers=admin_headers).status_code == 403
