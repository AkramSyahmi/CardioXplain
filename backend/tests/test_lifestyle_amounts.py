"""Extra task: lifestyle amounts instead of only Yes/No (CHANGES.md #24)."""
from app.models import PredictionInput
from app.validation import assessment_problems

AMOUNTS = {"cigarettes_per_day": 20, "drinks_per_week": 0, "activity_minutes": 120}


def without_flags(valid_input):
    return {k: v for k, v in valid_input.items() if k not in ("smoke", "alco", "active")}


def test_amounts_become_yes_no_for_the_model(valid_input):
    values, fields = assessment_problems({**without_flags(valid_input), **AMOUNTS})
    assert fields == {}
    assert (values["smoke"], values["alco"], values["active"]) == (1, 0, 0)  # 120 min < 150 (WHO)
    assert values["cigarettes_per_day"] == 20 and values["activity_minutes"] == 120


def test_150_minutes_counts_as_active(valid_input):
    values, _ = assessment_problems({**without_flags(valid_input), **AMOUNTS, "activity_minutes": 150})
    assert values["active"] == 1


def test_amounts_override_old_yes_no_values(valid_input):
    values, _ = assessment_problems({**valid_input, "smoke": 1, "cigarettes_per_day": 0})
    assert values["smoke"] == 0


def test_amount_validation_messages(valid_input):
    _, fields = assessment_problems({**without_flags(valid_input), "cigarettes_per_day": -1,
                                     "drinks_per_week": "abc", "activity_minutes": 99999})
    assert fields["cigarettes_per_day"] == "Cigarettes per day must be between 0 and 100."
    assert fields["drinks_per_week"] == "Please enter a number."
    assert fields["activity_minutes"] == "Exercise minutes per week must be between 0 and 3000."


def test_yes_no_only_input_still_works(valid_input):
    values, fields = assessment_problems(valid_input)
    assert fields == {} and values["cigarettes_per_day"] is None


def test_predict_saves_amounts(client, user_headers, fake_llm, valid_input):
    body = {**without_flags(valid_input), **AMOUNTS}
    result = client.post("/api/predict", json=body, headers=user_headers).get_json()
    saved = PredictionInput.query.one()
    assert (saved.smoke, saved.cigarettes_per_day, saved.activity_minutes) == (True, 20, 120)
    assert result["inputs"]["cigarettes_per_day"] == 20
    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "20 cigarettes per day" in prompt and "120 minutes" in prompt


def test_simulation_with_more_exercise(client, user_headers, fake_llm, valid_input):
    client.post("/api/predict", json={**without_flags(valid_input), **AMOUNTS}, headers=user_headers)
    prefill = client.get("/api/simulation", headers=user_headers).get_json()["inputs"]
    assert prefill["activity_minutes"] == 120
    body = client.post("/api/simulation", json={"activity_minutes": 200}, headers=user_headers).get_json()
    assert body["simulated"]["inputs"]["active"] == 1
    assert body["change_percent_points"] <= 0
    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "Exercise minutes per week: 120 -> 200" in prompt


def test_health_plan_uses_amounts(client, user_headers, fake_llm, valid_input):
    client.post("/api/predict", json={**without_flags(valid_input), **AMOUNTS}, headers=user_headers)
    from conftest import calendar_week
    fake_llm.reply = calendar_week()
    assert client.post("/api/action-plan", json={}, headers=user_headers).status_code == 201
    prompt = fake_llm.calls[-1]["messages"][-1]["content"]
    assert "20 cigarettes per day" in prompt and "120 minutes" in prompt


def test_blank_amount_with_no_yes_no_is_required_on_the_amount_field(valid_input):
    """Phase 5 review #1: the error must be on the field the user can see."""
    _, fields = assessment_problems({**without_flags(valid_input), "drinks_per_week": 0, "activity_minutes": 60})
    assert fields == {"cigarettes_per_day": "This field is required."}


def test_blank_amount_with_a_yes_no_value_is_fine(valid_input):
    values, fields = assessment_problems({**valid_input, "cigarettes_per_day": ""})
    assert fields == {} and values["smoke"] == valid_input["smoke"]
