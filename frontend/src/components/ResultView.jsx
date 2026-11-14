// Risk result: score, SHAP explanation (UC-300), LLM narrative (UC-400). Figure 3.29.
import Markdown from "react-markdown";
import { Link } from "react-router";
import { displayValue } from "../format.js";
import Icon from "./Icon.jsx";
import RiskGauge from "./RiskGauge.jsx";
import ShapLedger from "./ShapLedger.jsx";
import "./ResultView.css";

export { displayValue };

function effect(shap) {
  const points = (shap * 100).toFixed(1);
  return shap > 0 ? `+${points}%` : `${points}%`;
}

// Typical values the backend uses for "I don't know" (CHANGES.md #23).
const ESTIMATE_NAMES = { ap_hi: "systolic blood pressure", ap_lo: "diastolic blood pressure",
  cholesterol: "cholesterol level", gluc: "glucose level" };

function typicalValues(estimated) {
  const parts = [];
  if (estimated.includes("ap_hi") || estimated.includes("ap_lo")) parts.push("blood pressure 120/80 mmHg");
  if (estimated.includes("cholesterol")) parts.push("cholesterol Normal");
  if (estimated.includes("gluc")) parts.push("glucose Normal");
  return parts.join(", ");
}

function EstimateWarning({ estimated }) {
  return (
    <p role="alert" className="estimate">
      <Icon name="alert" />
      <span>
        <strong>Estimated result.</strong> You did not know your{" "}
        {estimated.map((name) => ESTIMATE_NAMES[name]).join(", ")}, so typical values were used (
        {typicalValues(estimated)}). Your real risk may be higher or lower. Get these checked at a clinic or
        pharmacy, then do a new assessment.
      </span>
    </p>
  );
}

/** Lifestyle amounts (CHANGES.md #24); old results saved without amounts show nothing here. */
function LifestyleSummary({ inputs }) {
  const parts = [];
  if (inputs.cigarettes_per_day != null) parts.push(`${inputs.cigarettes_per_day} cigarettes per day`);
  if (inputs.drinks_per_week != null) parts.push(`${inputs.drinks_per_week} drinks per week`);
  if (inputs.activity_minutes != null) parts.push(`${inputs.activity_minutes} minutes of exercise per week`);
  if (parts.length === 0) return null;
  return (
    <p className="lifestyle">
      Lifestyle: {parts.join(", ")}.
      <br />
      <small>The risk model uses Yes/No for lifestyle; your amounts are used to personalise your advice.</small>
    </p>
  );
}

