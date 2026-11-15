"""Measure the smoking effect on the Framingham Heart Study data (approach C, CHANGES.md #29).

The Kaggle cardio data shows smokers with LESS heart disease (odds ratio 0.86), so the main model
learns almost no smoking effect. Framingham records cigarettes per day and 10-year heart disease.
Here a logistic regression, adjusted for the same things the main model already uses (age, sex,
blood pressure, cholesterol, BMI, glucose), gives one number per cigarette that can be added to
the main model's score. This script does not touch the live model.

Run from the backend folder:  venv\\Scripts\\python ml\\framingham_smoking.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

ML_DIR = Path(__file__).resolve().parent
DATA_FILE = ML_DIR / "data" / "framingham.csv"
OUTPUT_FILE = ML_DIR / "output" / "framingham_smoking.json"

TARGET = "TenYearCHD"
# Same risk factors as the main model's inputs, so smoking is not credited for their effect.
ADJUST_FOR = ["age", "male", "sysBP", "diaBP", "totChol", "BMI", "glucose"]
Z95 = 1.959964


def fit_logistic(X, y):
    """Plain (unpenalised) logistic regression by Newton's method. Returns (coefficients, standard errors).

    Done by hand because it also gives standard errors for the 95% interval without a new package.
    The first coefficient is the intercept.
    """
    X = np.column_stack([np.ones(len(X)), X])
    beta = np.zeros(X.shape[1])
    for _ in range(50):
        p = 1 / (1 + np.exp(-X @ beta))
        hessian = X.T @ (X * (p * (1 - p))[:, None])
        step = np.linalg.solve(hessian, X.T @ (y - p))
        beta += step
        if np.abs(step).max() < 1e-10:
            break
    p = 1 / (1 + np.exp(-X @ beta))
    covariance = np.linalg.inv(X.T @ (X * (p * (1 - p))[:, None]))
    return beta, np.sqrt(np.diag(covariance))


def odds_ratio(beta, se):
    """Odds ratio with its 95% confidence interval, rounded for the report."""
    return {"log_odds": round(float(beta), 5), "odds_ratio": round(float(np.exp(beta)), 4),
            "ci95": [round(float(np.exp(beta - Z95 * se)), 4), round(float(np.exp(beta + Z95 * se)), 4)]}


def smoking_effect(df, smoking_columns):
    """Fit TARGET ~ ADJUST_FOR + smoking columns; return the smoking coefficients and standard errors."""
    X = df[ADJUST_FOR + smoking_columns].to_numpy(float)
    y = df[TARGET].to_numpy(float)
    beta, se = fit_logistic(X, y)

    # Self-check: same coefficients as scikit-learn's unpenalised fit.
    reference = LogisticRegression(C=np.inf, tol=1e-10, max_iter=100000).fit((X - X.mean(0)) / X.std(0), y)
    assert np.allclose(beta[1:], reference.coef_[0] / X.std(0), rtol=1e-3, atol=1e-5), "fit does not match sklearn"

    n = len(ADJUST_FOR) + 1
    return {column: (beta[n + i], se[n + i]) for i, column in enumerate(smoking_columns)}


def main():
    raw = pd.read_csv(DATA_FILE)
    needed = ADJUST_FOR + ["currentSmoker", "cigsPerDay", TARGET]
    df = raw.dropna(subset=needed).reset_index(drop=True)

    per_cigarette = smoking_effect(df, ["cigsPerDay"])["cigsPerDay"]
    smoker = smoking_effect(df, ["currentSmoker"])["currentSmoker"]

    # Straight-line check: is "per cigarette" fair across light and heavy smokers?
    bands = {"1-10": (1, 10), "11-20": (11, 20), "21+": (21, 1000)}
    for name, (low, high) in bands.items():
        df[f"cigs_{name}"] = df["cigsPerDay"].between(low, high).astype(int)
    band_effects = smoking_effect(df, [f"cigs_{name}" for name in bands])

    result = {
        "source": "Framingham Heart Study teaching dataset (framingham.csv, Kaggle copy)",
        "outcome": "TenYearCHD (coronary heart disease within 10 years)",
        "method": "logistic regression, adjusted for " + ", ".join(ADJUST_FOR),
        "rows_total": len(raw),
        "rows_used": len(df),
        "rows_dropped_missing": len(raw) - len(df),
        "chd_rate_percent": round(100 * df[TARGET].mean(), 1),
        "per_cigarette_per_day": odds_ratio(*per_cigarette),
        "smoker_vs_non_smoker": odds_ratio(*smoker),
        "bands_vs_non_smoker": {name: odds_ratio(*band_effects[f"cigs_{name}"]) for name in bands},
        "smokers_in_band": {name: int(df[f"cigs_{name}"].sum()) for name in bands},
    }
    OUTPUT_FILE.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
