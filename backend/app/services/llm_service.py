"""LLM explanations (section 3.2.8). Uses an OpenAI-compatible server set in .env (CHANGES.md #6)."""
import re
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

from flask import current_app
from openai import OpenAI, OpenAIError

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
        r"\bprescrib", r"\bdosage\b", r"\b\d+(\.\d+)?\s?mg\b",
    )
]


# Note: 4 worker threads, so at most 4 LLM calls run at once. Increase if many users test together.
_executor = ThreadPoolExecutor(max_workers=4)


class LLMUnavailable(Exception):
    """The LLM could not give a usable reply (network error, timeout, empty reply)."""


def chat(system, messages):
    """Send one conversation to the LLM and return the reply text.

    NFR02: the reply must come within LLM_TIMEOUT_SECONDS (10 s) in total. The client's own
    timeout only limits the wait between pieces of data, so the call runs in a worker thread
    with an overall deadline. One attempt only: retries could keep the user waiting ~30 s.
    """
    config = current_app.config
    deadline = config["LLM_TIMEOUT_SECONDS"]
    try:
        client = OpenAI(api_key=config["LLM_API_KEY"], base_url=config["LLM_BASE_URL"],
                        timeout=deadline, max_retries=0)
        future = _executor.submit(
            client.chat.completions.create,
            model=config["LLM_MODEL"],
            max_tokens=400,  # keeps replies short and fast
            messages=[{"role": "system", "content": system}, *messages],
        )
        response = future.result(timeout=deadline)
        text = (response.choices[0].message.content or "").strip()
    except FutureTimeout as error:
        log_event("LLM_CALL", f"failed: no reply within {deadline} s")
        raise LLMUnavailable("timeout") from error
    except (OpenAIError, IndexError, AttributeError) as error:
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


def _fallback_narrative(risk_score, category, top):
    """Pre-written explanation used when the LLM is unavailable or unsafe (3.2.8.2 step 6)."""
    text = f"Your predicted cardiovascular risk is {category} ({_percent(risk_score)}%). "
    if top:
        direction = "increased" if top[0]["shap"] > 0 else "lowered"
        text += f"The factor that most affected this result is {top[0]['label']}, which {direction} your risk. "
    return text + DISCLAIMER + " Please consult a healthcare professional."


def risk_narrative(risk_score, category, top):
    """Plain-language explanation of a risk result (UC-400). Returns (text, source)."""
    system = ("You are a health assistant that explains cardiovascular disease risk results "
              "to a general audience with no medical training. " + SAFETY_RULES)
    prompt = (
        f"Predicted risk category: {category}\n"
        f"Predicted probability: {_percent(risk_score)}%\n"
        + (f"Top contributing factors (from SHAP):\n{_factor_lines(top)}\n" if top else "")
        + "Write one short paragraph (about 80-120 words) in simple, non-technical language that "
          "explains what this result means and which factors affected it most. "
          "End by recommending the user consult a healthcare professional."
    )
    try:
        text = chat(system, [{"role": "user", "content": prompt}])
    except LLMUnavailable:
        return _fallback_narrative(risk_score, category, top), "fallback"
    if not is_safe(text):
        log_event("LLM_UNSAFE", "risk narrative replaced by fallback")
        return _fallback_narrative(risk_score, category, top), "fallback"
    return text, "llm"


YES_NO = {0: "No", 1: "Yes"}


def _describe_changes(changes):
    from ml.features import FEATURE_LABELS
    lines = []
    for name, (before, after) in changes.items():
        if name in ("smoke", "alco", "active"):
            before, after = YES_NO[before], YES_NO[after]
        else:  # show 92.0 as 92
            before, after = (int(v) if float(v).is_integer() else v for v in (before, after))
        lines.append(f"- {FEATURE_LABELS[name]}: {before} -> {after}")
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
