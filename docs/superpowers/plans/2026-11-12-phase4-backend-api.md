# Phase 4: Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Flask JSON API for all ten CardioXplain use cases so the React frontend (Phase 5) only has to call endpoints.

**Architecture:** One Flask blueprint per feature in `backend/app/routes/`, thin route functions that validate input, call services (`ml_service`, `shap_service`, `llm_service`) and write through the SQLAlchemy models in `app/models.py`. Login uses signed tokens (`itsdangerous`, sent as `Authorization: Bearer <token>`). Every significant action writes one `system_logs` row. Tests run against a separate MySQL test database with the LLM faked.

**Tech Stack:** Python 3.14, Flask 3.1, Flask-SQLAlchemy, PyMySQL, XGBoost 3.2, SHAP 0.52, openai 2.41 (OpenAI-compatible client for the asai server), pytest.

**Spec:** `C:\Users\wanda\Desktop\CARDIOXPLAIN\CARDIOXPLAIN.md` (PSM1 proposal, sections 3.4 Project Requirement and 3.5 Use Case Descriptions, Tables 3.13-3.36) plus decisions in `CHANGES.md` (#1-#14).

**Working rule (student's preference):** one task at a time. Before each task, explain it and wait for "go". Commit and push after each task. Commit messages are plain (no co-author line).

## Global Constraints

- All endpoints live under `/api/...`, accept and return JSON. Errors are `{"error": "<message>"}`, plus `"fields": {"<field>": "<message>"}` for validation errors.
- Run everything from `backend/` with the venv: `venv\Scripts\python -m pytest`.
- Roles: `admin`, `general_user` (Table 3.28). Assessment, simulation, history, plan and navigator endpoints are `general_user` only; `/api/admin/*` is `admin` only.
- Password rule (UC-100): at least 8 characters with uppercase, lowercase and a number. Use existing `app.validation.password_problem`.
- Input ranges (Table 3.30 as changed by CHANGES.md #11): age 30-65, height 120-250 cm, weight 20-300 kg, ap_hi 60-300, ap_lo 40-200, ap_lo <= ap_hi, cholesterol 1-3, gluc 1-3, smoke/alco/active 0 or 1, gender `male`/`female`.
- Risk categories (Table 3.36): Low < 0.40, Moderate 0.40-0.69, High >= 0.70.
- Exact user-facing messages from the use cases (copy verbatim):
  - "Invalid email or password" (UC-100 E2)
  - "Please complete a Risk Assessment first." (UC-500 E1)
  - "No prediction history found. Please complete a Risk Assessment." (UC-600 A1)
  - "The Virtual Care Navigator is currently unavailable. Please try again later." (UC-700 E1)
  - "You cannot deactivate your own administrator account." (UC-800 E1)
  - "Health Action Plan is currently unavailable. Please try again later." (UC-1000 E1)
  - "Password must contain at least 8 characters including uppercase, lowercase, and a number." (UC-100 rule)
- Every LLM prompt includes the safety instruction (3.2.8.1 / NFR09): educational only, no diagnosis, no medication or treatment instructions, recommend consulting a healthcare professional.
- Disclaimer returned with every result, plan and simulation: "This result is for educational purposes only and does not replace professional medical advice."
- NFR01: prediction + SHAP within 5 s. NFR02: LLM narrative within 10 s (LLM client timeout = 10 s).
- Admin endpoints never return another user's health inputs, SHAP values, narratives or plans (UC-800 constraint, UC-900 constraint).
- No new runtime dependencies. Only new dev dependency: pytest (in `requirements-dev.txt`).

## Review Focus

1. **Wrong-type or malformed JSON** (body missing, not JSON, `"age": "abc"`, `"smoke": "yes"`, extra fields): expect 400 with field messages, never a 500. Test owned by Task 3 (`test_predict_rejects_wrong_types_and_missing_body`) and Task 2 (`test_register_rejects_missing_body`).
2. **Another user's record** (`GET /api/history/<id>` for someone else's prediction): expect 404, same as a non-existent id, so ids cannot be probed. Test in Task 5 (`test_history_detail_other_users_record_is_404`).
3. **Deactivated, tampered or expired token** used after login: expect 401 and no data. Tests in Task 1 (`test_tampered_token_is_rejected`, `test_expired_token_is_rejected`) and Task 7 (`test_deactivated_user_token_stops_working`).
4. **LLM slow, down, or returns unsafe text** (mentions diagnosis or medicine dose): assessment still returns score + SHAP with the fallback narrative; plan and navigator return the UC message with 503. Tests in Task 3 (`test_predict_uses_fallback_when_llm_fails`, `test_predict_uses_fallback_when_llm_text_unsafe`), Task 8, Task 9.
5. **Email entered with different case or spaces** (`Ali@Mail.com ` vs `ali@mail.com`): treated as the same account for register and login. Tests in Task 2 (`test_register_email_is_case_insensitive`, `test_login_email_is_case_insensitive`).

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/requirements-dev.txt` (new) | pytest pin |
| `backend/tests/conftest.py` (new) | app + test DB fixtures, `fake_llm`, `user_headers`, `admin_headers` |
| `backend/app/__init__.py` (modify) | register blueprints, JSON error handlers, CORS origin |
| `backend/config.py` (modify) | `FRONTEND_ORIGIN`, `TOKEN_MAX_AGE_SECONDS` |
| `backend/app/auth.py` (new) | `make_token`, `login_required` decorator, `g.user` |
| `backend/app/models.py` (modify) | add `log_event()` helper |
| `backend/app/validation.py` (modify) | add `assessment_problems()`, `read_json()` |
| `backend/ml/features.py` (new) | shared constants: `FEATURES`, `GENDER_CODES`, `VALID_RANGES`, `FEATURE_LABELS`, `risk_category` |
| `backend/ml/train_model.py` (modify) | import constants from `features.py` instead of defining them |
| `backend/app/services/ml_service.py` (new) | load model once, `predict_probability()` |
| `backend/app/services/shap_service.py` (new) | `explain()` in probability mode |
| `backend/app/services/llm_service.py` (new) | `chat()`, `risk_narrative()`, `is_safe()`, fallback text |
| `backend/app/routes/auth.py` (new) | UC-100 |
| `backend/app/routes/predict.py` (new) | UC-200/300/400 |
| `backend/app/routes/simulation.py` (new) | UC-500 |
| `backend/app/routes/history.py` (new) | UC-600 |
| `backend/app/routes/admin.py` (new) | UC-800, UC-900 |
| `backend/app/routes/action_plan.py` (new) | UC-1000 |
| `backend/app/routes/navigator.py` (new) | UC-700 |
| `backend/tests/test_*.py` (new) | one test file per route file plus `test_services.py` |

---

### Task 1 (Part 4.0): Test setup, token login helper, activity log helper

**Files:**
- Create: `backend/requirements-dev.txt`, `backend/tests/conftest.py`, `backend/app/auth.py`, `backend/tests/test_auth_helpers.py`
- Modify: `backend/app/__init__.py`, `backend/config.py`, `backend/app/models.py`, `backend/app/validation.py`, `CHANGES.md`

**Interfaces:**
- Produces:
  - `app.auth.make_token(user: User) -> str` — signed `{"user_id": ...}` with `URLSafeTimedSerializer(SECRET_KEY, salt="auth-token")`.
  - `app.auth.login_required(role: str | None = None)` — decorator; reads `Authorization: Bearer <token>`, loads the user into `flask.g.user`. 401 `{"error": "Please log in again."}` if token missing/invalid/expired or user inactive; 403 `{"error": "You do not have permission to access this page."}` if role differs.
  - `app.models.log_event(action: str, description: str | None = None, user_id: int | None = None) -> None` — adds a `SystemLog` row to the session (caller commits).
  - `app.validation.read_json() -> dict | None` — `request.get_json(silent=True)` returning only dicts, else None.
  - Config: `TOKEN_MAX_AGE_SECONDS = 8 * 3600`; `FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")`, CORS limited to it for `/api/*`.
  - JSON error handlers in `create_app`: 404 `{"error": "Not found."}`, 405 `{"error": "Method not allowed."}`, 500 `{"error": "Something went wrong. Please try again later."}`.
  - Fixtures in `tests/conftest.py`: `app` (session; `TESTING=True`, `SQLALCHEMY_DATABASE_URI` = `DATABASE_URL` with database name `cardioxplain_test_db`; creates the database if missing, `create_all` at start, `drop_all` at end), `client`, `clean_db` (autouse; deletes all rows between tests, children first), `make_user(email, password="Passw0rd!", role="general_user", status="active") -> User`, `user_headers`, `admin_headers` (dict with Bearer token), `fake_llm` (monkeypatches `app.services.llm_service.chat`; has `.reply` text (default `"Your risk is moderate. Please consult a healthcare professional."`), `.fail` flag (raise `LLMUnavailable`), `.calls` list of `{"system": str, "messages": list}`).

- [ ] **Step 1: Install pytest, pin it in `requirements-dev.txt`**

Run: `venv\Scripts\python -m pip install pytest` then write the installed version, e.g. `pytest==<version>`.
Expected: `venv\Scripts\python -m pytest --version` prints the version.

- [ ] **Step 2: Write failing tests in `tests/test_auth_helpers.py`**

```python
def test_valid_token_reaches_protected_route(client, user_headers): ...      # GET /api/_test/user -> 200, json["user_id"] matches
def test_missing_token_is_401(client): ...                                    # error == "Please log in again."
def test_tampered_token_is_rejected(client, user_headers): ...                # change last char -> 401
def test_expired_token_is_rejected(app, client, make_user, monkeypatch): ...  # TOKEN_MAX_AGE_SECONDS = -1 -> 401
def test_wrong_role_is_403(client, user_headers): ...                         # admin-only test route -> 403
def test_log_event_writes_row(app): ...                                       # log_event("TEST", "x"); commit -> 1 row, action "TEST", user_id None
def test_unknown_url_returns_json_404(client): ...                            # GET /api/nope -> 404, json["error"] == "Not found."
```

The test file registers two tiny routes on a separate blueprint inside a fixture (`/api/_test/user` with `login_required()`, `/api/_test/admin` with `login_required("admin")`) so the helper is tested before real routes exist.

- [ ] **Step 3: Run, expect FAIL** — `venv\Scripts\python -m pytest tests/test_auth_helpers.py -v` → ImportError for `app.auth`.
- [ ] **Step 4: Implement `app/auth.py`, `log_event`, `read_json`, config values, error handlers, CORS origin.**
- [ ] **Step 5: Run, expect PASS** — same command, 7 passed.
- [ ] **Step 6: Add CHANGES.md #15** (token login with itsdangerous, 8-hour expiry, instead of a new library) **and #16** (CORS restricted to the frontend address). Add `FRONTEND_ORIGIN` to `.env.example`.
- [ ] **Step 7: Commit** — `git commit -m "Add test setup, token login helper and activity logging"`

---

### Task 2 (Part 4.1): UC-100 Register & Login

**Files:**
- Create: `backend/app/routes/auth.py`, `backend/tests/test_auth.py`
- Modify: `backend/app/__init__.py` (register `auth_bp` at `/api/auth`), `CHANGES.md`

**Interfaces:**
- Consumes: `make_token`, `login_required`, `log_event`, `read_json`, `password_problem`.
- Produces:
  - `POST /api/auth/register` body `{full_name, email, password}` → 201 `{"message": "Registration successful. Please log in."}`. Always creates `role="general_user"` (admins cannot self-register, CHANGES.md #10). Email stored `strip().lower()`. Errors: 400 with `fields` for empty name/email, invalid email format (`"Please enter a valid email address."`), password rule; 409 `{"error": "This email is already registered."}`. Logs `REGISTER`.
  - `POST /api/auth/login` body `{email, password}` → 200 `{"token": str, "user": {"user_id", "full_name", "email", "role"}}`. Wrong email or password → 401 `"Invalid email or password"` (same message for both, logs `LOGIN_FAILED` without user_id). Inactive account → 403 `{"error": "This account has been deactivated."}`. Success logs `LOGIN`.
  - `GET /api/auth/me` (login required) → 200 `{"user": {...same fields}}`.
  - `user_to_dict(user: User) -> dict` in `routes/auth.py`, reused by admin routes.

- [ ] **Step 1: Write failing tests in `tests/test_auth.py`**

```python
def test_register_creates_general_user(client): ...          # 201; DB row role == "general_user", password_hash startswith "scrypt"
def test_register_ignores_role_field(client): ...            # body includes "role": "admin" -> stored role still "general_user"
def test_register_rejects_weak_password(client): ...         # 400; fields["password"] == the exact UC-100 rule message
def test_register_rejects_invalid_email(client): ...         # "abc" -> 400, fields["email"]
def test_register_rejects_missing_body(client): ...          # no JSON -> 400, not 500
def test_register_duplicate_email_is_409(client): ...
def test_register_email_is_case_insensitive(client): ...     # " Ali@Mail.com " then "ali@mail.com" -> second is 409
def test_login_success_returns_token_and_user(client): ...   # 200; token works on /api/auth/me
def test_login_wrong_password_message(client): ...           # 401; error == "Invalid email or password"
def test_login_unknown_email_same_message(client): ...       # 401; same message
def test_login_email_is_case_insensitive(client): ...
def test_login_inactive_account_is_403(client, make_user): ...
def test_login_writes_logs(client): ...                      # one LOGIN_FAILED (user_id None) and one LOGIN row
```

- [ ] **Step 2: Run, expect FAIL** (404 on routes).
- [ ] **Step 3: Implement `routes/auth.py`** — email check is a simple regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`; `check_password_hash` from werkzeug.
- [ ] **Step 4: Run, expect PASS** — `venv\Scripts\python -m pytest -v` (all tests so far).
- [ ] **Step 5: CHANGES.md #17** — Forgot Password (UC-100 A1) postponed: no email service in scope; an admin can set a new temporary password instead (Task 7). Add to Report fixes.
- [ ] **Step 6: Commit** — `git commit -m "Add register, login and current user endpoints (UC-100)"`

---

### Task 3 (Part 4.2): UC-200/300/400 Risk Assessment with SHAP and LLM narrative

**Files:**
- Create: `backend/ml/features.py`, `backend/app/services/__init__.py`, `backend/app/services/ml_service.py`, `backend/app/services/shap_service.py`, `backend/app/services/llm_service.py`, `backend/app/routes/predict.py`, `backend/tests/test_services.py`, `backend/tests/test_predict.py`
- Modify: `backend/ml/train_model.py` (import constants from `features`), `backend/app/validation.py`, `backend/app/__init__.py`, `CHANGES.md`

**Interfaces:**
- Produces:
  - `ml/features.py`: `FEATURES`, `TARGET`, `GENDER_CODES`, `VALID_RANGES` (moved unchanged from `train_model.py`), `risk_category(score)` (moved), and `FEATURE_LABELS = {"age": "Age", "gender": "Gender", "height": "Height", "weight": "Weight", "bmi": "Body mass index (BMI)", "ap_hi": "Systolic blood pressure", "ap_lo": "Diastolic blood pressure", "cholesterol": "Cholesterol level", "gluc": "Glucose level", "smoke": "Smoking", "alco": "Alcohol intake", "active": "Physical activity"}`. Backend imports it as `from ml.features import ...`; `train_model.py` (run as a script) as `from features import ...`.
  - `app.validation.assessment_problems(data: dict) -> tuple[dict, dict]` → `(clean_values, field_errors)`. Accepts numbers or numeric strings, booleans or 0/1 for smoke/alco/active; computes `bmi = round(weight / (height/100)**2, 2)`. Messages, e.g. `"Age must be between 30 and 65 years."`, `"Systolic blood pressure must be between 60 and 300 mmHg."`, `"Diastolic blood pressure cannot be higher than systolic blood pressure."`, `"Please choose Male or Female."`, `"This field is required."`.
  - `app.services.ml_service.predict_probability(values: dict) -> float` — loads `ml/output/model.json` once (`functools.cache`), builds a one-row DataFrame in `FEATURES` order with gender mapped through `GENDER_CODES`.
  - `app.services.shap_service.explain(values: dict) -> list[dict]` — probability-mode `TreeExplainer` built once from `model.json` + `shap_background.csv`; returns all 12 features as `{"feature", "label", "value", "shap"}` sorted by `abs(shap)` descending, `shap` rounded to 4 dp.
  - `app.services.llm_service.LLMUnavailable(Exception)`.
  - `app.services.llm_service.chat(system: str, messages: list[dict]) -> str` — `OpenAI(api_key, base_url, timeout=10)` `chat.completions.create(model=LLM_MODEL, ...)`; raises `LLMUnavailable` on any client error or empty reply. Logs `LLM_CALL` with description starting `success:` or `failed:`.
  - `app.services.llm_service.SAFETY_RULES: str` — the safety instruction (Global Constraints).
  - `app.services.llm_service.is_safe(text: str) -> bool` — False if text contains (case-insensitive) "you have been diagnosed", "you have heart disease", "prescribe", "dosage", or a dose pattern `\d+\s?mg` (3.2.8.2 step 4).
  - `app.services.llm_service.risk_narrative(risk_score: float, category: str, top: list[dict]) -> tuple[str, str]` → `(text, source)`, `source` is `"llm"` or `"fallback"`. Prompt contains category, percentage and the top 3 factors with direction (3.2.8.1). Fallback (3.2.8.2 step 6): `f"Your predicted cardiovascular risk is {category} ({percent}%). The factor that most affected this result is {top[0]['label']}, which {'increased' if shap > 0 else 'lowered'} your risk. This result is for educational purposes only and does not replace professional medical advice. Please consult a healthcare professional."`
  - `POST /api/predict` (`general_user`) body = 11 inputs (no bmi) → 201:
    ```json
    {"prediction_id": 1, "risk_score": 0.4123, "risk_percent": 41, "risk_category": "Moderate",
     "inputs": {...12 values incl. bmi},
     "shap": [{"feature": "ap_hi", "label": "Systolic blood pressure", "value": 140, "shap": 0.1523}, ...],
     "narrative": {"text": "...", "source": "llm"},
     "disclaimer": "..."}
    ```
    Saves `Prediction`, `PredictionInput`, `ShapExplanation` (top 3 + `all_shap_values`), `LlmNarrative` (both llm and fallback text are saved, it is what the user saw). Logs `PREDICT`. Invalid input → 400 `{"error": "Please correct the highlighted fields.", "fields": {...}}` (UC-200 E1). If `explain` raises: still 201 with `"shap": null`, `"shap_error": "The explanation could not be generated. Please try the assessment again."` and narrative from fallback without SHAP factors (UC-300 E1); no `shap_explanations` row.

- [ ] **Step 1: Move constants into `ml/features.py`, import them in `train_model.py`.** Verify nothing changed: `venv\Scripts\python -c "import sys; sys.path.insert(0,'ml'); import train_model"` succeeds, and `venv\Scripts\python -c "from ml.features import FEATURES; print(len(FEATURES))"` prints `12`.
- [ ] **Step 2: Write failing tests in `tests/test_services.py`**

```python
def test_assessment_problems_accepts_valid_input(): ...        # bmi computed: 170 cm, 70 kg -> 24.22
def test_assessment_problems_range_messages(): ...             # age 25 -> "Age must be between 30 and 65 years."
def test_assessment_problems_ap_lo_above_ap_hi(): ...
def test_assessment_problems_wrong_types(): ...                # "abc", "yes", None -> field errors, no exception
def test_predict_probability_between_0_and_1(): ...
def test_shap_values_add_up_to_probability(): ...              # background mean + sum(shap) ~= probability (abs diff < 1e-4)
def test_shap_returns_all_12_features_sorted(): ...
def test_is_safe_blocks_diagnosis_and_dose(): ...              # "Take 50 mg aspirin" -> False; normal advice -> True
def test_risk_narrative_fallback_when_llm_fails(fake_llm): ... # fake_llm.fail = True -> source "fallback", text contains top label
def test_risk_narrative_prompt_has_safety_rules(fake_llm): ... # SAFETY_RULES in fake_llm.calls[0]["system"]
```

- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement `validation.assessment_problems`, `ml_service`, `shap_service`, `llm_service`.**
- [ ] **Step 5: Run `tests/test_services.py`, expect PASS.**
- [ ] **Step 6: Write failing tests in `tests/test_predict.py`**

```python
VALID = {"age": 50, "gender": "male", "height": 170, "weight": 80, "ap_hi": 140, "ap_lo": 90,
         "cholesterol": 2, "gluc": 1, "smoke": 0, "alco": 0, "active": 1}

def test_predict_returns_full_result(client, user_headers, fake_llm): ...   # 201, keys present, category matches score thresholds, 12 shap items
def test_predict_saves_all_records(client, user_headers, fake_llm): ...     # 1 row each in predictions, prediction_inputs, shap_explanations, llm_narratives
def test_predict_rejects_out_of_range(client, user_headers): ...            # ap_hi 350 -> 400, fields["ap_hi"]
def test_predict_rejects_wrong_types_and_missing_body(client, user_headers): ...
def test_predict_requires_login(client): ...                                # 401
def test_predict_admin_is_forbidden(client, admin_headers): ...             # 403
def test_predict_uses_fallback_when_llm_fails(client, user_headers, fake_llm): ...       # fail -> 201, source "fallback"
def test_predict_uses_fallback_when_llm_text_unsafe(client, user_headers, fake_llm): ... # reply "Take 20 mg statin" -> source "fallback"
def test_predict_shap_failure_still_returns_score(client, user_headers, fake_llm, monkeypatch): ...  # explain raises -> 201, shap None, no shap row
def test_predict_is_fast(client, user_headers, fake_llm): ...               # NFR01: response under 5 s (LLM faked)
```

- [ ] **Step 7: Run, expect FAIL. Step 8: Implement `routes/predict.py`, register at `/api/predict`. Step 9: Run full suite, expect PASS.**
- [ ] **Step 10: CHANGES.md #18** — when the LLM is unavailable or unsafe, the template narrative from 3.2.8.2 is shown and saved (UC-400 E1 said show "Explanation is currently unavailable"; the fallback gives the user a result instead of an error). Report fix for UC-400 E1.
- [ ] **Step 11: Live check (uses a few credits):** one real `POST /api/predict` against the asai server from a short script, print narrative and the time taken (NFR02, expect under 10 s). Save the timing for Ch4.
- [ ] **Step 12: Commit** — `git commit -m "Add risk assessment endpoint with SHAP and LLM narrative (UC-200/300/400)"`

---

### Task 4 (Part 4.3): UC-500 What-If Simulator

**Files:**
- Create: `backend/app/routes/simulation.py`, `backend/tests/test_simulation.py`
- Modify: `backend/app/__init__.py`, `backend/app/services/llm_service.py`

**Interfaces:**
- Consumes: `assessment_problems`, `predict_probability`, `explain`, `chat`, `is_safe`, `risk_category`.
- Produces:
  - `GET /api/simulation` → 200 `{"inputs": {...}}` from the user's most recent prediction (form pre-fill, UC-500 step 2) or 404 `"Please complete a Risk Assessment first."`.
  - `POST /api/simulation` body: any of `smoke`, `alco`, `active`, `weight` (BMI changes through weight; height and clinical values stay fixed, UC-500 rule). Any other field → 400 `{"error": "Only physical activity, smoking, alcohol and weight can be changed in the simulator."}`. No previous assessment → 404 with the UC-500 E1 message. 200:
    ```json
    {"original": {"risk_score", "risk_percent", "risk_category"},
     "simulated": {"risk_score", "risk_percent", "risk_category", "inputs": {...}, "shap": [...]},
     "change_percent_points": -4.6,
     "narrative": {"text", "source"}, "disclaimer": "..."}
    ```
    Nothing is saved except a `SIMULATE` log (UC-500 post-condition).
  - `llm_service.simulation_narrative(original: dict, simulated: dict, changes: dict) -> tuple[str, str]` with fallback `"Your simulated risk is {category} ({percent}%), compared with {orig_category} ({orig_percent}%) before the change. ..." + disclaimer`.

- [ ] **Step 1: Failing tests**

```python
def test_simulation_prefill_returns_latest_inputs(...): ...
def test_simulation_without_assessment_is_404(...): ...        # exact UC-500 E1 message, for GET and POST
def test_simulation_becoming_active_lowers_or_keeps_risk(...): ... # active 0 -> 1: change_percent_points <= 0 (monotonic model)
def test_simulation_stop_smoking_never_raises_risk(...): ...
def test_simulation_rejects_clinical_fields(...): ...          # {"ap_hi": 120} -> 400
def test_simulation_validates_weight_range(...): ...           # weight 10 -> 400 fields["weight"]
def test_simulation_saves_nothing_new(...): ...                # predictions count unchanged
```

- [ ] **Step 2: Run, FAIL. Step 3: Implement. Step 4: Run full suite, PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add What-If simulator endpoint (UC-500)"`

---

### Task 5 (Part 4.4): UC-600 Prediction History

**Files:**
- Create: `backend/app/routes/history.py`, `backend/tests/test_history.py`
- Modify: `backend/app/__init__.py`

**Interfaces:**
- Produces:
  - `prediction_to_dict(p: Prediction) -> dict` in `routes/history.py` — same shape as the `POST /api/predict` response (inputs, shap rebuilt from `all_shap_values`, narrative) plus `prediction_date` ISO string. Reused by Task 8.
  - `GET /api/history` → 200 `{"predictions": [{"prediction_id", "prediction_date", "risk_score", "risk_percent", "risk_category"}]}` newest first; empty → 200 `{"predictions": [], "message": "No prediction history found. Please complete a Risk Assessment."}`.
  - `GET /api/history/<int:id>` → 200 `prediction_to_dict(...)`; not found or not owned → 404 `{"error": "Prediction not found."}`.
  - Read-only: no PUT/DELETE (405 from the JSON handler).

- [ ] **Step 1: Failing tests**

```python
def test_history_empty_message(...): ...
def test_history_lists_newest_first(...): ...
def test_history_detail_returns_full_result(...): ...      # shap has 12 items from all_shap_values
def test_history_detail_other_users_record_is_404(...): ...
def test_history_cannot_delete(...): ...                   # DELETE -> 405
```

- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `git commit -m "Add prediction history endpoints (UC-600)"`

---

### Task 6 (Part 4.5): UC-900 Admin Model Monitoring

**Files:**
- Create: `backend/app/routes/admin.py`, `backend/tests/test_admin_monitor.py`
- Modify: `backend/app/__init__.py` (register `admin_bp` at `/api/admin`)

**Interfaces:**
- Produces (all `login_required("admin")`):
  - `GET /api/admin/metrics` → 200 `{"metrics": <ml/output/metrics.json>, "training": <training_summary.json>}`. Read-only, from the test set (UC-900 step 3), so the "insufficient data" flow is not needed (CHANGES.md suggestion D, record as #19).
  - `GET /api/admin/stats` → 200 `{"total_users", "total_assessments", "risk_distribution": {"Low", "Moderate", "High"}, "llm_calls": {"success", "failed"}}` — counts only, no personal data.
  - `GET /api/admin/logs?limit=50` → 200 `{"logs": [{"log_id", "user_id", "action", "description", "timestamp"}]}` newest first, `limit` capped at 200.

- [ ] **Step 1: Failing tests**

```python
def test_metrics_returns_test_set_results(...): ...        # metrics["auc"] == value in metrics.json
def test_stats_counts_and_distribution(...): ...           # after 2 predictions via fake LLM
def test_stats_has_no_personal_fields(...): ...            # response text contains no user email / input values
def test_logs_newest_first_and_limit(...): ...
def test_admin_endpoints_forbid_general_user(...): ...     # 403 for each
```

- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: CHANGES.md #19, commit** — `git commit -m "Add admin model monitoring endpoints (UC-900)"`

---

### Task 7 (Part 4.6): UC-800 Admin User Management

**Files:**
- Modify: `backend/app/routes/admin.py`, `CHANGES.md`
- Create: `backend/tests/test_admin_users.py`

**Interfaces:**
- Consumes: `user_to_dict` (Task 2), `password_problem`, `log_event`.
- Produces (`admin` only):
  - `GET /api/admin/users` → `{"users": [user_to_dict + "status", "created_at"]}`.
  - `GET /api/admin/users/<id>` → user fields + `"assessment_count"` only (no health data, UC-800 constraint).
  - `POST /api/admin/users` body `{full_name, email, role, password}` → 201. The admin sets a temporary password (replaces the registration email, CHANGES.md #17). Same validation as register. Logs `CREATE_USER`.
  - `PATCH /api/admin/users/<id>` body any of `{role, status, password}` → 200 updated user. Rules: own account `status: inactive` → 400 `"You cannot deactivate your own administrator account."`; any change leaving zero active admins → 400 `{"error": "At least one active administrator account must exist."}`. Logs `DEACTIVATE_USER` / `ACTIVATE_USER` / `CHANGE_ROLE` / `RESET_PASSWORD`.

- [ ] **Step 1: Failing tests**

```python
def test_list_users(...): ...
def test_user_detail_has_no_health_data(...): ...           # keys exclude inputs/shap/narrative
def test_create_user_with_temporary_password(...): ...      # new user can log in
def test_cannot_deactivate_own_account(...): ...            # exact UC-800 E1 message
def test_cannot_remove_last_active_admin(...): ...          # demote the only admin -> 400
def test_deactivated_user_token_stops_working(...): ...     # user token valid, admin deactivates, next request 401
def test_reset_password_follows_rule(...): ...              # weak password -> 400
```

- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `git commit -m "Add admin user management endpoints (UC-800)"`

---

### Task 8 (Part 4.7): UC-1000 Personalised Health Action Plan

**Files:**
- Create: `backend/app/routes/action_plan.py`, `backend/tests/test_action_plan.py`
- Modify: `backend/app/__init__.py`, `backend/app/services/llm_service.py`

**Interfaces:**
- Produces:
  - `llm_service.health_plan(category: str, risk_score: float, top: list[dict], lifestyle: dict) -> str` — prompt asks for a 4-week plan in Markdown with sections Physical activity, Diet, Lifestyle changes, Monitoring reminders (UC-1000 step 5) + `SAFETY_RULES`; raises `LLMUnavailable` if the call fails or `is_safe` is False. No fallback (UC-1000 E1 shows a message).
  - `GET /api/action-plan` → 200 `{"plan": {"plan_text", "generated_at", "prediction_id"}}` for the latest prediction, or 404 `{"error": "No health action plan yet."}`; no assessment → 404 UC-500 E1 message.
  - `POST /api/action-plan` body optional `{"lifestyle": {smoke, alco, active, weight}}` (A1: values from the What-If simulator) → 201 `{"plan": {...}, "disclaimer"}`. Saves into `health_plans` for the latest prediction; if a plan already exists for that prediction it is **replaced** (UNIQUE `prediction_id`, ERD "at most one"). LLM failure → 503 with the exact UC-1000 E1 message plus `"risk_score"` and `"risk_category"` (E1 step 2). Logs `HEALTH_PLAN`.

- [ ] **Step 1: Failing tests**

```python
def test_plan_requires_assessment(...): ...
def test_plan_generated_and_saved(...): ...
def test_plan_regenerate_replaces_old_plan(...): ...      # still 1 row, new text
def test_plan_uses_simulated_lifestyle(...): ...          # "active" value in fake_llm.calls prompt reflects lifestyle override
def test_plan_llm_failure_message(...): ...               # 503, exact message, risk_category present
def test_plan_unsafe_text_not_saved(...): ...             # reply with "50 mg" -> 503, no row
```

- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `git commit -m "Add personalised health action plan endpoints (UC-1000)"`

---

### Task 9 (Part 4.8): UC-700 Virtual Care Navigator

**Files:**
- Create: `backend/app/routes/navigator.py`, `backend/tests/test_navigator.py`
- Modify: `backend/app/__init__.py`

**Interfaces:**
- Produces:
  - `POST /api/navigator` (`general_user`) body `{"message": str, "history": [{"role": "user"|"assistant", "content": str}]}` → 200 `{"reply": str, "disclaimer"}`. `message` required, max 1000 characters (`400 {"error": "Please keep your question under 1000 characters."}`); only the last 10 history items are sent; any other role values are dropped. Context added to the system prompt: the user's latest risk category and top 3 factors if they exist. Nothing stored (UC-700 post-condition), logs `NAVIGATOR` without message text. LLM failure or unsafe reply → 503 exact UC-700 E1 message.

- [ ] **Step 1: Failing tests**

```python
def test_navigator_replies(...): ...
def test_navigator_includes_safety_rules_and_context(...): ...  # SAFETY_RULES and latest category in system prompt
def test_navigator_message_required_and_length(...): ...
def test_navigator_history_trimmed_and_roles_filtered(...): ... # 15 items + a "system" role -> 10 sent, no "system"
def test_navigator_llm_failure_message(...): ...
def test_navigator_does_not_store_messages(...): ...            # log description does not contain the message text
```

- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Full suite + coverage list for Ch4:** run `venv\Scripts\python -m pytest -v`, save the output to `backend/tests/results.txt` (unit + integration evidence).
- [ ] **Step 6: Commit and push** — `git commit -m "Add virtual care navigator endpoint (UC-700)"`

---

## After Phase 4

Phase 5 (React) consumes exactly the endpoints above.
