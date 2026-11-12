"""Fixes for the 9 minor findings from the Phase 4 final review."""
import pytest
from sqlalchemy import text

from app import db
from app.models import HealthPlan, Prediction, User


def test_1_plan_double_submit_does_not_crash(client, user_headers, fake_llm, valid_input, monkeypatch):
    """A second request saves a plan while this one waits for the LLM (separate DB connection)."""
    from app.routes import action_plan
    client.post("/api/predict", json=valid_input, headers=user_headers)
    prediction_id = Prediction.query.one().prediction_id
    db.session.commit()

    def plan_saved_by_other_request(*args):
        with db.engine.begin() as other:
            other.execute(text("INSERT INTO health_plans (prediction_id, plan_text) VALUES (:p, 'first')"),
                          {"p": prediction_id})
        return "second plan. Please consult a healthcare professional."
    monkeypatch.setattr(action_plan, "health_plan", plan_saved_by_other_request)
    response = client.post("/api/action-plan", json={}, headers=user_headers)
    assert response.status_code == 201
    db.session.expire_all()
    assert HealthPlan.query.count() == 1
    assert HealthPlan.query.one().plan_text.startswith("second plan")


def test_2_huge_number_is_a_field_error(client, user_headers, valid_input):
    response = client.post("/api/predict", json={**valid_input, "age": 10 ** 400}, headers=user_headers)
    assert response.status_code == 400 and "age" in response.get_json()["fields"]


def test_3_navigator_history_items_are_capped(client, user_headers, fake_llm):
    history = [{"role": "user", "content": "x" * 5000}]
    client.post("/api/navigator", json={"message": "Hi", "history": history}, headers=user_headers)
    assert len(fake_llm.calls[-1]["messages"][0]["content"]) == 1000


def test_3_request_body_size_is_limited(client, user_headers):
    response = client.post("/api/navigator", data="x" * (70 * 1024), content_type="application/json",
                           headers=user_headers)
    assert response.status_code == 413
    assert response.get_json()["error"] == "The request is too large."


def test_4_timed_out_llm_job_is_cancelled(app, monkeypatch):
    from concurrent.futures import TimeoutError as FutureTimeout
    from app.services import llm_service
    cancelled = []

    class StuckFuture:
        def result(self, timeout):
            raise FutureTimeout()

        def cancel(self):
            cancelled.append(True)

    class FakeExecutor:
        def submit(self, *args, **kwargs):
            return StuckFuture()

    monkeypatch.setattr(llm_service, "_executor", FakeExecutor())
    with pytest.raises(llm_service.LLMUnavailable):
        llm_service.chat("system", [{"role": "user", "content": "hi"}])
    assert cancelled == [True]


def test_5_simulator_survives_shap_failure(client, user_headers, fake_llm, valid_input, monkeypatch):
    from app.routes import simulation
    client.post("/api/predict", json={**valid_input, "active": 0}, headers=user_headers)

    def broken(_values):
        raise RuntimeError("shap broke")
    monkeypatch.setattr(simulation, "explain", broken)
    response = client.post("/api/simulation", json={"active": 1}, headers=user_headers)
    assert response.status_code == 200
    body = response.get_json()
    assert body["simulated"]["shap"] is None
    assert body["simulated"]["shap_error"] == "The explanation could not be generated. Please try the assessment again."


def test_6_password_reset_ends_old_sessions(client, admin_headers, make_user):
    from app.auth import make_token
    user = make_user("ali@test.com")
    old = {"Authorization": f"Bearer {make_token(user)}"}
    assert client.get("/api/auth/me", headers=old).status_code == 200
    client.patch(f"/api/admin/users/{user.user_id}", json={"password": "NewPass99"}, headers=admin_headers)
    assert client.get("/api/auth/me", headers=old).status_code == 401
    login = client.post("/api/auth/login", json={"email": "ali@test.com", "password": "NewPass99"})
    new = {"Authorization": f"Bearer {login.get_json()['token']}"}
    assert client.get("/api/auth/me", headers=new).status_code == 200


def test_7_admin_create_user_email_race_is_409(client, admin_headers, monkeypatch):
    """Another admin saves the same email between our check and our insert."""
    from app.routes import admin
    real_hash = admin.generate_password_hash

    def hash_while_other_admin_saves(password):
        with db.engine.begin() as other:
            other.execute(text("INSERT INTO users (full_name, email, password_hash, role, status) "
                               "VALUES ('Other', 'race@test.com', 'x', 'general_user', 'active')"))
        return real_hash(password)
    monkeypatch.setattr(admin, "generate_password_hash", hash_while_other_admin_saves)
    response = client.post("/api/admin/users", headers=admin_headers, json={
        "full_name": "Race", "email": "race@test.com", "role": "general_user", "password": "TempPass1"})
    assert response.status_code == 409
    assert response.get_json()["error"] == "This email is already registered."


def test_8_unknown_email_still_checks_a_password_hash(client, monkeypatch):
    """Same work for unknown and known emails, so timing does not reveal registered emails."""
    from app.routes import auth
    calls = []
    real_check = auth.check_password_hash

    def counting_check(stored, password):
        calls.append(stored)
        return real_check(stored, password)
    monkeypatch.setattr(auth, "check_password_hash", counting_check)
    response = client.post("/api/auth/login", json={"email": "nobody@test.com", "password": "Passw0rd!"})
    assert response.status_code == 401 and len(calls) == 1


def test_9_missing_metrics_file_is_503(client, admin_headers, monkeypatch, tmp_path):
    from app.routes import admin
    monkeypatch.setattr(admin, "MODEL_DIR", tmp_path)
    response = client.get("/api/admin/metrics", headers=admin_headers)
    assert response.status_code == 503
    assert response.get_json()["error"] == "Model metrics are not available yet."
