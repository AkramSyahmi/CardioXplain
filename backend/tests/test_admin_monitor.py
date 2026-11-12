"""Task 6: UC-900 Monitor Model Performance."""
import json
from pathlib import Path

import pytest

from app import db
from app.models import log_event

OUTPUT = Path(__file__).resolve().parents[1] / "ml" / "output"


def test_metrics_returns_test_set_results(client, admin_headers):
    response = client.get("/api/admin/metrics", headers=admin_headers)
    assert response.status_code == 200
    body = response.get_json()
    saved = json.loads((OUTPUT / "metrics.json").read_text())
    assert body["metrics"]["auc"] == saved["auc"]
    for key in ("accuracy", "precision", "recall", "f1_score", "confusion_matrix"):
        assert key in body["metrics"]
    assert body["training"]["best_params"]


def test_stats_counts_and_distribution(client, admin_headers, user_headers, fake_llm, valid_input):
    client.post("/api/predict", json=valid_input, headers=user_headers)
    client.post("/api/predict", json={**valid_input, "ap_hi": 180, "cholesterol": 3}, headers=user_headers)
    log_event("LLM_CALL", "success")
    log_event("LLM_CALL", "failed: timeout")
    db.session.commit()
    body = client.get("/api/admin/stats", headers=admin_headers).get_json()
    assert body["total_users"] == 2 and body["total_assessments"] == 2
    assert sum(body["risk_distribution"].values()) == 2
    assert set(body["risk_distribution"]) == {"Low", "Moderate", "High"}
    assert body["llm_calls"] == {"success": 1, "failed": 1}


def test_stats_has_no_personal_fields(client, admin_headers, user_headers, fake_llm, valid_input):
    client.post("/api/predict", json=valid_input, headers=user_headers)
    response = client.get("/api/admin/stats", headers=admin_headers)
    assert response.status_code == 200
    text = response.get_data(as_text=True)
    assert "user@test.com" not in text and "ap_hi" not in text and "narrative" not in text


def test_logs_newest_first_and_limit(client, admin_headers):
    for i in range(5):
        log_event("TEST", f"event {i}")
    db.session.commit()
    logs = client.get("/api/admin/logs?limit=3", headers=admin_headers).get_json()["logs"]
    assert [log["description"] for log in logs] == ["event 4", "event 3", "event 2"]
    assert set(logs[0]) == {"log_id", "user_id", "action", "description", "timestamp"}


def test_logs_limit_is_capped_and_bad_limit_uses_default(client, admin_headers):
    for i in range(3):
        log_event("TEST", f"event {i}")
    db.session.commit()
    assert client.get("/api/admin/logs?limit=999999", headers=admin_headers).status_code == 200
    assert len(client.get("/api/admin/logs?limit=abc", headers=admin_headers).get_json()["logs"]) == 3
    assert len(client.get("/api/admin/logs?limit=-5", headers=admin_headers).get_json()["logs"]) == 1


@pytest.mark.parametrize("path", ["/api/admin/metrics", "/api/admin/stats", "/api/admin/logs"])
def test_admin_endpoints_forbid_general_user(client, user_headers, path):
    assert client.get(path, headers=user_headers).status_code == 403
    assert client.get(path).status_code == 401
