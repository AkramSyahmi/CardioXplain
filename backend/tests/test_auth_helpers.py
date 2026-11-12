"""Task 1: token login helper, activity log helper, JSON errors."""
from app import db
from app.models import SystemLog, User, log_event


def test_valid_token_reaches_protected_route(client, user_headers):
    response = client.get("/api/_test/user", headers=user_headers)
    assert response.status_code == 200
    user = User.query.filter_by(email="user@test.com").one()
    assert response.get_json()["user_id"] == user.user_id


def test_missing_token_is_401(client):
    response = client.get("/api/_test/user")
    assert response.status_code == 401
    assert response.get_json()["error"] == "Please log in again."


def test_tampered_token_is_rejected(client, user_headers):
    token = user_headers["Authorization"]
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    response = client.get("/api/_test/user", headers={"Authorization": tampered})
    assert response.status_code == 401


def test_expired_token_is_rejected(app, client, user_headers, monkeypatch):
    monkeypatch.setitem(app.config, "TOKEN_MAX_AGE_SECONDS", -1)
    response = client.get("/api/_test/user", headers=user_headers)
    assert response.status_code == 401
    assert response.get_json()["error"] == "Please log in again."


def test_inactive_user_token_is_rejected(client, make_user):
    from app.auth import make_token
    user = make_user("gone@test.com", status="inactive")
    response = client.get("/api/_test/user", headers={"Authorization": f"Bearer {make_token(user)}"})
    assert response.status_code == 401


def test_wrong_role_is_403(client, user_headers):
    response = client.get("/api/_test/admin", headers=user_headers)
    assert response.status_code == 403
    assert response.get_json()["error"] == "You do not have permission to access this page."


def test_admin_reaches_admin_route(client, admin_headers):
    assert client.get("/api/_test/admin", headers=admin_headers).status_code == 200


def test_log_event_writes_row(app):
    log_event("TEST", "x")
    db.session.commit()
    row = SystemLog.query.one()
    assert (row.action, row.description, row.user_id) == ("TEST", "x", None)


def test_unknown_url_returns_json_404(client):
    response = client.get("/api/nope")
    assert response.status_code == 404
    assert response.get_json()["error"] == "Not found."


def test_cors_allows_only_frontend_origin(client):
    allowed = client.get("/api/_test/user", headers={"Origin": "http://localhost:5173"})
    other = client.get("/api/_test/user", headers={"Origin": "http://evil.example.com"})
    assert allowed.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert other.headers.get("Access-Control-Allow-Origin") is None
