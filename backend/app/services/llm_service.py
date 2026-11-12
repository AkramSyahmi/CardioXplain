"""LLM explanations (section 3.2.8). Uses an OpenAI-compatible server set in .env (CHANGES.md #6)."""
import json
import re
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

from flask import current_app
from openai import OpenAI

from app.models import log_event

DISCLAIMER = "This result is for educational purposes only and does not replace professional medical advice."

# Safety instruction added to every prompt (3.2.8.1 point 4, NFR09).
SAFETY_RULES = (
    "Safety rules: You give general health education only. Do not diagnose any disease, "
    "do not name or recommend medicines, doses or treatments, and do not give emergency advice. "
    "Always remind the user to consult a healthcare professional for medical advice."
)

# Basic safety filter for LLM output (3.2.8.2 step 4).
UNSAFE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE) for pattern in (
        r"you have been diagnosed", r"you have (a )?(heart|cardiovascular) disease",
        r"\b(i|we)\s+(will\s+|would\s+)?prescribe\b", r"\bdosage\b",
        r"\b\d+(\.\d+)?\s?mg\b(?!\s?/)",  # a dose like "50 mg", but not a unit like "200 mg/dL"
    )
]


# Note: 4 worker threads, so at most 4 LLM calls run at once. Increase if many users test together.
_executor = ThreadPoolExecutor(max_workers=4)


class LLMUnavailable(Exception):
    """The LLM could not give a usable reply (network error, timeout, empty reply)."""


def chat(system, messages, max_tokens=400, deadline=None):
    """Send one conversation to the LLM and return the reply text.

    NFR02: the reply must come within LLM_TIMEOUT_SECONDS (10 s) in total. The client's own
    timeout only limits the wait between pieces of data, so the call runs in a worker thread
    with an overall deadline. One attempt only: retries could keep the user waiting ~30 s.
    Longer replies (the calendar plan) pass a bigger max_tokens and deadline.
    """
    config = current_app.config
    deadline = deadline or config["LLM_TIMEOUT_SECONDS"]
    try:
        client = OpenAI(api_key=config["LLM_API_KEY"], base_url=config["LLM_BASE_URL"],
                        timeout=deadline, max_retries=0)
        future = _executor.submit(
            client.chat.completions.create,
            model=config["LLM_MODEL"],
            max_tokens=max_tokens,  # 400 by default: keeps replies short and fast
            messages=[{"role": "system", "content": system}, *messages],
        )
        response = future.result(timeout=deadline)
        text = (response.choices[0].message.content or "").strip()
    except FutureTimeout as error:
        future.cancel()  # drops it if still waiting for a free thread (a running call cannot be stopped)
        log_event("LLM_CALL", f"failed: no reply within {deadline} s")
        raise LLMUnavailable("timeout") from error
    except Exception as error:  # any failure (network, bad reply shape) means "unavailable", never a crash
        log_event("LLM_CALL", f"failed: {type(error).__name__}")
        raise LLMUnavailable(str(error)) from error
    if not text:
        log_event("LLM_CALL", "failed: empty reply")
        raise LLMUnavailable("empty reply")
    log_event("LLM_CALL", "success")
    return text


def is_safe(text):
    return not any(pattern.search(text) for pattern in UNSAFE_PATTERNS)


def _percent(score):
    return round(score * 100)


def _factor_lines(top):
    return "\n".join(
        f"- {item['label']} (value: {item['value']}): "
        f"{'raises' if item['shap'] > 0 else 'lowers'} the risk by {abs(item['shap']) * 100:.1f} percentage points"
        for item in top[:3]
    )


YES_NO = {0: "No", 1: "Yes"}
AMOUNT_LABELS = {"cigarettes_per_day": "Cigarettes per day", "drinks_per_week": "Alcoholic drinks per week",
                 "activity_minutes": "Exercise minutes per week"}


def _lifestyle_lines(v):
    """Lifestyle in words, using the amounts when known (CHANGES.md #24), else Yes/No."""
    smoking = (f"{v['cigarettes_per_day']} cigarettes per day" if v.get("cigarettes_per_day") is not None
               else YES_NO[v["smoke"]])
    alcohol = (f"{v['drinks_per_week']} drinks per week" if v.get("drinks_per_week") is not None
               else YES_NO[v["alco"]])
    activity = (f"{v['activity_minutes']} minutes of moderate exercise per week "
                f"({'meets' if v['active'] else 'below'} the 150-minute WHO guideline)"
                if v.get("activity_minutes") is not None else YES_NO[v["active"]])
    return [f"- Smoking: {smoking}", f"- Alcohol intake: {alcohol}", f"- Physical activity: {activity}"]


def _estimated_labels(estimated):
    from ml.features import FEATURE_LABELS
    return ", ".join(FEATURE_LABELS[name].lower() for name in estimated)


