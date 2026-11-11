from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("SECRET_KEY is not set. Copy .env.example to .env and fill it in.")

    CORS(app)
    db.init_app(app)

    from app import models  # noqa: F401  (registers the tables with SQLAlchemy)

    @app.cli.command("init-db")
    def init_db():
        """Create any missing tables. Existing tables and data are not changed."""
        db.create_all()
        print("Database tables created.")

    @app.cli.command("create-admin")
    def create_admin():
        """Create an administrator account. Admins cannot self-register (UC-100 constraint)."""
        import click
        from werkzeug.security import generate_password_hash
        from app.models import SystemLog, User
        from app.validation import password_problem

        full_name = click.prompt("Full name").strip()
        email = click.prompt("Email").strip().lower()
        if User.query.filter_by(email=email).first():
            raise click.ClickException("This email is already registered.")
        password = click.prompt("Password", hide_input=True, confirmation_prompt=True)
        if problem := password_problem(password):
            raise click.ClickException(problem)

        admin = User(full_name=full_name, email=email, role="admin", status="active",
                     password_hash=generate_password_hash(password))
        db.session.add(admin)
        db.session.flush()
        db.session.add(SystemLog(user_id=None, action="CREATE_ADMIN",
                                 description=f"Admin account created via CLI (user_id={admin.user_id})."))
        db.session.commit()
        print(f"Admin account created for {email}.")

    @app.route("/")
    def home():
        return {"message": "CardioXplain backend is running", "status": "success"}

    return app
