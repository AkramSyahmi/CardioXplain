// Risk result: score, SHAP explanation (UC-300), LLM narrative (UC-400). Figure 3.29.
import { Bar, BarChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router";

const YES_NO_FIELDS = ["smoke", "alco", "active"];
const GENDER = { male: "Male", female: "Female" };
const LEVEL = { 1: "Normal", 2: "Above normal", 3: "Well above normal" };

/** The user's value in plain words, e.g. smoke 0 -> "No", cholesterol 2 -> "Above normal". */
export function displayValue(feature, value) {
  if (YES_NO_FIELDS.includes(feature)) return value ? "Yes" : "No";
  if (feature === "gender") return GENDER[value] ?? value;
  if (feature === "cholesterol" || feature === "gluc") return LEVEL[value] ?? value;
  return value;
}

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
    <p role="alert">
      <strong>Estimated result.</strong> You did not know your{" "}
      {estimated.map((name) => ESTIMATE_NAMES[name]).join(", ")}, so typical values were used (
      {typicalValues(estimated)}). Your real risk may be higher or lower. Get these checked at a clinic or
      pharmacy, then do a new assessment.
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
    <p>
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

function ShapChart({ shap }) {
  const data = shap.map((item) => ({ label: item.label, effect: Number((item.shap * 100).toFixed(1)) }));
  return (
    <figure>
      <BarChart width={640} height={40 + data.length * 32} data={data} layout="vertical"
        margin={{ left: 160, right: 24 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" unit="%" />
        <YAxis type="category" dataKey="label" width={150} />
        <Tooltip formatter={(value) => `${value > 0 ? "+" : ""}${value}%`} />
        <ReferenceLine x={0} />
        <Bar dataKey="effect" name="Effect on risk" />
      </BarChart>
      <figcaption>Bars to the right raise your risk; bars to the left lower it.</figcaption>
    </figure>
  );
}

export default function ResultView({ result }) {
  return (
    <>
      <section>
        <h2>Risk Score</h2>
        {result.estimated_fields?.length > 0 && <EstimateWarning estimated={result.estimated_fields} />}
        <p>
          <strong>{result.risk_percent}%</strong>
        </p>
        <p>
          Risk category: <strong>{result.risk_category}</strong>
        </p>
        <p>
          Input summary: Age {result.inputs.age}, {displayValue("gender", result.inputs.gender)}, BMI{" "}
          {result.inputs.bmi}, BP {result.inputs.ap_hi}/{result.inputs.ap_lo}
        </p>
        <LifestyleSummary inputs={result.inputs} />
      </section>

      <section>
        <h2>SHAP Feature Contributions</h2>
        {result.shap ? (
          <>
            <ShapChart shap={result.shap} />
            <ShapTable shap={result.shap} estimated={result.estimated_fields ?? []} />
          </>
        ) : (
          <p role="alert">{result.shap_error}</p>
        )}
      </section>

      <section>
        <h2>AI-Generated Risk Narrative</h2>
        {result.narrative ? <p>{result.narrative.text}</p> : <p>No narrative was saved for this result.</p>}
        <p>
          <em>{result.disclaimer}</em>
        </p>
      </section>

      <section>
        <h2>Explore your results</h2>
        <ul>
          <li><Link to="/simulator">What-If Lifestyle Simulator</Link></li>
          <li><Link to="/plan">View Health Action Plan</Link></li>
          <li><Link to="/navigator">Ask the Care Navigator</Link></li>
          <li><Link to="/history">View All History</Link></li>
        </ul>
      </section>
    </>
  );
}