def _fallback_narrative(risk_score, category, top, estimated=()):
    """Pre-written explanation used when the LLM is unavailable or unsafe (3.2.8.2 step 6)."""
    text = f"Your predicted cardiovascular risk is {category} ({_percent(risk_score)}%). "
    if top:
        direction = "increased" if top[0]["shap"] > 0 else "lowered"
        text += f"The factor that most affected this result is {top[0]['label']}, which {direction} your risk. "
    if estimated:
        text += (f"This result is estimated because typical values were used for: {_estimated_labels(estimated)}. "
                 "Getting these measured would make it more accurate. ")
    return text + DISCLAIMER + " Please consult a healthcare professional."


def risk_narrative(risk_score, category, top, estimated=(), values=None):
    """Plain-language explanation of a risk result (UC-400). Returns (text, source)."""
    system = ("You are a health assistant that explains cardiovascular disease risk results "
              "to a general audience with no medical training. " + SAFETY_RULES)
    prompt = (
        f"Predicted risk category: {category}\n"
        f"Predicted probability: {_percent(risk_score)}%\n"
        + (f"Top contributing factors (from SHAP):\n{_factor_lines(top)}\n" if top else "")
        + ("Lifestyle (the model itself only uses Yes/No for these):\n"
           + "\n".join(_lifestyle_lines(values)) + "\n" if values else "")
        + (f"The user did not know these values, so typical values were used: {_estimated_labels(estimated)}. "
           "Mention that the result is an estimate and suggest getting them measured.\n" if estimated else "")
        + "Write one short paragraph (about 80-120 words) in simple, non-technical language that "
          "explains what this result means and which factors affected it most. "
          "End by recommending the user consult a healthcare professional."
    )
    try:
        text = chat(system, [{"role": "user", "content": prompt}])
    except LLMUnavailable:
        return _fallback_narrative(risk_score, category, top, estimated), "fallback"
    if not is_safe(text):
        log_event("LLM_UNSAFE", "risk narrative replaced by fallback")
        return _fallback_narrative(risk_score, category, top, estimated), "fallback"
    return text, "llm"


def _describe_changes(changes):
    from ml.features import FEATURE_LABELS
    lines = []
    for name, (before, after) in changes.items():
        if name in ("smoke", "alco", "active"):
            before, after = YES_NO[before], YES_NO[after]
        else:  # show 92.0 as 92; an amount missing in an old record shows as "not recorded"
            before, after = ("not recorded" if v is None else int(v) if float(v).is_integer() else v
                             for v in (before, after))
        lines.append(f"- {AMOUNT_LABELS.get(name) or FEATURE_LABELS[name]}: {before} -> {after}")
    return "\n".join(lines)


def simulation_narrative(original, simulated, changes):
    """Explain how a What-If lifestyle change affects the predicted risk (UC-500 step 9).

    original/simulated: {"risk_score", "risk_category"}; changes: {field: (before, after)}.
    Returns (text, source).
    """
    before = f"{original['risk_category']} ({_percent(original['risk_score'])}%)"
    after = f"{simulated['risk_category']} ({_percent(simulated['risk_score'])}%)"
    system = ("You are a health assistant that explains how lifestyle changes may affect a "
              "cardiovascular disease risk estimate, for a general audience. " + SAFETY_RULES)
    prompt = (
        f"Risk before the change: {before}\n"
        f"Risk after the simulated change: {after}\n"
        f"Lifestyle changes simulated:\n{_describe_changes(changes)}\n"
        "Write one short paragraph (about 60-100 words) in simple language explaining how these "
        "changes affect the estimated risk. Make clear this is a simulation, not a guarantee, "
        "and recommend the user consult a healthcare professional."
    )
    fallback = (f"Your simulated risk is {after}, compared with {before} before the change. "
                "This is a simulation only. " + DISCLAIMER)
    try:
        text = chat(system, [{"role": "user", "content": prompt}])
    except LLMUnavailable:
        return fallback, "fallback"
    if not is_safe(text):
        log_event("LLM_UNSAFE", "simulation narrative replaced by fallback")
        return fallback, "fallback"
    return text, "llm"


# ---- Calendar health action plan (UC-1000, CHANGES.md #25) ----

PLAN_BLOCKS = ("morning", "afternoon", "evening")
PLAN_TASK_TYPES = ("meal", "workout", "hydration", "sleep", "habit")

WEEK_FORMAT = (
    'Reply with JSON only, no other text, in exactly this shape:\n'
    '{"theme": "short theme for the week", "days": [{"day": 1, "title": "short focus for the day", '
    '"blocks": {"morning": [TASK, ...], "afternoon": [TASK, ...], "evening": [TASK, ...]}}, ...]}\n'
    'where TASK is {"type": "meal" | "workout" | "hydration" | "sleep" | "habit", '
    '"task": "what to do, with exact amounts or times", "steps": ["checklist step", ...]}.'
)


def _valid_task(task):
    return (isinstance(task, dict) and task.get("type") in PLAN_TASK_TYPES
            and isinstance(task.get("task"), str) and task["task"].strip()
            and isinstance(task.get("steps"), list) and 1 <= len(task["steps"]) <= 8
            and all(isinstance(step, str) and step.strip() for step in task["steps"]))


