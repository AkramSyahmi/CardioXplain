"""Fixes for the Phase 5 review minor findings #5-#7 (backend)."""
import json

from sqlalchemy import text

from app import db
from app.models import HealthPlan
from conftest import calendar_week

AMOUNTS = {"cigarettes_per_day": 20, "drinks_per_week": 0, "activity_minutes": 60}


def with_amounts(valid_input):
    body = {k: v for k, v in valid_input.items() if k not in ("smoke", "alco", "active")}
    return {**body, **AMOUNTS}


def test_5_plan_calls_use_their_own_thread_pool(app, monkeypatch):
    """A slow plan must not take the threads that risk narratives need."""
    from app.services import llm_service
    used = []

    class Recorder:
        def __init__(self, name):
            self.name = name

        def submit(self, fn, **kwargs):
            used.append(self.name)
            raise RuntimeError("stop here")

    monkeypatch.setattr(llm_service, "_executor", Recorder("short"))
    monkeypatch.setattr(llm_service, "_plan_executor", Recorder("plan"))
    for call in (lambda: llm_service.chat("s", []), lambda: llm_service.chat("s", [], long_reply=True)):
        try:
            call()
        except llm_service.LLMUnavailable:
            pass
    assert used == ["short", "plan"]


def test_6_next_week_refuses_if_the_plan_changed_meanwhile(client, user_headers, fake_llm, valid_input, monkeypatch):
    """Another tab replaced the plan while this request waited for the LLM."""
    from app.routes import action_plan
    client.post("/api/predict", json=with_amounts(valid_input), headers=user_headers)
    fake_llm.reply = calendar_week()
    client.post("/api/action-plan", json={"length": 30}, headers=user_headers)
    plan_id = HealthPlan.query.one().plan_id
    db.session.commit()
    real_week = action_plan.health_week

    def week_while_other_tab_saves(*args):
        with db.engine.begin() as other:
            other.execute(text("UPDATE health_plans SET plan_text = :t WHERE plan_id = :p"),
                          {"t": json.dumps({"format": "calendar", "length": 7, "start_date": "2026-11-16",
                                            "lifestyle": {}, "weeks": []}), "p": plan_id})
        return real_week(*args)
    monkeypatch.setattr(action_plan, "health_week", week_while_other_tab_saves)
    response = client.post("/api/action-plan/next-week", headers=user_headers)
    assert response.status_code == 409
    assert response.get_json()["error"] == "Your plan was changed in another tab. Please reload the page."
    db.session.expire_all()
    assert json.loads(HealthPlan.query.one().plan_text)["length"] == 7  # the other tab's plan is kept


def test_7_simulation_rejects_a_yes_no_change_on_an_amount_record(client, user_headers, fake_llm, valid_input):
    client.post("/api/predict", json=with_amounts(valid_input), headers=user_headers)
    response = client.post("/api/simulation", json={"active": 1}, headers=user_headers)
    assert response.status_code == 400
    assert response.get_json()["error"] == "This assessment uses amounts. Change Exercise minutes per week instead."
    plan = client.post("/api/action-plan", json={"lifestyle": {"smoke": 0}}, headers=user_headers)
    assert plan.status_code == 400
    assert plan.get_json()["error"] == "This assessment uses amounts. Change Cigarettes per day instead."


def test_7_predict_rejects_a_yes_no_value_that_disagrees_with_its_amount(client, user_headers, fake_llm, valid_input):
    response = client.post("/api/predict", json={**with_amounts(valid_input), "smoke": 0}, headers=user_headers)
    assert response.status_code == 400
    assert response.get_json()["fields"]["smoke"] == "Smoking does not match Cigarettes per day."


def test_7_yes_no_change_still_works_on_an_old_record(client, user_headers, fake_llm, valid_input):
    client.post("/api/predict", json={**valid_input, "active": 0}, headers=user_headers)  # Yes/No only, no amounts
    assert client.post("/api/simulation", json={"active": 1}, headers=user_headers).status_code == 200
