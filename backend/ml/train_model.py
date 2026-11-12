"""Train the CardioXplain XGBoost model (proposal section 3.2.3 - 3.2.6).

Run from the backend folder:  venv\\Scripts\\python ml\\train_model.py
"""
import json
import time
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # save charts to files, no window
import matplotlib.pyplot as plt
import pandas as pd
import shap
from scipy.stats import randint, uniform
from sklearn.metrics import (ConfusionMatrixDisplay, RocCurveDisplay, accuracy_score,
                             confusion_matrix, f1_score, precision_score, recall_score,
                             roc_auc_score)
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, train_test_split
from xgboost import XGBClassifier

from features import FEATURES, TARGET, VALID_RANGES, risk_category

ML_DIR = Path(__file__).resolve().parent
DATA_FILE = ML_DIR / "data" / "cardio_train.csv"
OUTPUT_DIR = ML_DIR / "output"

RANDOM_STATE = 42  # fixed so every run gives the same split and results

# Hyperparameter ranges from Table 3.4a.
PARAM_RANGES = {
    "n_estimators": randint(100, 501),        # 100 - 500
    "max_depth": randint(3, 9),               # 3 - 8
    "learning_rate": uniform(0.01, 0.29),     # 0.01 - 0.30
    "subsample": uniform(0.6, 0.4),           # 0.6 - 1.0
    "colsample_bytree": uniform(0.6, 0.4),    # 0.6 - 1.0
}
# Monotonic constraints (CHANGES.md #14). Without them the model learns from this dataset
# that smoking, alcohol and high glucose LOWER risk, which is medically wrong.
# +1 = can only raise risk, -1 = can only lower risk, 0 = free.
MONOTONE_CONSTRAINTS = {
    "age": 1, "ap_hi": 1, "ap_lo": 1, "cholesterol": 1, "gluc": 1,
    "smoke": 1, "alco": 1, "bmi": 1, "active": -1,
    "gender": 0, "height": 0, "weight": 0,
}
SEARCH_ITERATIONS = 40
CV_FOLDS = 5
SHAP_BACKGROUND_ROWS = 100   # reference people for probability-mode SHAP (CHANGES.md #13)
SHAP_EXPLAIN_ROWS = 1000     # test rows used for the global SHAP charts


def load_and_clean():
    """Load the Kaggle dataset and clean it (section 3.2.4). Returns (dataframe, summary)."""
    df = pd.read_csv(DATA_FILE, sep=";").drop(columns="id")
    summary = {"rows_before": len(df), "removed": {}}

    def remove(reason, mask):
        nonlocal df
        summary["removed"][reason] = int(mask.sum())
        df = df[~mask]

    remove("duplicate rows", df.duplicated())

    df = df.assign(age=(df["age"] / 365.25).astype(int))  # days -> whole years
    for column, (low, high) in VALID_RANGES.items():
        remove(f"{column} outside {low}-{high}", ~df[column].between(low, high))
    remove("diastolic higher than systolic (ap_lo > ap_hi)", df["ap_lo"] > df["ap_hi"])

    df = df.assign(bmi=(df["weight"] / (df["height"] / 100) ** 2).round(2))

    summary["rows_after"] = len(df)
    summary["rows_removed_total"] = summary["rows_before"] - summary["rows_after"]
    summary["percent_removed"] = round(100 * summary["rows_removed_total"] / summary["rows_before"], 2)
    summary["target_balance"] = {
        "no_cvd (0)": int((df["cardio"] == 0).sum()),
        "cvd (1)": int((df["cardio"] == 1).sum()),
    }
    return df.reset_index(drop=True), summary


