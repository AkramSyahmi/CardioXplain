"""UC-1000 View Personalised Health Action Plan, as a day-by-day calendar (CHANGES.md #25)."""
import json
from datetime import date, timedelta

import pytest

from app import db
from app.models import HealthPlan, Prediction, SystemLog
from conftest import calendar_week

UNAVAILABLE = "Health Action Plan is currently unavailable. Please try again later."


@pytest.fixture
def assessed(client, user_headers, fake_llm, valid_input):
    body = {**valid_input, "active": 0, "smoke": 1}
    assert client.post("/api/predict", json=body, headers=user_headers).status_code == 201
    fake_llm.reply = calendar_week()
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


def test_7_day_calendar_has_real_dates_and_blocks(client, user_headers, assessed):
    response = make_plan(client, user_headers, {"length": 7})
    assert response.status_code == 201
    calendar = response.get_json()["plan"]["calendar"]
    assert calendar["length"] == 7 and len(calendar["weeks"]) == 1
    days = calendar["weeks"][0]["days"]
    assert len(days) == 7
    today = date.today()
    assert days[0]["date"] == today.isoformat() and days[6]["date"] == (today + timedelta(days=6)).isoformat()
    assert set(days[0]["blocks"]) == {"morning", "afternoon", "evening"}
    assert days[0]["blocks"]["morning"][0]["steps"][0] == "Drink 1 glass (250 ml) of water after waking"
    saved = json.loads(HealthPlan.query.one().plan_text)
    assert saved["length"] == 7 and saved["start_date"] == today.isoformat()
    assert SystemLog.query.filter_by(action="HEALTH_PLAN").count() == 1


def test_default_length_is_7_days(client, user_headers, assessed):
    assert make_plan(client, user_headers).get_json()["plan"]["calendar"]["length"] == 7


def test_get_returns_the_calendar(client, user_headers, assessed):
    make_plan(client, user_headers, {"length": 7})
    got = client.get("/api/action-plan", headers=user_headers).get_json()["plan"]
    assert len(got["calendar"]["weeks"][0]["days"]) == 7 and got["generated_at"]


def test_30_day_plan_is_built_week_by_week(client, user_headers, assessed, fake_llm):
    first = make_plan(client, user_headers, {"length": 30}).get_json()["plan"]["calendar"]
    assert first["length"] == 30 and len(first["weeks"]) == 1
    fake_llm.reply = calendar_week("Build the habit")
    response = client.post("/api/action-plan/next-week", headers=user_headers)
    assert response.status_code == 201
    weeks = response.get_json()["plan"]["calendar"]["weeks"]
    assert [w["week"] for w in weeks] == [1, 2]
    assert weeks[1]["days"][0]["day"] == 8
    assert weeks[1]["days"][0]["date"] == (date.today() + timedelta(days=7)).isoformat()
    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "week 2 of 5" in prompt.lower() and "Start gently" in prompt


def test_30_day_plan_last_week_has_2_days(client, user_headers, assessed, fake_llm):
    make_plan(client, user_headers, {"length": 30})
    for _ in range(3):
        assert client.post("/api/action-plan/next-week", headers=user_headers).status_code == 201
    weeks = client.get("/api/action-plan", headers=user_headers).get_json()["plan"]["calendar"]["weeks"]
    assert [len(w["days"]) for w in weeks] == [7, 7, 7, 7]
    fake_llm.reply = calendar_week("Keep it going", days=2)  # days 29-30
    response = client.post("/api/action-plan/next-week", headers=user_headers)
    assert response.status_code == 201
    weeks = response.get_json()["plan"]["calendar"]["weeks"]
    assert len(weeks) == 5 and len(weeks[4]["days"]) == 2 and weeks[4]["days"][-1]["day"] == 30
    done = client.post("/api/action-plan/next-week", headers=user_headers)
    assert done.status_code == 400 and done.get_json()["error"] == "Your 30-day plan is complete."


def test_next_week_needs_a_30_day_plan(client, user_headers, assessed):
    assert client.post("/api/action-plan/next-week", headers=user_headers).get_json()["error"] == "No health action plan yet."
    make_plan(client, user_headers, {"length": 7})
    response = client.post("/api/action-plan/next-week", headers=user_headers)
    assert response.status_code == 400 and response.get_json()["error"] == "This is a 7-day plan. Create a 30-day plan to continue week by week."


def test_invalid_length_is_rejected(client, user_headers, assessed):
    response = make_plan(client, user_headers, {"length": 14})
    assert response.status_code == 400 and response.get_json()["error"] == "Please choose a 7-day or 30-day plan."


