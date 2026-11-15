"""Task 3: validation, model, SHAP and LLM services."""
import pytest

from app.validation import assessment_problems


def test_assessment_problems_accepts_valid_input(valid_input):
    values, fields = assessment_problems(valid_input)
    assert fields == {}
    assert values["bmi"] == 27.68  # 80 / 1.70^2
    assert values["smoke"] == 0 and values["gender"] == "male"


def test_assessment_problems_accepts_numeric_strings_and_booleans(valid_input):
    values, fields = assessment_problems({**valid_input, "age": "50", "weight": "80.5", "active": True})
    assert fields == {}
    assert values["age"] == 50 and values["weight"] == 80.5 and values["active"] == 1


def test_assessment_problems_range_messages(valid_input):
    _, fields = assessment_problems({**valid_input, "age": 17, "ap_hi": 350, "cholesterol": 4})
    assert fields["age"] == "Age must be between 18 and 100 years."
    assert fields["ap_hi"] == "Systolic blood pressure must be between 60 and 300 mmHg."
    assert fields["cholesterol"] == "Please choose a cholesterol level (Normal, Above normal, or Well above normal)."


def test_ages_outside_the_training_data_are_accepted(valid_input):
    """CHANGES.md #30: adults 18-100 can use the tool, not only the dataset's 30-65."""
    for age in (18, 25, 70, 100):
        assert "age" not in assessment_problems({**valid_input, "age": age})[1]
    assert "age" in assessment_problems({**valid_input, "age": 101})[1]


def test_assessment_problems_ap_lo_above_ap_hi(valid_input):
    _, fields = assessment_problems({**valid_input, "ap_hi": 110, "ap_lo": 120})
    assert fields["ap_lo"] == "Diastolic blood pressure cannot be higher than systolic blood pressure."


def test_assessment_problems_wrong_types(valid_input):
    _, fields = assessment_problems({**valid_input, "age": "abc", "smoke": "yes", "gender": "other", "height": None})
    assert set(fields) == {"age", "smoke", "gender", "height"}
    assert fields["gender"] == "Please choose Male or Female."
    assert fields["height"] == "This field is required."


def test_assessment_problems_rejects_age_with_decimals_and_bool_as_number(valid_input):
    _, fields = assessment_problems({**valid_input, "age": 50.5, "ap_hi": True})
    assert set(fields) == {"age", "ap_hi"}


def test_predict_probability_between_0_and_1(valid_input):
    from app.services.ml_service import predict_probability
    values, _ = assessment_problems(valid_input)
    assert 0 <= predict_probability(values) <= 1


def test_shap_values_add_up_to_probability(valid_input):
    from app.services.ml_service import predict_probability
    from app.services.shap_service import baseline, explain
    values, _ = assessment_problems(valid_input)
    total = baseline() + sum(item["shap"] for item in explain(values))
    assert total == pytest.approx(predict_probability(values), abs=1e-3)  # shap rounded to 4 dp x 12


def test_shap_returns_all_12_features_sorted(valid_input):
    from app.services.shap_service import explain
    values, _ = assessment_problems(valid_input)
    items = explain(values)
    assert len(items) == 12
    assert [abs(i["shap"]) for i in items] == sorted((abs(i["shap"]) for i in items), reverse=True)
    assert {"feature", "label", "value", "shap"} <= set(items[0])
    systolic = next(i for i in items if i["feature"] == "ap_hi")
    assert systolic["label"] == "Systolic blood pressure" and systolic["value"] == 140


def test_is_safe_blocks_diagnosis_and_dose():
    from app.services.llm_service import is_safe
    assert not is_safe("Take 50 mg aspirin every day.")
    assert not is_safe("You have heart disease.")
    assert not is_safe("I will prescribe a statin.")
    assert is_safe("Regular exercise may help. Please consult a healthcare professional.")


def test_risk_narrative_uses_llm(fake_llm):
    from app.services.llm_service import risk_narrative
    top = [{"feature": "ap_hi", "label": "Systolic blood pressure", "value": 140, "shap": 0.15}]
    text, source = risk_narrative(0.62, "Moderate", top)
    assert (text, source) == (fake_llm.reply, "llm")


def test_risk_narrative_fallback_when_llm_fails(fake_llm):
    from app.services.llm_service import risk_narrative
    fake_llm.fail = True
    top = [{"feature": "ap_hi", "label": "Systolic blood pressure", "value": 140, "shap": 0.15}]
    text, source = risk_narrative(0.62, "Moderate", top)
    assert source == "fallback"
    assert "Moderate (62%)" in text and "Systolic blood pressure" in text and "increased" in text


def test_risk_narrative_fallback_when_llm_text_unsafe(fake_llm):
    from app.services.llm_service import risk_narrative
    fake_llm.reply = "Take 20 mg of a statin daily."
    top = [{"feature": "age", "label": "Age", "value": 40, "shap": -0.05}]
    text, source = risk_narrative(0.20, "Low", top)
    assert source == "fallback" and "lowered" in text