def tune_and_train(X_train, y_train):
    """Randomized search with 5-fold CV on the training set only (section 3.2.6.3).

    The best settings (highest mean validation AUC) are refit on the full training set.
    n_estimators is chosen by CV, which replaces early stopping (CHANGES.md #12).
    """
    search = RandomizedSearchCV(
        XGBClassifier(objective="binary:logistic", tree_method="hist",
                      monotone_constraints=MONOTONE_CONSTRAINTS,
                      random_state=RANDOM_STATE, n_jobs=1),
        param_distributions=PARAM_RANGES,
        n_iter=SEARCH_ITERATIONS,
        scoring="roc_auc",
        cv=StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE),
        refit=True,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )
    start = time.time()
    search.fit(X_train, y_train)
    best = search.best_index_
    summary = {
        "method": f"RandomizedSearchCV, {SEARCH_ITERATIONS} combinations x {CV_FOLDS}-fold CV",
        "scoring": "roc_auc",
        "best_params": {k: round(float(v), 4) if isinstance(v, float) else int(v)
                        for k, v in search.best_params_.items()},
        "best_cv_auc_mean": round(float(search.cv_results_["mean_test_score"][best]), 4),
        "best_cv_auc_std": round(float(search.cv_results_["std_test_score"][best]), 4),
        "training_time_seconds": round(time.time() - start, 1),
    }
    return search.best_estimator_, summary


def evaluate(model, X_test, y_test, figures_dir):
    """Final evaluation on the unseen test set (Table 3.4) and Ch4 figures."""
    scores = model.predict_proba(X_test)[:, 1]
    predicted = (scores >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, predicted).ravel()
    metrics = {
        "test_rows": len(y_test),
        "accuracy": round(accuracy_score(y_test, predicted), 4),
        "precision": round(precision_score(y_test, predicted), 4),
        "recall": round(recall_score(y_test, predicted), 4),
        "f1_score": round(f1_score(y_test, predicted), 4),
        "auc": round(roc_auc_score(y_test, scores), 4),
        "confusion_matrix": {"true_negative": int(tn), "false_positive": int(fp),
                             "false_negative": int(fn), "true_positive": int(tp)},
    }

    # Risk category check: share of people in each category who actually have CVD.
    categories = pd.Series(scores).map(risk_category)
    actual = pd.Series(y_test.to_numpy())
    metrics["risk_categories"] = {
        name: {"people": int((categories == name).sum()),
               "actual_cvd_percent": round(100 * actual[categories == name].mean(), 1)}
        for name in ["Low", "Moderate", "High"]
    }

    figures_dir.mkdir(exist_ok=True)
    ConfusionMatrixDisplay.from_predictions(
        y_test, predicted, display_labels=["No CVD", "CVD"], cmap="Blues", values_format="d")
    plt.title("Confusion Matrix (Test Set)")
    plt.savefig(figures_dir / "confusion_matrix.png", dpi=200, bbox_inches="tight")
    plt.close()

    RocCurveDisplay.from_predictions(y_test, scores, name="XGBoost")
    plt.plot([0, 1], [0, 1], "k--", label="Random guess (AUC = 0.5)")
    plt.title("ROC Curve (Test Set)")
    plt.legend()
    plt.savefig(figures_dir / "roc_curve.png", dpi=200, bbox_inches="tight")
    plt.close()
    return metrics


def make_explainer(model, X_train):
    """SHAP TreeExplainer in probability mode (section 3.2.7, CHANGES.md #13).

    Each SHAP value is a change in predicted probability, so
    baseline + sum of SHAP values = predicted probability.
    """
    background = X_train.sample(SHAP_BACKGROUND_ROWS, random_state=RANDOM_STATE)
    explainer = shap.TreeExplainer(model, data=background, model_output="probability",
                                   feature_perturbation="interventional")
    return explainer, background