/** Table of every factor's SHAP contribution (also used by the What-If simulator). */
export function ShapTable({ shap, estimated = [] }) {
  return (
    <table aria-label="Factor contributions">
      <thead>
        <tr>
          <th>Factor</th>
          <th>Your value</th>
          <th>Effect on risk</th>
          <th>Direction</th>
        </tr>
      </thead>
      <tbody>
        {shap.map((item) => (
          <tr key={item.feature}>
            <td>{item.label}</td>
            <td>
              {displayValue(item.feature, item.value)}
              {estimated.includes(item.feature) && " (estimated)"}
            </td>
            <td>{effect(item.shap)}</td>
            <td>{item.shap > 0 ? "Raises risk" : item.shap < 0 ? "Lowers risk" : "No effect"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Big-number tiles for the inputs people can act on. */
function InputTiles({ inputs, estimated }) {
  const bpEstimated = estimated.includes("ap_hi") || estimated.includes("ap_lo");
  const minutes = inputs.activity_minutes;
  return (
    <div className="tiles">
      <div className={bpEstimated ? "tile tile-estimated" : "tile"}>
        <p className="tile-top"><span>Blood pressure</span><span className="tile-icon"><Icon name="drop" /></span></p>
        <p className="big-num">{inputs.ap_hi}<span className="unit">/{inputs.ap_lo} mmHg</span></p>
        <p className="tile-sub">{bpEstimated ? "Estimated, not measured" : "Measured by you"}</p>
      </div>
      <div className="tile">
        <p className="tile-top"><span>Exercise</span><span className="tile-icon"><Icon name="run" /></span></p>
        {minutes != null ? (
          <>
            <p className="big-num">{minutes}<span className="unit">/150 min a week</span></p>
            <span className="meter" aria-hidden="true">
              {Array.from({ length: 15 }, (_, i) => <span key={i} className={i < Math.floor(minutes / 10) ? "on" : ""} />)}
            </span>
          </>
        ) : (
          <p className="big-num">{inputs.active ? "Active" : "Not active"}</p>
        )}
      </div>
      <div className="tile">
        <p className="tile-top"><span>BMI</span><span className="tile-icon"><Icon name="scale" /></span></p>
        <p className="big-num">{Number(inputs.bmi).toFixed(1)}</p>
        <p className="tile-sub">{inputs.weight} kg, {inputs.height} cm</p>
      </div>
      <div className="tile">
        <p className="tile-top"><span>Smoking</span><span className="tile-icon"><Icon name="smoke" /></span></p>
        {inputs.cigarettes_per_day != null ? (
          <p className="big-num">{inputs.cigarettes_per_day}<span className="unit">a day</span></p>
        ) : (
          <p className="big-num">{inputs.smoke ? "Yes" : "No"}</p>
        )}
        <p className="tile-sub">Age {inputs.age}, {displayValue("gender", inputs.gender)}</p>
      </div>
    </div>
  );
}

const EXPLORE = [
  ["/simulator", "What-If Lifestyle Simulator"],
  ["/plan", "View Health Action Plan"],
  ["/navigator", "Ask the Care Navigator"],
  ["/history", "View all history"],
];

export default function ResultView({ result }) {
  const estimated = result.estimated_fields ?? [];
  return (
    <div className="result">
      <div className="result-col">
        <section className="card card-dark risk-card" aria-labelledby="risk-heading">
          <h2 id="risk-heading" className="card-title"><span className="title-icon"><Icon name="heart" /></span>Risk score</h2>
          <RiskGauge percent={result.risk_percent} category={result.risk_category} />
          {estimated.length > 0 && <EstimateWarning estimated={estimated} />}
        </section>
        <section className="result-inputs" aria-label="Your inputs">
          <InputTiles inputs={result.inputs} estimated={estimated} />
          <LifestyleSummary inputs={result.inputs} />
        </section>
        <section aria-labelledby="explore-heading">
          <h2 id="explore-heading" className="visually-hidden">Explore your results</h2>
          <ul className="explore">
            {EXPLORE.map(([to, label]) => (
              <li key={to}><Link className="btn btn-light" to={to}>{label}<span className="go"><Icon name="arrow" /></span></Link></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="result-col">
        <section className="card" aria-labelledby="shap-heading">
          <div className="card-head">
            <h2 id="shap-heading" className="card-title"><span className="title-icon"><Icon name="list" /></span>What moved your risk</h2>
            <span className="chip">SHAP explanation</span>
          </div>
          {result.shap ? (
            <>
              <ShapLedger shap={result.shap} riskScore={result.risk_score} riskPercent={result.risk_percent} estimated={estimated} />
              <details className="exact">
                <summary>Show exact numbers</summary>
                <ShapTable shap={result.shap} estimated={estimated} />
              </details>
            </>
          ) : (
            <p role="alert">{result.shap_error ?? "No explanation was saved for this result."}</p>
          )}
        </section>

        <section className="card narrative" aria-labelledby="story-heading">
          <h2 id="story-heading" className="card-title"><span className="title-icon spark"><Icon name="spark" /></span>In plain words</h2>
          {result.narrative ? (
            // LLM replies may use **bold**; only paragraphs and emphasis are shown, never raw HTML.
            <div className="lead">
              <Markdown allowedElements={["p", "strong", "em"]} unwrapDisallowed>{result.narrative.text}</Markdown>
            </div>
          ) : <p>No narrative was saved for this result.</p>}
          <p className="disclaimer"><em>{result.disclaimer}</em></p>
        </section>

      </div>
    </div>
  );
}
