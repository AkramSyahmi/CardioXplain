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
