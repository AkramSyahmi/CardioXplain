# CardioXplain

An XAI-driven web system for cardiovascular disease (CVD) risk assessment and monitoring.
Final Year Project (PSM), Bachelor of Computer Science (Software Engineering), UMPSA.

**Stack:** React (Vite) · Flask · MySQL · XGBoost · SHAP · LLM API

## Backend setup

```bash
cd backend
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # then fill in your values
python run.py
```

Open http://localhost:5000 — it should show "CardioXplain backend is running".

## Upgrading an existing database

`flask --app run init-db` only creates missing tables; it does not add new columns to tables that
already exist. If your database was created before 12 Nov 2026, run these once in MySQL Workbench
(or simply drop `cardioxplain_db` and run `init-db` again):

```sql
USE cardioxplain_db;
ALTER TABLE predictions ADD COLUMN estimated_fields JSON NULL;          -- CHANGES.md #23
ALTER TABLE prediction_inputs ADD COLUMN cigarettes_per_day INT NULL;   -- CHANGES.md #24
ALTER TABLE prediction_inputs ADD COLUMN drinks_per_week INT NULL;
ALTER TABLE prediction_inputs ADD COLUMN activity_minutes INT NULL;
```

## Frontend setup

Needs Node.js 24. Start the backend first (it serves the API on port 5000).

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm test         # run the frontend tests
```

## Dataset

Download `cardio_train.csv` from
https://www.kaggle.com/datasets/sulianova/cardiovascular-disease-dataset
and place it in `backend/ml/data/`.

> For educational purposes only. Not a medical diagnosis tool.

## Credits

- 3D heart image: Microsoft Fluent Emoji (MIT License), https://github.com/microsoft/fluentui-emoji
- Font: Manrope (SIL Open Font License), installed with `@fontsource-variable/manrope`.
