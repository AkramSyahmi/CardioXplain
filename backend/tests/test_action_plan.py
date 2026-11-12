"""Task 8: UC-1000 View Personalised Health Action Plan."""
import pytest

from app.models import HealthPlan, Prediction, SystemLog

UNAVAILABLE = "Health Action Plan is currently unavailable. Please try again later."
PLAN = "## Week 1\n- Walk 20 minutes a day.\nPlease consult a healthcare professional."


@pytest.fixture
def assessed(client, user_headers, fake_llm, valid_input):
    body = {**valid_input, "active": 0, "smoke": 1}
    assert client.post("/api/predict", json=body, headers=user_headers).status_code == 201
    fake_llm.reply = PLAN
    return body


def make_plan(client, headers, body=None):
    return client.post("/api/action-plan", json=body or {}, headers=headers)


def test_plan_requires_assessment(client, user_headers):
    for response in (make_plan(client, user_headers), client.get("/api/action-plan", headers=user_headers)):
        assert response.status_code == 404
        assert response.get_json()["error"] == "Please complete a Risk Assessment first."


def test_plan_get_before_generating(client, user_headers, assessed):
    response = client.get("/api/action-plan", headers=user_headers)
    assert response.status_code == 404 and response.get_json()["error"] == "No health action plan yet."


def test_plan_generated_and_saved(client, user_headers, assessed):
    response = make_plan(client, user_headers)
    assert response.status_code == 201
    body = response.get_json()
    assert body["plan"]["plan_text"] == PLAN and body["disclaimer"]
    saved = HealthPlan.query.one()
    assert saved.prediction_id == Prediction.query.one().prediction_id == body["plan"]["prediction_id"]
    got = client.get("/api/action-plan", headers=user_headers).get_json()["plan"]
    assert got["plan_text"] == PLAN and got["generated_at"]
    assert SystemLog.query.filter_by(action="HEALTH_PLAN").count() == 1


def test_plan_regenerate_replaces_old_plan(client, user_headers, assessed, fake_llm):
    make_plan(client, user_headers)
    fake_llm.reply = "## Week 1\n- Eat more vegetables.\nPlease consult a healthcare professional."
    assert make_plan(client, user_headers).status_code == 201
    assert HealthPlan.query.count() == 1
    assert HealthPlan.query.one().plan_text == fake_llm.reply


def test_plan_prompt_has_safety_rules_and_profile(client, user_headers, assessed, fake_llm):
    from app.services.llm_service import SAFETY_RULES
    make_plan(client, user_headers)
    call = fake_llm.calls[-1]
    prompt = call["messages"][-1]["content"]
    assert SAFETY_RULES in call["system"]
    assert "Physical activity: No" in prompt and "Smoking: Yes" in prompt
    for section in ("Physical activity", "Diet", "Lifestyle changes", "Monitoring reminders"):
        assert section in prompt


def test_plan_uses_simulated_lifestyle(client, user_headers, assessed, fake_llm):
    response = make_plan(client, user_headers, {"lifestyle": {"active": 1, "smoke": 0}})
    assert response.status_code == 201
    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "Physical activity: Yes" in prompt and "Smoking: No" in prompt


def test_plan_rejects_bad_lifestyle(client, user_headers, assessed):
    assert make_plan(client, user_headers, {"lifestyle": {"ap_hi": 120}}).status_code == 400
    bad = make_plan(client, user_headers, {"lifestyle": {"weight": 5}})
    assert bad.status_code == 400 and "weight" in bad.get_json()["fields"]


def test_plan_llm_failure_message(client, user_headers, assessed, fake_llm):
    fake_llm.fail = True
    response = make_plan(client, user_headers)
    assert response.status_code == 503
    body = response.get_json()
    assert body["error"] == UNAVAILABLE
    assert body["risk_category"] == Prediction.query.one().risk_category and "risk_score" in body
    assert HealthPlan.query.count() == 0


def test_plan_unsafe_text_not_saved(client, user_headers, assessed, fake_llm):
    fake_llm.reply = "Take 50 mg aspirin every morning."
    response = make_plan(client, user_headers)
    assert response.status_code == 503 and response.get_json()["error"] == UNAVAILABLE
    assert HealthPlan.query.count() == 0


def test_plan_admin_is_forbidden(client, admin_headers):
    assert make_plan(client, admin_headers).status_code == 403
