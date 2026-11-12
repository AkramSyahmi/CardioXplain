"""Task 7: UC-800 Manage User Accounts."""
from app.auth import make_token
from app.models import SystemLog, User

PASSWORD_RULE = "Password must contain at least 8 characters including uppercase, lowercase, and a number."


def uid(email):
    return User.query.filter_by(email=email).one().user_id


def patch(client, headers, user_id, body):
    return client.patch(f"/api/admin/users/{user_id}", json=body, headers=headers)


def test_list_users(client, admin_headers, make_user):
    make_user("ali@test.com")
    users = client.get("/api/admin/users", headers=admin_headers).get_json()["users"]
    assert [u["email"] for u in users] == ["admin@test.com", "ali@test.com"]
    assert {"user_id", "full_name", "email", "role", "status", "created_at"} <= set(users[0])
    assert "password_hash" not in users[0]


def test_user_detail_has_no_health_data(client, admin_headers, user_headers, fake_llm, valid_input):
    client.post("/api/predict", json=valid_input, headers=user_headers)
    detail = client.get(f"/api/admin/users/{uid('user@test.com')}", headers=admin_headers).get_json()
    assert detail["assessment_count"] == 1
    assert not {"inputs", "shap", "narrative", "predictions", "risk_score"} & set(detail)


def test_user_detail_missing_is_404(client, admin_headers):
    response = client.get("/api/admin/users/999999", headers=admin_headers)
    assert response.status_code == 404 and response.get_json()["error"] == "User not found."


def test_create_user_with_temporary_password(client, admin_headers):
    response = client.post("/api/admin/users", headers=admin_headers, json={
        "full_name": "New Admin", "email": "New@Test.com", "role": "admin", "password": "TempPass1"})
    assert response.status_code == 201
    assert response.get_json()["user"]["role"] == "admin"
    login = client.post("/api/auth/login", json={"email": "new@test.com", "password": "TempPass1"})
    assert login.status_code == 200
    assert SystemLog.query.filter_by(action="CREATE_USER").count() == 1


def test_create_user_validation(client, admin_headers, make_user):
    make_user("taken@test.com")
    bad = client.post("/api/admin/users", headers=admin_headers, json={
        "full_name": "", "email": "nope", "role": "boss", "password": "weak"})
    assert bad.status_code == 400
    assert set(bad.get_json()["fields"]) == {"full_name", "email", "role", "password"}
    dup = client.post("/api/admin/users", headers=admin_headers, json={
        "full_name": "X", "email": "taken@test.com", "role": "general_user", "password": "TempPass1"})
    assert dup.status_code == 409


def test_cannot_deactivate_own_account(client, admin_headers):
    response = patch(client, admin_headers, uid("admin@test.com"), {"status": "inactive"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "You cannot deactivate your own administrator account."


def test_cannot_remove_last_active_admin(client, admin_headers):
    response = patch(client, admin_headers, uid("admin@test.com"), {"role": "general_user"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "At least one active administrator account must exist."
    assert User.query.filter_by(email="admin@test.com").one().role == "admin"


def test_can_demote_admin_when_another_admin_exists(client, admin_headers, make_user):
    make_user("second@test.com", role="admin")
    response = patch(client, admin_headers, uid("second@test.com"), {"role": "general_user"})
    assert response.status_code == 200 and response.get_json()["user"]["role"] == "general_user"
    assert SystemLog.query.filter_by(action="CHANGE_ROLE").count() == 1


def test_deactivated_user_token_stops_working(client, admin_headers, make_user):
    user = make_user("ali@test.com")
    headers = {"Authorization": f"Bearer {make_token(user)}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    assert patch(client, admin_headers, user.user_id, {"status": "inactive"}).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert SystemLog.query.filter_by(action="DEACTIVATE_USER").count() == 1
    assert patch(client, admin_headers, user.user_id, {"status": "active"}).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 200


def test_reset_password_follows_rule(client, admin_headers, make_user):
    user_id = make_user("ali@test.com").user_id
    weak = patch(client, admin_headers, user_id, {"password": "short"})
    assert weak.status_code == 400 and weak.get_json()["fields"]["password"] == PASSWORD_RULE
    assert patch(client, admin_headers, user_id, {"password": "NewPass99"}).status_code == 200
    login = client.post("/api/auth/login", json={"email": "ali@test.com", "password": "NewPass99"})
    assert login.status_code == 200


def test_patch_rejects_unknown_fields_and_bad_values(client, admin_headers, make_user):
    user_id = make_user("ali@test.com").user_id
    assert patch(client, admin_headers, user_id, {"email": "x@y.com"}).status_code == 400
    assert patch(client, admin_headers, user_id, {}).status_code == 400
    bad = patch(client, admin_headers, user_id, {"role": "boss", "status": "gone"})
    assert bad.status_code == 400 and set(bad.get_json()["fields"]) == {"role", "status"}


def test_user_management_forbids_general_user(client, user_headers):
    assert client.get("/api/admin/users", headers=user_headers).status_code == 403
    assert client.post("/api/admin/users", json={}, headers=user_headers).status_code == 403