def test_risk_narrative_prompt_has_safety_rules_and_data(fake_llm):
    from app.services.llm_service import SAFETY_RULES, risk_narrative
    top = [{"feature": "ap_hi", "label": "Systolic blood pressure", "value": 140, "shap": 0.15},
           {"feature": "age", "label": "Age", "value": 50, "shap": 0.05},
           {"feature": "active", "label": "Physical activity", "value": 1, "shap": -0.02}]
    risk_narrative(0.62, "Moderate", top)
    call = fake_llm.calls[0]
    assert SAFETY_RULES in call["system"]
    prompt = call["messages"][-1]["content"]
    assert "Moderate" in prompt and "62%" in prompt
    assert "Systolic blood pressure" in prompt and "Physical activity" in prompt and "lowers" in prompt


def test_chat_has_hard_time_limit_and_no_retries(app, monkeypatch):
    """NFR02: one attempt with a 10 s timeout, so a slow server falls back instead of waiting ~30 s."""
    from app.services import llm_service
    seen = {}

    class FakeClient:
        def __init__(self, **kwargs):
            seen["client"] = kwargs
            self.chat = self
            self.completions = self

        def create(self, **kwargs):
            seen["request"] = kwargs
            message = type("M", (), {"content": "Please consult a healthcare professional."})
            return type("R", (), {"choices": [type("C", (), {"message": message})]})

    monkeypatch.setattr(llm_service, "OpenAI", FakeClient)
    assert llm_service.chat("system", [{"role": "user", "content": "hi"}])
    assert seen["client"]["timeout"] == 10 and seen["client"]["max_retries"] == 0
    assert seen["request"]["max_tokens"] <= 400


def test_chat_gives_up_at_total_deadline(app, monkeypatch):
    """A server that is slow overall (not just between bytes) must still stop at the deadline."""
    import time as clock
    from app.services import llm_service

    class SlowClient:
        def __init__(self, **kwargs):
            self.chat = self
            self.completions = self

        def create(self, **kwargs):
            clock.sleep(2)

    monkeypatch.setattr(llm_service, "OpenAI", SlowClient)
    monkeypatch.setitem(app.config, "LLM_TIMEOUT_SECONDS", 0.3)
    start = clock.perf_counter()
    with pytest.raises(llm_service.LLMUnavailable):
        llm_service.chat("system", [{"role": "user", "content": "hi"}])
    assert clock.perf_counter() - start < 1


def test_is_safe_allows_normal_health_answers():
    """Final review #1: units and everyday phrases must not be blocked."""
    from app.services.llm_service import is_safe
    assert is_safe("A healthy total cholesterol is usually below 200 mg/dL.")
    assert is_safe("Fasting glucose under 100 mg/dl is considered normal.")
    assert is_safe("Keep taking any medicines as prescribed by your doctor.")
    assert not is_safe("We would prescribe a statin for you.")
    assert not is_safe("Take 81 mg of aspirin.")


def test_chat_malformed_reply_becomes_llm_unavailable(app, monkeypatch):
    """Final review #2: a 200 reply without "choices" (e.g. {"error": ...}) must not crash."""
    from app.services import llm_service

    class BrokenClient:
        def __init__(self, **kwargs):
            self.chat = self
            self.completions = self

        def create(self, **kwargs):
            return type("R", (), {"choices": None})()

    monkeypatch.setattr(llm_service, "OpenAI", BrokenClient)
    with pytest.raises(llm_service.LLMUnavailable):
        llm_service.chat("system", [{"role": "user", "content": "hi"}])
    top = [{"feature": "age", "label": "Age", "value": 50, "shap": 0.05}]
    text, source = llm_service.risk_narrative(0.5, "Moderate", top)
    assert source == "fallback"


def test_plan_call_asks_for_json_mode(app, monkeypatch):
    """DeepSeek sometimes dropped a closing brace in the long plan JSON; JSON mode guarantees valid JSON."""
    from app.services import llm_service
    requests = []

    class FakeClient:
        def __init__(self, **kwargs):
            self.chat = self
            self.completions = self

        def create(self, **kwargs):
            requests.append(kwargs)
            message = type("M", (), {"content": "{}"})
            return type("R", (), {"choices": [type("C", (), {"message": message})]})

    monkeypatch.setattr(llm_service, "OpenAI", FakeClient)
    llm_service.chat("system", [{"role": "user", "content": "plan"}], long_reply=True)
    llm_service.chat("system", [{"role": "user", "content": "hi"}])
    assert requests[0]["response_format"] == {"type": "json_object"}
    assert "response_format" not in requests[1]


def test_parse_week_accepts_flat_days(app):
    """The prompt asks for morning/afternoon/evening directly on each day (no "blocks" level):
    with the extra level DeepSeek kept dropping the brace that closes each day."""
    import json
    from app.services.llm_service import WEEK_FORMAT, parse_week
    task = {"type": "meal", "task": "Oats with banana", "steps": ["Cook 1/2 cup oats"]}
    flat = {"theme": "Start", "days": [{"day": n, "title": f"Day {n}", "morning": [task], "afternoon": [task],
                                         "evening": [task]} for n in (1, 2)]}
    week = parse_week(json.dumps(flat), 2)
    assert week["days"][1]["blocks"]["evening"] == [task]
    assert '"blocks"' not in WEEK_FORMAT
