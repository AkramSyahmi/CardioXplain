# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Malaysian adults with no medical training, mostly aged 35-54 (FYP1 survey, 36 respondents), checking their cardiovascular risk at home on a laptop or phone. Many feel anxious about what the result might say, and most do not know their exact blood pressure, cholesterol or glucose values.

Secondary user: an administrator who monitors model performance, usage and user accounts.

## Product Purpose

CardioXplain lets a member of the public estimate their cardiovascular disease risk, understand why the model gave that result, and see what they can change. Success is a user who leaves knowing their main risk factors and with a concrete next step, without mistaking the result for a diagnosis.

## Positioning

Not just a number. Unlike Framingham, QRISK3 or the AHA PREVENT calculator, every result explains why (SHAP factor contributions in probability terms), says it in plain language (LLM narrative), and shows what could change (What-If simulator, day-by-day health action plan). The model is constrained so every factor pushes risk in the medically correct direction.

## Operating Context

- Final-year Software Engineering project (UMPSA), evaluated by a supervisor (EV1) and through user acceptance testing and a usability questionnaire.
- Flow: register or sign in, enter 11 health and lifestyle inputs (with "I don't know" for blood pressure, cholesterol and glucose), read the result, explore What-If changes, follow a 7-day or 30-day calendar plan, ask the Virtual Care Navigator, review history.
- Admin flow: model performance metrics, usage statistics, activity log, user management.

## Capabilities and Constraints

- React (Vite) frontend calling a Flask API; MySQL; XGBoost model trained on the Kaggle cardiovascular dataset (ages 30-65); SHAP TreeExplainer; OpenAI-compatible LLM.
- Educational only: no diagnosis, medication or treatment advice; every result, plan and chat carries a disclaimer.
- The model predicts presence of CVD, not 10-year risk. Lifestyle factors are Yes/No in the model; amounts personalise advice only.
- LLM replies can take up to 10 s (narrative) or 45 s (plan) and can fail; the interface must show waiting and failure states.
- Risk categories: Low (< 40%), Moderate (40-69%), High (70%+).

## Brand Commitments

- Name: CardioXplain. The heart idea stays.
- Everything else visual is open: the FYP1 mockups (Figures 3.25-3.35) were a prototype and are not binding.

## Evidence on Hand

- Model results on 13,720 unseen test records: accuracy 73.4%, AUC 0.8015 (`backend/ml/output/metrics.json`).
- Risk category check: Low 24.5%, Moderate 54.0%, High 83.2% actually have CVD.
- SHAP charts and confusion matrix in `backend/ml/output/figures/`.
- No testimonials, clinical validation, endorsements or partner logos exist; none may be invented.

## Product Principles

1. Explain, do not just score: every number comes with its reasons.
2. Calm, not alarming: users may be anxious; results inform without frightening.
3. Honest about limits: estimated values, model limits and the educational disclaimer are always visible.
4. Next step always clear: every result points to something the user can do.
5. Plain language for people without medical training.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast and keyboard access; colour is never the only signal (risk category and SHAP direction always in words).
- Readable for older adults: generous text size, large tap targets.
- Works on phones as well as laptops.
