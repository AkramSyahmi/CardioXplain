# Changes from PSM1 Proposal

Log of differences between the FYP1 proposal (PSM1) and the FYP2 implementation.
Used to update Chapter 3 and explain changes in Chapter 4.

| # | Date | Change | Reason | Proposal section affected |
|---|------|--------|--------|---------------------------|
| 1 | 2026-11-11 | Controllers merged into route files; services kept separate (ML, SHAP, LLM). | Removes duplicate files for the same job; simpler to maintain. | 3.8.2, Figure 3.23 |
| 2 | 2026-11-11 | All 7 database tables defined in one `models.py`. | Small schema; one file is easier to follow. | 3.8.2, Figure 3.23 |
| 3 | 2026-11-11 | React frontend built with Vite instead of Create React App. | Create React App is deprecated; Vite is the current standard and still React. | 3.8.3, Figure 3.24 |
| 4 | 2026-11-11 | No `utils` folder; BMI calculation placed where it is used. | BMI is a one-line formula; a separate folder is unnecessary. | 3.8.2, Figure 3.23 |
| 5 | 2026-11-11 | `requirements.txt` lists only direct dependencies. | Easier to read and install; sub-dependencies install automatically. | 3.8.1 |
| 6 | 2026-11-11 | LLM provider set through `.env` (`LLM_BASE_URL`, `LLM_MODEL`). Using the asai server (OpenAI-compatible) with `claude-haiku-5.5`, called through the `openai` Python library. | The proposal did not name a provider. Settings in `.env` let the provider change without code changes. Claude Haiku is fast, low cost, and follows safety instructions well (NFR09). | 1.4.3, 3.2.8.2, CL03 |
| 7 | 2026-11-11 | `all_shap_values` (JSON) column added to `shap_explanations`. The original `feature_1..3` and `shap_value_1..3` columns are kept. | History can redraw the full SHAP chart (all features), matching the result page in Figure 3.29. | Table 3.31 |
| 8 | 2026-11-11 | Database `CHECK` rules added for the input ranges in Table 3.30 and for `risk_score` (0 to 1). | Second layer of protection after backend validation, so invalid values cannot be stored even if data is written another way. | Tables 3.29, 3.30 |
| 9 | 2026-11-11 | Passwords hashed with scrypt (`werkzeug.security`, included with Flask) instead of bcrypt. | Strong, well-tested algorithm with no extra library. The proposal allows "bcrypt or a similar hashing algorithm". | Table 3.28 |
| 10 | 2026-11-11 | The first administrator account is created with the `flask --app run create-admin` command. Admin is removed from the use case diagram (evaluator feedback), but admin features UC-800 and UC-900 are kept. | Admins cannot self-register (UC-100 constraint), so the first admin needs a separate creation method. | 3.5.2, UC-100 |
| 11 | 2026-11-11 | Input ranges changed: age 30-65 years (was 1-120) and height 120-250 cm (was 50-250). Same ranges used for data cleaning and form validation. | The dataset only covers ages 30-65, so predictions outside that range would be unreliable. Heights under 120 cm (52 rows) are almost always typing errors. | Table 3.30, UC-200 rules |
| 12 | 2026-11-11 | Number of trees (`n_estimators`) chosen by 5-fold cross-validation instead of early stopping. Randomized search (40 combinations) used instead of full grid search. | Cross-validation does the same job as early stopping (prevents overfitting) but is tested 5 times instead of once. Random search finds equally good settings in minutes instead of hours. | 3.2.6.2 step 4, 3.2.6.3 |
| 13 | 2026-11-11 | SHAP TreeExplainer runs in probability mode (`model_output="probability"`) with 100 background rows. | Default SHAP gives log-odds values, which users cannot understand. Probability mode makes each value a change in risk (e.g. +4.4%) and makes "baseline + SHAP = predicted probability" true. | 3.2.7.1 step 5, 3.2.7.2 |
| 14 | 2026-11-11 | XGBoost trained with monotonic constraints: age, ap_hi, ap_lo, cholesterol, gluc, smoke, alco and bmi can only raise risk; active can only lower risk. | Without constraints the model learned from this dataset that smoking, alcohol and high glucose lower risk (stopping smoking raised risk by 2.83%). AUC cost only 0.003 (0.8048 to 0.8015). | 3.2.6.1, 3.2.6.2 |
| 15 | 2026-11-12 | Login uses signed tokens from `itsdangerous` (included with Flask), sent as `Authorization: Bearer <token>`, valid for 8 hours. The user is re-checked on every request. | Meets NFR04 (token-based authentication) without adding a new library. A deactivated account stops working immediately. | NFR04, UC-100 |
| 16 | 2026-11-12 | CORS limited to the frontend address (`FRONTEND_ORIGIN`, default `http://localhost:5173`) instead of allowing any website. | Other websites cannot call the API from a user's browser. | NFR04 |
| 17 | 2026-11-12 | Forgot Password (UC-100 alternative flow A1) postponed. If a user forgets their password, an administrator sets a temporary password through User Management. | Sending reset links needs an email service, which is outside the project scope (1.4.3). | UC-100 A1, UC-800 |
| 18 | 2026-11-12 | When the LLM is unavailable, too slow or returns unsafe text, the pre-written template narrative (section 3.2.8.2 step 6) is shown and saved, instead of UC-400 E1's "Explanation is currently unavailable" message. | The proposal contradicts itself (3.2.8.2 vs UC-400 E1). The fallback still gives the user an explanation of their result. | 3.2.8.2, UC-400 E1 |
| 19 | 2026-11-12 | LLM calls have a hard 10-second total deadline, no automatic retries, and a 400-token reply limit. | Measured with the real asai server: replies took 4-20 s, and the client's timeout only limits the gap between data, not the total. Without this, users could wait up to ~30 s (NFR02). | NFR02, 3.2.8.2 |
| 20 | 2026-11-12 | Admin model metrics are read from `ml/output/metrics.json` (results on the unseen test set). UC-900 alternative flow A1 "Insufficient data" is not needed. | The metrics come from the test set (UC-900 step 3), not from users' predictions, so they are always available. | UC-900 A1, FR09 |
| 21 | 2026-11-12 | Security hardening after the Phase 4 code review: a password reset ends the user's existing logins; requests larger than 64 KB are refused; login takes the same time for unknown emails; double submits and simultaneous inserts no longer cause errors. | Found by an independent code review; each fix has its own test (`tests/test_hardening.py`). | NFR04, UC-100, UC-800, UC-1000 |
| 22 | 2026-11-12 | Frontend built in two stages: first every screen as plain unstyled HTML that works with the real API, then styling to match the FYP1 mockups. During development the Vite server forwards `/api` calls to Flask (port 5000). | Student's decision: confirm every feature works before spending time on looks. The proxy avoids cross-origin problems during development. | 3.8.3, Figures 3.25-3.35 |

