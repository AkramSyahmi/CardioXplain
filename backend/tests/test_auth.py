"""Task 2: UC-100 Register & Login."""
from app.models import SystemLog, User

PASSWORD_RULE = "Password must contain at least 8 characters including uppercase, lowercase, and a number."
NEW_USER = {"full_name": "Ali Ahmad", "email": "ali@mail.com", "password": "Passw0rd!"}


def register(client, **changes):
    return client.post("/api/auth/register", json={**NEW_USER, **changes})


def login(client, email="ali@mail.com", password="Passw0rd!"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_register_creates_general_user(client):
    response = register(client)
    assert response.status_code == 201
    assert response.get_json()["message"] == "Registration successful. Please log in."
    user = User.query.filter_by(email="ali@mail.com").one()
    assert user.role == "general_user" and user.status == "active"
    assert user.password_hash.startswith("scrypt") and "Passw0rd!" not in user.password_hash


def test_register_ignores_role_field(client):
    register(client, role="admin")
    assert User.query.filter_by(email="ali@mail.com").one().role == "general_user"


def test_register_rejects_weak_password(client):
    response = register(client, password="abc")
    assert response.status_code == 400
    assert response.get_json()["fields"]["password"] == PASSWORD_RULE


def test_register_rejects_invalid_email(client):
    response = register(client, email="abc")
    assert response.status_code == 400
    assert response.get_json()["fields"]["email"] == "Please enter a valid email address."


def test_register_rejects_empty_name(client):
    response = register(client, full_name="   ")
    assert response.status_code == 400
    assert "full_name" in response.get_json()["fields"]


def test_register_rejects_missing_body(client):
    response = client.post("/api/auth/register", data="not json", content_type="text/plain")
    assert response.status_code == 400
    assert set(response.get_json()["fields"]) == {"full_name", "email", "password"}


def test_register_rejects_wrong_types(client):
    response = client.post("/api/auth/register", json={"full_name": 123, "email": ["x"], "password": None})
    assert response.status_code == 400
    assert set(response.get_json()["fields"]) == {"full_name", "email", "password"}


def test_register_duplicate_email_is_409(client):
    register(client)
    response = register(client)
    assert response.status_code == 409
    assert response.get_json()["error"] == "This email is already registered."


def test_register_email_is_case_insensitive(client):
    register(client, email=" Ali@Mail.com ")
    assert User.query.one().email == "ali@mail.com"
    assert register(client, email="ali@mail.com").status_code == 409


def test_login_success_returns_token_and_user(client):
    register(client)
    response = login(client)
    assert response.status_code == 200
    body = response.get_json()
    assert body["user"] == {"user_id": User.query.one().user_id, "full_name": "Ali Ahmad",
                            "email": "ali@mail.com", "role": "general_user"}
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200 and me.get_json()["user"] == body["user"]


def test_login_wrong_password_message(client):
    register(client)
    response = login(client, password="Wrong123")
    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_login_unknown_email_same_message(client):
    response = login(client, email="nobody@mail.com")
    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_login_email_is_case_insensitive(client):
    register(client)
    assert login(client, email=" ALI@mail.com ").status_code == 200


def test_login_inactive_account_is_403(client, make_user):
    make_user("gone@mail.com", status="inactive")
    response = login(client, email="gone@mail.com")
    assert response.status_code == 403
    assert response.get_json()["error"] == "This account has been deactivated."


def test_login_inactive_account_wrong_password_is_401(client, make_user):
    make_user("gone@mail.com", status="inactive")
    assert login(client, email="gone@mail.com", password="Wrong123").status_code == 401


def test_login_missing_body_is_401(client):
    response = client.post("/api/auth/login", data="x", content_type="text/plain")
    assert response.status_code == 401


def test_login_writes_logs(client):
    register(client)
    login(client, password="Wrong123")
    login(client)
    actions = {(log.action, log.user_id is None) for log in SystemLog.query.all()}
    assert ("LOGIN_FAILED", True) in actions
    assert ("LOGIN", False) in actions
    assert ("REGISTER", False) in actions


def test_me_requires_login(client):
    assert client.get("/api/auth/me").status_code == 401
