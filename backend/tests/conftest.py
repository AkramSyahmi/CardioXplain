"""Shared test fixtures. Tests use a separate MySQL database so real data is never touched."""
import pymysql
import pytest
from flask import Blueprint, g, jsonify
from sqlalchemy.engine import make_url

from config import Config

TEST_DATABASE = "cardioxplain_test_db"
TEST_PASSWORD = "Passw0rd!"


def _test_database_url():
    url = make_url(Config.SQLALCHEMY_DATABASE_URI).set(database=TEST_DATABASE)
    conn = pymysql.connect(host=url.host or "localhost", port=url.port or 3306,
                           user=url.username, password=url.password or "")
    with conn.cursor() as cursor:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {TEST_DATABASE} "
                       "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    conn.close()
    return url.render_as_string(hide_password=False)


@pytest.fixture(scope="session")
def app():
    from app import create_app, db
    from app.auth import login_required

    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": _test_database_url()})

    # Test-only routes for checking login_required before real routes exist.
    test_bp = Blueprint("test_only", __name__)

    @test_bp.get("/user")
    @login_required()
    def any_user():
        return jsonify(user_id=g.user.user_id)

    @test_bp.get("/admin")
    @login_required("admin")
    def admin_only():
        return jsonify(user_id=g.user.user_id)

    app.register_blueprint(test_bp, url_prefix="/api/_test")

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db(app):
    """Empty every table after each test (children before parents)."""
    yield
    from app import db
    from app.models import (HealthPlan, LlmNarrative, Prediction, PredictionInput,
                            ShapExplanation, SystemLog, User)
    db.session.rollback()
    for model in (SystemLog, HealthPlan, LlmNarrative, ShapExplanation,
                  PredictionInput, Prediction, User):
        db.session.query(model).delete()
    db.session.commit()


@pytest.fixture
def make_user(app):
    from werkzeug.security import generate_password_hash
    from app import db
    from app.models import User

    def _make(email, password=TEST_PASSWORD, role="general_user", status="active"):
        user = User(full_name="Test User", email=email, role=role, status=status,
                    password_hash=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        return user
    return _make


def _headers_for(user):
    from app.auth import make_token
    return {"Authorization": f"Bearer {make_token(user)}"}


@pytest.fixture
def user_headers(make_user):
    return _headers_for(make_user("user@test.com"))


@pytest.fixture
def admin_headers(make_user):
    return _headers_for(make_user("admin@test.com", role="admin"))


class FakeLLM:
    def __init__(self):
        self.reply = "Your risk is moderate. Please consult a healthcare professional."
        self.fail = False
        self.calls = []

    def __call__(self, system, messages):
        from app.services.llm_service import LLMUnavailable
        self.calls.append({"system": system, "messages": messages})
        if self.fail:
            raise LLMUnavailable("fake failure")
        return self.reply


@pytest.fixture
def fake_llm(monkeypatch):
    """Replace the real LLM so tests use no credits."""
    from app.services import llm_service
    fake = FakeLLM()
    monkeypatch.setattr(llm_service, "chat", fake)
    return fake