def test_plan_regenerate_replaces_old_plan(client, user_headers, assessed, fake_llm):
    make_plan(client, user_headers)
    fake_llm.reply = calendar_week("A fresh start")
    assert make_plan(client, user_headers).status_code == 201
    assert HealthPlan.query.count() == 1
    assert json.loads(HealthPlan.query.one().plan_text)["weeks"][0]["theme"] == "A fresh start"


def test_reply_in_code_fence_is_accepted(client, user_headers, assessed, fake_llm):
    fake_llm.reply = "```json\n" + calendar_week() + "\n```"
    assert make_plan(client, user_headers).status_code == 201


@pytest.mark.parametrize("reply", [
    "## Week 1\n- Walk more",                                   # not JSON
    json.dumps({"theme": "x", "days": json.loads(calendar_week())["days"][:6]}),  # only 6 days
    json.dumps({"theme": "x", "days": [{"day": 1, "title": "t", "blocks": {"morning": []}}] * 7}),  # bad blocks
])
def test_badly_shaped_reply_is_unavailable(client, user_headers, assessed, fake_llm, reply):
    fake_llm.reply = reply
    response = make_plan(client, user_headers)
    assert response.status_code == 503 and response.get_json()["error"] == UNAVAILABLE
    assert HealthPlan.query.count() == 0


def test_unsafe_text_inside_a_step_is_unavailable(client, user_headers, assessed, fake_llm):
    fake_llm.reply = calendar_week(step_text="Take 50 mg aspirin with breakfast")
    response = make_plan(client, user_headers)
    assert response.status_code == 503 and HealthPlan.query.count() == 0


def test_plan_llm_failure_message(client, user_headers, assessed, fake_llm):
    fake_llm.fail = True
    response = make_plan(client, user_headers)
    assert response.status_code == 503
    body = response.get_json()
    assert body["error"] == UNAVAILABLE
    assert body["risk_category"] == Prediction.query.one().risk_category and "risk_score" in body
    assert HealthPlan.query.count() == 0


def test_plan_prompt_has_safety_rules_profile_and_local_food(client, user_headers, assessed, fake_llm):
    from app.services.llm_service import SAFETY_RULES
    make_plan(client, user_headers)
    call = fake_llm.calls[-1]
    prompt = call["messages"][-1]["content"]
    assert SAFETY_RULES in call["system"]
    assert "Physical activity: No" in prompt and "Smoking: Yes" in prompt
    assert "Malaysia" in prompt and "JSON" in prompt
    for part in ("morning", "afternoon", "evening", "meal", "workout", "hydration", "sleep"):
        assert part in prompt


def test_high_risk_plan_asks_for_doctor_before_exercise(client, user_headers, fake_llm, valid_input):
    client.post("/api/predict", json={**valid_input, "ap_hi": 180, "ap_lo": 110, "cholesterol": 3, "age": 64},
                headers=user_headers)
    assert Prediction.query.one().risk_category == "High"
    fake_llm.reply = calendar_week()
    make_plan(client, user_headers)
    assert "doctor before starting" in fake_llm.calls[-1]["messages"][-1]["content"]


def test_plan_uses_simulated_lifestyle(client, user_headers, assessed, fake_llm):
    response = make_plan(client, user_headers, {"lifestyle": {"active": 1, "smoke": 0}})
    assert response.status_code == 201
    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "Physical activity: Yes" in prompt and "Smoking: No" in prompt


def test_plan_rejects_bad_lifestyle(client, user_headers, assessed):
    assert make_plan(client, user_headers, {"lifestyle": {"ap_hi": 120}}).status_code == 400
    bad = make_plan(client, user_headers, {"lifestyle": {"weight": 5}})
    assert bad.status_code == 400 and "weight" in bad.get_json()["fields"]


def test_old_text_plan_still_shows(client, user_headers, assessed):
    db.session.add(HealthPlan(prediction_id=Prediction.query.one().prediction_id, plan_text="## Week 1\n- Walk"))
    db.session.commit()
    plan = client.get("/api/action-plan", headers=user_headers).get_json()["plan"]
    assert plan["calendar"] is None and plan["plan_text"].startswith("## Week 1")


def test_plan_admin_is_forbidden(client, admin_headers):
    assert make_plan(client, admin_headers).status_code == 403


def test_plan_prompt_avoids_mg_and_empty_blocks(client, user_headers, assessed, fake_llm):
    """Phase 5 review #3: 'sodium under 1500 mg' would be blocked as a dose, and an empty block fails the check."""
    make_plan(client, user_headers)
    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "Do not write amounts in mg" in prompt
    assert "at least one task in every block" in prompt
