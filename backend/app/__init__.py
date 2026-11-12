from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()


def create_app(overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.update(overrides or {})  # tests use this to point at the test database
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("SECRET_KEY is not set. Copy .env.example to .env and fill it in.")

    # Only the React frontend may call the API from a browser (CHANGES.md #16).
    CORS(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}})
    db.init_app(app)

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify(error="Not found."), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return jsonify(error="Method not allowed."), 405

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error="The request is too large."), 413

    @app.errorhandler(500)
    def server_error(_error):
        return jsonify(error="Something went wrong. Please try again later."), 500

    from app import models  # noqa: F401  (registers the tables with SQLAlchemy)
    from app.routes.action_plan import action_plan_bp
    from app.routes.admin import admin_bp
    from app.routes.auth import auth_bp
    from app.routes.history import history_bp
    from app.routes.navigator import navigator_bp
    from app.routes.predict import predict_bp
    from app.routes.simulation import simulation_bp

    app.register_blueprint(action_plan_bp, url_prefix="/api/action-plan")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(history_bp, url_prefix="/api/history")
    app.register_blueprint(navigator_bp, url_prefix="/api/navigator")
    app.register_blueprint(predict_bp, url_prefix="/api/predict")
    app.register_blueprint(simulation_bp, url_prefix="/api/simulation")

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
