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

## Report fixes to do

Changes needed in the report only (no code change).

- [ ] Use case diagram (Figure 3.10): add "View Personalised Health Action Plan" (UC-1000), which is missing.
- [ ] Use case diagram (Figure 3.10): remove the Administrator actor (evaluator feedback); describe admin functions separately.
- [ ] ERD explanation (Table 3.27): describe `shap_explanations`, `llm_narratives` and `health_plans` as "at most one" per prediction (none if SHAP/LLM fails or the plan has not been generated), matching the exception flows.
- [ ] Data dictionary (Table 3.31): add the `all_shap_values` column.
- [ ] Data dictionary (Table 3.28): password hashing uses scrypt.
