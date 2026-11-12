// UC-500 Simulate Lifestyle Changes (Figure 3.30).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { apiRequest } from "../api.js";
import FieldError from "../components/FieldError.jsx";
import { ShapTable, displayValue } from "../components/ResultView.jsx";
import YesNoField from "../components/YesNoField.jsx";

const CHANGEABLE = ["smoke", "alco", "active", "weight"];

function formFrom(inputs) {
  return Object.fromEntries(CHANGEABLE.map((name) => [name, String(inputs[name])]));
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

  return (
    <>
      <h1>What-If Simulator</h1>
      <p>See how lifestyle changes may affect your estimated risk. This is a simulation, not a guarantee.</p>

      {loadError && (
        <>
          <p role="alert">{loadError}</p>
          <p><Link to="/assessment">Start Risk Assessment</Link></p>
        </>
      )}
      {!form && !loadError && <p>Loading...</p>}

      {form && (
        <form onSubmit={simulate} noValidate>
          <h2>Your fixed values</h2>
          <p>These stay fixed in the simulator.</p>
          <ul>
            <li>Age: {inputs.age}</li>
            <li>Height: {inputs.height} cm</li>
            <li>Blood pressure: {inputs.ap_hi}/{inputs.ap_lo} mmHg</li>
            <li>Cholesterol: {displayValue("cholesterol", inputs.cholesterol)}</li>
            <li>Glucose: {displayValue("gluc", inputs.gluc)}</li>
          </ul>

          <h2>Lifestyle changes to try</h2>
          <YesNoField name="smoke" label="Smoking" form={form} fields={fields} onChange={change} />
          <YesNoField name="alco" label="Alcohol intake" form={form} fields={fields} onChange={change} />
          <YesNoField name="active" label="Physical activity" form={form} fields={fields} onChange={change} />
          <p>
            <label htmlFor="weight">Weight (kg)</label>
            <br />
            <input id="weight" name="weight" type="number" inputMode="decimal" value={form.weight} onChange={change} />
            <FieldError fields={fields} name="weight" />
          </p>

          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Simulating..." : "Simulate"}</button>
        </form>
      )}

      {simulation && (
        <section>
          <h2>Simulation result</h2>
          <p>Before: {simulation.original.risk_percent}% ({simulation.original.risk_category})</p>
          <p>After: {simulation.simulated.risk_percent}% ({simulation.simulated.risk_category})</p>
          <p>{changeSentence(simulation.change_percent_points)}</p>

          <h3>Factors after the change</h3>
          {simulation.simulated.shap
            ? <ShapTable shap={simulation.simulated.shap} />
            : <p role="alert">{simulation.simulated.shap_error}</p>}

          <h3>What this means</h3>
          <p>{simulation.narrative.text}</p>
          <p><em>{simulation.disclaimer}</em></p>

          <button type="button" onClick={() => navigate("/plan", { state: { lifestyle: sentChanges } })}>
            Create a health plan with these values
          </button>
        </section>
      )}
    </>
  );
}
