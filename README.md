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

## Dataset

Download `cardio_train.csv` from
https://www.kaggle.com/datasets/sulianova/cardiovascular-disease-dataset
and place it in `backend/ml/data/`.

> For educational purposes only. Not a medical diagnosis tool.
