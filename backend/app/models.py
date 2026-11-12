"""Database tables for CardioXplain (data dictionary, Tables 3.28 - 3.34)."""
from sqlalchemy import CheckConstraint, func

from app import db


class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum("admin", "general_user", name="user_role"),
                     nullable=False, default="general_user")
    status = db.Column(db.Enum("active", "inactive", name="user_status"),
                       nullable=False, default="active")
    created_at = db.Column(db.DateTime, server_default=func.now())

    predictions = db.relationship("Prediction", back_populates="user")


class Prediction(db.Model):
    __tablename__ = "predictions"
    __table_args__ = (
        CheckConstraint("risk_score BETWEEN 0 AND 1", name="chk_risk_score"),
    )

    prediction_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    risk_score = db.Column(db.Float, nullable=False)
    risk_category = db.Column(db.Enum("Low", "Moderate", "High", name="risk_category"),
                              nullable=False)
    prediction_date = db.Column(db.DateTime, server_default=func.now())

    user = db.relationship("User", back_populates="predictions")
    inputs = db.relationship("PredictionInput", uselist=False, back_populates="prediction")
    shap = db.relationship("ShapExplanation", uselist=False, back_populates="prediction")
    narrative = db.relationship("LlmNarrative", uselist=False, back_populates="prediction")
    health_plan = db.relationship("HealthPlan", uselist=False, back_populates="prediction")


class PredictionInput(db.Model):
    __tablename__ = "prediction_inputs"
    # Ranges follow Table 3.30. The backend validates first so users get clear messages;
    # these checks are a second layer if data is ever written another way.
    __table_args__ = (
        CheckConstraint("age BETWEEN 1 AND 120", name="chk_age"),
        CheckConstraint("height BETWEEN 50 AND 250", name="chk_height"),
        CheckConstraint("weight BETWEEN 20 AND 300", name="chk_weight"),
        CheckConstraint("ap_hi BETWEEN 60 AND 300", name="chk_ap_hi"),
        CheckConstraint("ap_lo BETWEEN 40 AND 200", name="chk_ap_lo"),
        CheckConstraint("cholesterol BETWEEN 1 AND 3", name="chk_cholesterol"),
        CheckConstraint("gluc BETWEEN 1 AND 3", name="chk_gluc"),
    )

    input_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    # unique=True enforces the one-to-one link in the ERD (Table 3.27).
    prediction_id = db.Column(db.Integer, db.ForeignKey("predictions.prediction_id"),
                              nullable=False, unique=True)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.Enum("male", "female", name="gender"), nullable=False)
    height = db.Column(db.Float, nullable=False)
    weight = db.Column(db.Float, nullable=False)
    bmi = db.Column(db.Float, nullable=False)
    ap_hi = db.Column(db.Integer, nullable=False)
    ap_lo = db.Column(db.Integer, nullable=False)
    cholesterol = db.Column(db.Integer, nullable=False)
    gluc = db.Column(db.Integer, nullable=False)
    smoke = db.Column(db.Boolean, nullable=False)
    alco = db.Column(db.Boolean, nullable=False)
    active = db.Column(db.Boolean, nullable=False)

    prediction = db.relationship("Prediction", back_populates="inputs")


class ShapExplanation(db.Model):
    __tablename__ = "shap_explanations"

    shap_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    prediction_id = db.Column(db.Integer, db.ForeignKey("predictions.prediction_id"),
                              nullable=False, unique=True)
    feature_1 = db.Column(db.String(100), nullable=False)
    shap_value_1 = db.Column(db.Float, nullable=False)
    feature_2 = db.Column(db.String(100), nullable=False)
    shap_value_2 = db.Column(db.Float, nullable=False)
    feature_3 = db.Column(db.String(100), nullable=False)
    shap_value_3 = db.Column(db.Float, nullable=False)
    # Added in FYP2 (CHANGES.md #7): every feature's SHAP value, so History can redraw the full chart.
    all_shap_values = db.Column(db.JSON, nullable=False)

    prediction = db.relationship("Prediction", back_populates="shap")


class LlmNarrative(db.Model):
    __tablename__ = "llm_narratives"

    narrative_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    prediction_id = db.Column(db.Integer, db.ForeignKey("predictions.prediction_id"),
                              nullable=False, unique=True)
    narrative_text = db.Column(db.Text, nullable=False)
    generated_at = db.Column(db.DateTime, nullable=False, server_default=func.now())

    prediction = db.relationship("Prediction", back_populates="narrative")


class HealthPlan(db.Model):
    __tablename__ = "health_plans"

    plan_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    prediction_id = db.Column(db.Integer, db.ForeignKey("predictions.prediction_id"),
                              nullable=False, unique=True)
    plan_text = db.Column(db.Text, nullable=False)
    generated_at = db.Column(db.DateTime, nullable=False, server_default=func.now())

    prediction = db.relationship("Prediction", back_populates="health_plan")


class SystemLog(db.Model):
    __tablename__ = "system_logs"

    log_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    # Nullable so system-level events can be logged without a user (Table 3.33).
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, nullable=False, server_default=func.now())


def log_event(action, description=None, user_id=None):
    """Add one activity log row (Table 3.33). The caller commits the session."""
    db.session.add(SystemLog(action=action, description=description, user_id=user_id))
