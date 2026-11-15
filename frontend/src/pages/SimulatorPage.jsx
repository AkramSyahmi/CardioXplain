// UC-500 Simulate Lifestyle Changes (Figure 3.30).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { apiRequest } from "../api.js";
import FieldError from "../components/FieldError.jsx";
import Markdown from "react-markdown";
import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { formatDate } from "../format.js";
import { ShapTable, displayValue } from "../components/ResultView.jsx";
import RiskGauge from "../components/RiskGauge.jsx";
import ShapLedger from "../components/ShapLedger.jsx";
import YesNoField from "../components/YesNoField.jsx";
import "./SimulatorPage.css";
import Skeleton from "../components/Skeleton.jsx";

const CHANGEABLE = ["smoke", "alco", "active", "weight", "cigarettes_per_day", "drinks_per_week", "activity_minutes"];

// Each lifestyle item: an amount box (CHANGES.md #24), or Yes/No for an old assessment saved without amounts.
const LIFESTYLE = [
  { amount: "cigarettes_per_day", flag: "smoke", label: "Smoking", amountLabel: "Cigarettes per day" },
  { amount: "drinks_per_week", flag: "alco", label: "Alcohol intake", amountLabel: "Alcoholic drinks per week" },
  { amount: "activity_minutes", flag: "active", label: "Physical activity",
    amountLabel: "Moderate exercise (minutes per week)" },
];

function formFrom(inputs) {
  return Object.fromEntries(CHANGEABLE.map((name) => [name, inputs[name] == null ? "" : String(inputs[name])]));
}

/** Only the values the user changed, as numbers. */
function changesFrom(form, inputs) {
  return Object.fromEntries(CHANGEABLE
    .filter((name) => form[name] !== "" && Number(form[name]) !== Number(inputs[name]))
    .map((name) => [name, Number(form[name])]));
}

function changeSentence(points) {
  if (points < 0) return `Your estimated risk would be ${Math.abs(points)} percentage points lower.`;
  if (points > 0) return `Your estimated risk would be ${points} percentage points higher.`;
  return "Your estimated risk would stay the same.";
}

