"""CHANGES.md #29: smoking effect from Framingham added to the main model's score (approach C)."""
import math

import pytest

from app.validation import assessment_problems

AMOUNTS = {"drinks_per_week": 0, "activity_minutes": 200}


def values_for(valid_input, **changes):
    data = {k: v for k, v in valid_input.items() if k not in ("smoke", "alco", "active")}
    values, fields = assessment_problems({**data, **AMOUNTS, **changes})
    assert not fields
    return values


def test_smoking_log_odds_per_cigarette_capped_and_yes_no(valid_input):
    from app.services.ml_service import PER_CIGARETTE, PER_SMOKER, smoking_log_odds
    assert PER_CIGARETTE == pytest.approx(0.02032) and PER_SMOKER == pytest.approx(0.40115)
    assert smoking_log_odds(values_for(valid_input, cigarettes_per_day=0)) == 0
    assert smoking_log_odds(values_for(valid_input, cigarettes_per_day=20)) == pytest.approx(20 * PER_CIGARETTE)
    assert smoking_log_odds(values_for(valid_input, cigarettes_per_day=70)) == pytest.approx(40 * PER_CIGARETTE)
    old_yes_no = assessment_problems({**valid_input, "smoke": 1})[0]  # saved before amounts existed
    assert smoking_log_odds(old_yes_no) == pytest.approx(PER_SMOKER)


def test_adjusted_probability_shifts_the_log_odds(valid_input):
    from app.services.ml_service import model_probability, predict_probability, smoking_log_odds
    smoker = values_for(valid_input, cigarettes_per_day=20)
    raw = model_probability(smoker)
    expected = 1 / (1 + math.exp(-(math.log(raw / (1 - raw)) + smoking_log_odds(smoker))))
    assert predict_probability(smoker) == pytest.approx(expected)
    non_smoker = values_for(valid_input, cigarettes_per_day=0)
    assert predict_probability(non_smoker) == pytest.approx(model_probability(non_smoker))


def test_shap_still_adds_up_and_smoking_row_carries_the_adjustment(valid_input):
    from app.services.ml_service import model_probability, predict_probability
    from app.services.shap_service import baseline, explain
    smoker = values_for(valid_input, cigarettes_per_day=20)
    items = explain(smoker)
    assert baseline() + sum(i["shap"] for i in items) == pytest.approx(predict_probability(smoker), abs=1e-3)
    smoking = next(i for i in items if i["feature"] == "smoke")
    assert smoking["shap"] >= predict_probability(smoker) - model_probability(smoker) - 1e-3
    assert smoking["adjusted"] is True


def test_twenty_a_day_raises_the_score_clearly(client, user_headers, fake_llm, valid_input):
    def score(cigs):
        body = {**{k: v for k, v in valid_input.items() if k not in ("smoke", "alco", "active")},
                **AMOUNTS, "cigarettes_per_day": cigs}
        return client.post("/api/predict", json=body, headers=user_headers).get_json()["risk_score"]
    assert score(20) - score(0) > 0.03


def test_quitting_smoking_in_the_simulator_shows_a_real_drop(client, user_headers, fake_llm, valid_input):
    body = {**{k: v for k, v in valid_input.items() if k not in ("smoke", "alco", "active")},
            **AMOUNTS, "cigarettes_per_day": 20}
    assert client.post("/api/predict", json=body, headers=user_headers).status_code == 201
    result = client.post("/api/simulation", json={"cigarettes_per_day": 0}, headers=user_headers).get_json()
    assert result["change_percent_points"] < -3


def test_simulator_recalculates_before_for_assessments_saved_without_the_adjustment(
        client, user_headers, fake_llm, valid_input):
    from app import db
    from app.models import Prediction
    body = {**{k: v for k, v in valid_input.items() if k not in ("smoke", "alco", "active")},
            **AMOUNTS, "cigarettes_per_day": 20}
    assert client.post("/api/predict", json=body, headers=user_headers).status_code == 201
    saved = Prediction.query.one()
    saved.risk_score = 0.40  # as if saved by the old calculation
    db.session.commit()
    result = client.post("/api/simulation", json={"weight": 79}, headers=user_headers).get_json()
    assert result["original"]["risk_score"] != 0.40
    assert abs(result["change_percent_points"]) < 2  # 1 kg less, not a jump from the old score