def parse_week(text, days_in_week):
    """Check the LLM's JSON week. Returns {"theme", "days"} or raises LLMUnavailable."""
    text = text.strip()
    if text.startswith("```"):  # some models wrap JSON in a code fence
        text = text.strip("`").removeprefix("json").strip()
    try:
        week = json.loads(text)
        days = week["days"]
        valid = (isinstance(week.get("theme"), str) and isinstance(days, list) and len(days) == days_in_week
                 and all(isinstance(day, dict) and isinstance(day.get("title"), str)
                         and isinstance(day.get("blocks"), dict)
                         and all(isinstance(day["blocks"].get(block), list) and day["blocks"][block]
                                 and all(_valid_task(task) for task in day["blocks"][block])
                                 for block in PLAN_BLOCKS)
                         for day in days))
    except (ValueError, KeyError, TypeError, AttributeError):
        valid = False
    if not valid:
        log_event("LLM_BAD_PLAN", "calendar plan reply had the wrong shape")
        raise LLMUnavailable("bad plan shape")
    return {"theme": week["theme"],
            "days": [{"title": day["title"], "blocks": {b: day["blocks"][b] for b in PLAN_BLOCKS}} for day in days]}


def health_week(category, risk_score, top, lifestyle, week, total_weeks, days_in_week, previous_themes=()):
    """One week of the day-by-day calendar plan (UC-1000 steps 3-5).

    lifestyle: smoke, alco, active, weight, bmi and the amounts (may be None). Returns {"theme", "days"}.
    Raises LLMUnavailable if the LLM fails, the reply has the wrong shape, or any text is unsafe.
    There is no fallback plan (UC-1000 E1 shows a message instead).
    """
    system = ("You are a health coach who writes practical, encouraging day-by-day lifestyle plans for "
              "people with no medical training. " + SAFETY_RULES)
    profile = "\n".join([*_lifestyle_lines(lifestyle),
                         f"- Weight: {lifestyle['weight']} kg, BMI: {lifestyle['bmi']}"])
    progress = (f"Earlier weeks: {'; '.join(previous_themes)}. Make this week slightly more challenging "
                "and build on them.\n" if previous_themes else "")
    caution = ("Because the risk is High, keep workouts light (e.g. easy walking) and include a reminder to see a "
               "doctor before starting a new exercise programme.\n" if category == "High" else "")
    prompt = (
        f"Predicted cardiovascular risk: {category} ({_percent(risk_score)}%)\n"
        + (f"Top contributing factors (from SHAP):\n{_factor_lines(top)}\n" if top else "")
        + f"Current lifestyle:\n{profile}\n"
        + f"Write week {week} of {total_weeks} of a health action plan: {days_in_week} days, numbered from 1.\n"
        + progress + caution
        + "For every day give morning, afternoon and evening blocks. Across each day include meal, workout, "
          "hydration and sleep tasks (and habit tasks for smoking or alcohol if relevant). Every task must be "
          "concrete with exact amounts, durations or times (e.g. '250 ml water', '15-minute brisk walk', "
          "'in bed by 22:30'), and its steps are a checklist the user can follow without guessing. "
          "Use foods commonly eaten in Malaysia, with healthier options. Focus on the factors above. "
          "Do not write amounts in mg; use grams, teaspoons, glasses or plain words "
          "(e.g. 'less than 1 teaspoon of salt a day'). Give at least one task in every block.\n"
        + WEEK_FORMAT
    )
    text = chat(system, [{"role": "user", "content": prompt}],
                max_tokens=6000, deadline=current_app.config["LLM_PLAN_TIMEOUT_SECONDS"])
    week_data = parse_week(text, days_in_week)
    if not is_safe(json.dumps(week_data)):
        log_event("LLM_UNSAFE", "health plan rejected")
        raise LLMUnavailable("unsafe plan")
    return week_data


def navigator_reply(messages, category=None, top=None):
    """Virtual Care Navigator answer (UC-700). messages: cleaned chat ending with the user's question.

    The user's latest risk result is added to the system prompt so answers are personal.
    Raises LLMUnavailable if the LLM fails or the reply is unsafe.
    """
    system = ("You are CardioXplain's Virtual Care Navigator. You answer questions about "
              "cardiovascular health, risk factors, healthy lifestyle, and when to seek medical "
              "help, in simple language for people with no medical training. Keep answers under "
              "150 words. If a question is not about health, politely say you can only help with "
              "heart health topics. If the user describes chest pain or other emergency symptoms, say this "
              "tool cannot help with emergencies and tell them to call 999 immediately. " + SAFETY_RULES)
    if category:
        system += f"\nThe user's latest risk category is {category}."
        if top:
            system += f" Main factors in their result:\n{_factor_lines(top)}"
    text = chat(system, messages)
    if not is_safe(text):
        log_event("LLM_UNSAFE", "navigator reply blocked")
        raise LLMUnavailable("unsafe reply")
    return text