def explain_globally(model, explainer, X_test, figures_dir):
    """Global SHAP charts for Ch4, plus checks on additivity and the smoking effect."""
    sample = X_test.sample(SHAP_EXPLAIN_ROWS, random_state=RANDOM_STATE)
    shap_values = explainer.shap_values(sample)
    probabilities = model.predict_proba(sample)[:, 1]

    # Check: baseline + sum of SHAP values must equal the predicted probability.
    reconstructed = explainer.expected_value + shap_values.sum(axis=1)
    additivity_error = float(abs(reconstructed - probabilities).max())

    # Lifestyle checks: average risk change when people make a healthy change (What-If).
    # Every change should lower risk or keep it the same, never raise it.
    healthy_changes = {
        "stop smoking": ("smoke", 1, 0),
        "stop alcohol": ("alco", 1, 0),
        "become physically active": ("active", 0, 1),
        "glucose to normal": ("gluc", 3, 1),
    }
    lifestyle_checks = {}
    for name, (column, before, after) in healthy_changes.items():
        people = sample[sample[column] == before]
        change = (model.predict_proba(people.assign(**{column: after}))[:, 1]
                  - model.predict_proba(people)[:, 1])
        lifestyle_checks[name] = {
            "people": len(people),
            "mean_risk_change_percent_points": round(100 * float(change.mean()), 2),
            "people_whose_risk_went_up": int((change > 1e-9).sum()),
        }

    importance = pd.Series(abs(shap_values).mean(axis=0), index=sample.columns)
    summary = {
        "explained_rows": len(sample),
        "baseline_probability": round(float(explainer.expected_value), 4),
        "additivity_max_error": additivity_error,
        "mean_abs_shap": importance.sort_values(ascending=False).round(4).to_dict(),
        "lifestyle_checks": lifestyle_checks,
    }

    shap.summary_plot(shap_values, sample, plot_type="bar", show=False)
    plt.title("Global Feature Importance (mean |SHAP value|)")
    plt.xlabel("Average change in predicted CVD probability")
    plt.savefig(figures_dir / "shap_importance.png", dpi=200, bbox_inches="tight")
    plt.close()

    shap.summary_plot(shap_values, sample, show=False)
    plt.title("SHAP Summary (effect of each factor on CVD risk)")
    plt.xlabel("SHAP value (change in predicted CVD probability)")
    plt.savefig(figures_dir / "shap_summary.png", dpi=200, bbox_inches="tight")
    plt.close()
    return summary


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    df, summary = load_and_clean()

    # 80:20 stratified split (section 3.2.6.2). The test set is only used for final evaluation.
    X_train, X_test, y_train, y_test = train_test_split(
        df[FEATURES], df[TARGET], test_size=0.2, stratify=df[TARGET], random_state=RANDOM_STATE)
    summary["split"] = {
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "train_cvd_percent": round(100 * y_train.mean(), 2),
        "test_cvd_percent": round(100 * y_test.mean(), 2),
    }

    (OUTPUT_DIR / "cleaning_summary.json").write_text(json.dumps(summary, indent=2))
    print("Data summary:")
    print(json.dumps(summary, indent=2))

    print(f"\nTuning XGBoost ({SEARCH_ITERATIONS} combinations x {CV_FOLDS}-fold CV)...")
    model, training_summary = tune_and_train(X_train, y_train)
    (OUTPUT_DIR / "training_summary.json").write_text(json.dumps(training_summary, indent=2))
    print("Training summary:")
    print(json.dumps(training_summary, indent=2))

    metrics = evaluate(model, X_test, y_test, OUTPUT_DIR / "figures")
    (OUTPUT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("Test set metrics:")
    print(json.dumps(metrics, indent=2))

    print("\nCalculating SHAP values...")
    explainer, background = make_explainer(model, X_train)
    shap_summary = explain_globally(model, explainer, X_test, OUTPUT_DIR / "figures")
    (OUTPUT_DIR / "shap_summary.json").write_text(json.dumps(shap_summary, indent=2))
    print("SHAP summary:")
    print(json.dumps(shap_summary, indent=2))

    # Save for the backend (section 3.2.6.2 step 6). XGBoost's own JSON format is used
    # instead of pickle/joblib, because loading a pickle file can run hidden code.
    model.save_model(OUTPUT_DIR / "model.json")
    background.to_csv(OUTPUT_DIR / "shap_background.csv", index=False)
    print(f"\nModel saved to {OUTPUT_DIR / 'model.json'}")


if __name__ == "__main__":
    main()
