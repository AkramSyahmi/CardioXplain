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

Quick login while testing: copy `frontend/.env.local.example` to `frontend/.env.local` and fill in test accounts. The login page then shows one-click buttons during `npm run dev` only; they are removed from `npm run build`, and `.env.local` is never committed.

## Dataset

Download `cardio_train.csv` from
https://www.kaggle.com/datasets/sulianova/cardiovascular-disease-dataset
and place it in `backend/ml/data/`.

Optional, only to re-measure the smoking effect (CHANGES.md #29): place the Framingham Heart Study
teaching data as `backend/ml/data/framingham.csv` (Kaggle copy, licence not stated, so it is not
included) and run `venv\Scripts\python ml\framingham_smoking.py` from `backend`. The app only reads
the result in `backend/ml/output/framingham_smoking.json`.

> For educational purposes only. Not a medical diagnosis tool.

## Credits

- Health-factor icons (heart pulse, droplet, test tube, person, ruler, weight, cigarette, wine): Lucide, ISC License, https://lucide.dev (SVG paths copied into `frontend/src/components/Icon.jsx`).

- Smoking effect: estimated from the Framingham Heart Study teaching dataset (National Heart, Lung, and Blood Institute; Kaggle copy, licence not stated). The data is not redistributed; only two coefficients are used.

- 3D heart image: Microsoft Fluent Emoji (MIT License), https://github.com/microsoft/fluentui-emoji
- Animated heart on the login page (phones): Microsoft Fluent Emoji Animated (MIT License), https://github.com/microsoft/fluentui-emoji-animated (re-timed to about 65 beats a minute)
- 3D anatomical heart on the login page (desktop): "Heart - animated anatomical 3d model" by assetfactory, Sketchfab Standard licence, https://sketchfab.com/3d-models/heart-animated-anatomical-3d-model-dedbab26bd27413eaf55148caaccc9f7 (textures resized, packed as one .glb). Shown with Google model-viewer (Apache-2.0).
- Font: Manrope (SIL Open Font License), installed with `@fontsource-variable/manrope`.