## Report fixes to do

Changes needed in the report only (no code change).

- [ ] Use case diagram (Figure 3.10): add "View Personalised Health Action Plan" (UC-1000), which is missing.
- [ ] Use case diagram (Figure 3.10): remove the Administrator actor (evaluator feedback); describe admin functions separately.
- [ ] ERD explanation (Table 3.27): describe `shap_explanations`, `llm_narratives` and `health_plans` as "at most one" per prediction (none if SHAP/LLM fails or the plan has not been generated), matching the exception flows.
- [ ] Data dictionary (Table 3.31): add the `all_shap_values` column.
- [ ] Data dictionary (Table 3.28): password hashing uses scrypt.
- [ ] Table 3.30 and UC-200 rules: age range 30-65, height range 120-250 cm.
- [ ] Section 3.2.6.2 step 4: replace early stopping with cross-validated `n_estimators` (randomized search, 40 x 5-fold).
- [ ] Section 3.2.7.1 step 5: state that SHAP runs in probability mode, so baseline + SHAP = predicted probability.
- [ ] Section 3.2.6: describe the monotonic constraints and why they were needed (before/after results in `ml/output/unconstrained/`).
- [ ] Ch4 limitation: model predicts CVD presence (not 10-year risk); smoking effect is small because the dataset's smoking data is self-reported and rare.
- [ ] UC-100 (Table 3.17): remove or mark alternative flow A1 Forgot Password as future work; mention admin password reset in UC-800.
- [ ] UC-400 E1 (Table 3.20): describe the fallback narrative instead of the 'Explanation is currently unavailable' message.
- [ ] Ch4 NFR results: prediction + SHAP 0.02 s (NFR01 met); LLM narrative 4-8 s normally, fallback after 10 s (NFR02 met by the deadline). In 6 live calls on 2026-11-12, 2 hit the deadline (asai server slow).
- [ ] UC-900 (Table 3.25): remove alternative flow A1 Insufficient data; metrics come from the test set.

## Weaknesses to address

Found in the project review (2026-11-12). Owner = who does it.

- [ ] **Novelty question** (owner: student, Claude helps practise) — prepare a clear answer: medically consistent model (monotonic constraints) + SHAP in probability terms + LLM narratives + What-If, in one public tool. Before EV1 / viva.
- [ ] **Weak FYP1 survey results** (owner: student runs, Claude prepares and analyses) — only 36 respondents; "explanation of factors" rated 2.72/5. Use UAT and usability results in Ch4 to show users find the features useful after using them. Phase 6 / Ch4.
- [x] **Users may not know their health numbers** (owner: Claude, done 2026-11-12 in the assessment form) — add help text to the risk assessment form (e.g. "If unsure, choose Normal and check at a clinic"). Phase 5.
- [ ] **What the model really predicts** (owner: Claude drafts, student checks) — state clearly in Ch4: CVD presence (not 10-year risk), ages 30-65, self-reported lifestyle data, no clinical validation. Report writing.
- [ ] **Third-party LLM server** (owner: student decides) — measured 2026-11-12: 2 of 6 calls took over 10 s and used the fallback. asai is a reseller; users' health inputs pass through it. State as a limitation, or switch to an official API (Anthropic / OpenAI) before UAT by changing `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` in `.env`. Before UAT.
- [ ] **Report inconsistencies** (owner: Claude drafts, student updates Word report) — objectives differ between abstract and Ch1; testing types differ between Ch1/3.12 and 3.9; duplicate UAT test case IDs (TC-01 x4, etc.); use case diagram fixes listed above. Report update.