export default function SimulatorPage() {
  const navigate = useNavigate();
  const [inputs, setInputs] = useState(null);
  const [estimated, setEstimated] = useState([]);
  const [basedOn, setBasedOn] = useState("");
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [sentChanges, setSentChanges] = useState({});

  useEffect(() => {
    apiRequest("/simulation")
      .then((data) => {
        setInputs(data.inputs);
        setEstimated(data.estimated_fields ?? []);
        setBasedOn(data.prediction_date ?? "");
        setForm(formFrom(data.inputs));
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function simulate(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setFields({});
    const changes = changesFrom(form, inputs);
    if (Object.keys(changes).length === 0) {
      setError("Please change at least one lifestyle value.");
      return;
    }
    setBusy(true);
    try {
      setSimulation(await apiRequest("/simulation", { method: "POST", body: changes }));
      setSentChanges(changes);
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
    } finally {
      setBusy(false);
    }
  }

  const points = simulation?.change_percent_points;
  // "I don't know" values from the assessment (CHANGES.md #23) stay marked as estimated here too.
  const mark = (...names) => (names.some((name) => estimated.includes(name)) ? " (estimated)" : "");

  return (
    <>
      <PageHeader icon="gauge" title="What-If Simulator" lead="Change your lifestyle values and compare your risk before and after.">
        {basedOn && <span className="chip">Based on your assessment of {formatDate(basedOn)}</span>}
      </PageHeader>

      {loadError && (
        <>
          <p role="alert">{loadError}</p>
          <p><Link className="btn btn-primary" to="/assessment">Start risk assessment</Link></p>
        </>
      )}
      {!form && !loadError && <Skeleton cards={2} lines={4} />}

      {form && (
        <form className="sim-form" onSubmit={simulate} noValidate>
          <section className="card" aria-labelledby="fixed-heading">
            <h2 id="fixed-heading">Your fixed values</h2>
            <p className="help">These stay fixed in the simulator.</p>
            <ul className="fixed-values">
              <li>Age: {inputs.age}</li>
              <li>Height: {inputs.height} cm</li>
              <li>Blood pressure: {inputs.ap_hi}/{inputs.ap_lo} mmHg{mark("ap_hi", "ap_lo")}</li>
              <li>Cholesterol: {displayValue("cholesterol", inputs.cholesterol)}{mark("cholesterol")}</li>
              <li>Glucose: {displayValue("gluc", inputs.gluc)}{mark("gluc")}</li>
            </ul>
          </section>

          <section className="card" aria-labelledby="change-heading">
            <h2 id="change-heading">Lifestyle changes to try</h2>
            <div className="field-grid">
              {LIFESTYLE.map((item) => (inputs[item.amount] == null ? (
                <YesNoField key={item.flag} name={item.flag} label={item.label} form={form} fields={fields} onChange={change} />
              ) : (
                <div className="field" key={item.amount}>
                  <label htmlFor={item.amount}>{item.amountLabel}</label>
                  <input id={item.amount} name={item.amount} type="number" inputMode="numeric" value={form[item.amount]}
                    onChange={change} />
                  <FieldError fields={fields} name={item.amount} />
                </div>
              )))}
              <div className="field">
                <label htmlFor="weight">Weight (kg)</label>
                <input id="weight" name="weight" type="number" inputMode="decimal" value={form.weight} onChange={change} />
                <FieldError fields={fields} name="weight" />
              </div>
            </div>
            <p className="help">150 minutes or more of moderate exercise a week counts as active (WHO guideline).</p>
            {error && <p role="alert">{error}</p>}
            <div className="submit-row">
              <button type="submit" disabled={busy}>{busy ? "Simulating..." : "Simulate"}</button>
            </div>
          </section>
        </form>
      )}

      {simulation && (
        <section className="sim-result" aria-labelledby="sim-heading">
          <h2 id="sim-heading">Simulation result</h2>
          <div className="card compare">
            <div className="compare-side">
              <RiskGauge percent={simulation.original.risk_percent} category={simulation.original.risk_category} size="small" />
              <p className="compare-caption">Before: {simulation.original.risk_percent}% ({simulation.original.risk_category})</p>
            </div>
            <span className="compare-arrow" aria-hidden="true"><Icon name="right" size={28} /></span>
            <div className="compare-side">
              <RiskGauge percent={simulation.simulated.risk_percent} category={simulation.simulated.risk_category} size="small" />
              <p className="compare-caption">After: {simulation.simulated.risk_percent}% ({simulation.simulated.risk_category})</p>
            </div>
            <p className={`delta ${points < 0 ? "delta-down" : points > 0 ? "delta-up" : ""}`}>{changeSentence(points)}</p>
          </div>

          <div className="sim-explain">
            <section className="card" aria-labelledby="after-heading">
              <h3 id="after-heading">Factors after the change</h3>
              {simulation.simulated.shap ? (
                <>
                  <ShapLedger shap={simulation.simulated.shap} riskScore={simulation.simulated.risk_score}
                    riskPercent={simulation.simulated.risk_percent} estimated={estimated} />
                  <details className="exact">
                    <summary>Show exact numbers</summary>
                    <ShapTable shap={simulation.simulated.shap} estimated={estimated} />
                  </details>
                </>
              ) : <p role="alert">{simulation.simulated.shap_error}</p>}
            </section>

            <section className="card narrative" aria-labelledby="means-heading">
              <h3 id="means-heading">What this means</h3>
              <div className="lead">
                <Markdown allowedElements={["p", "strong", "em"]} unwrapDisallowed>{simulation.narrative.text}</Markdown>
              </div>
              <p className="disclaimer"><em>{simulation.disclaimer}</em></p>
              <button type="button" className="plan-button" onClick={() => navigate("/plan", { state: { lifestyle: sentChanges } })}>
                Create a health plan with these values
              </button>
            </section>
          </div>

        </section>
      )}
    </>
  );
}
