// UC-200 Perform Risk Assessment: the input form (Figure 3.28, Table 3.35).
import { useState } from "react";
import { useNavigate } from "react-router";
import { apiRequest } from "../api.js";
import FieldError from "../components/FieldError.jsx";

const NUMBER_FIELDS = ["age", "height", "weight", "ap_hi", "ap_lo", "cholesterol", "gluc", "smoke", "alco", "active"];
const UNSURE = "If you are unsure, choose Normal and ask for a check at a clinic.";
const EMPTY = { age: "", gender: "", height: "", weight: "", ap_hi: "", ap_lo: "",
  cholesterol: "", gluc: "", smoke: "", alco: "", active: "" };

/** Form values as the API expects them; empty fields stay "" so the API names them. */
function toBody(form) {
  const body = { ...form };
  for (const name of NUMBER_FIELDS) if (form[name] !== "") body[name] = Number(form[name]);
  return body;
}

function bmiOf(form) {
  const height = Number(form.height) / 100;
  const weight = Number(form.weight);
  return height > 0 && weight > 0 ? (weight / (height * height)).toFixed(2) : null;
}

function NumberField({ name, label, help, form, fields, onChange }) {
  return (
    <p>
      <label htmlFor={name}>{label}</label>
      <br />
      <input id={name} name={name} type="number" inputMode="decimal" value={form[name]} onChange={onChange} />
      {help && <><br /><small>{help}</small></>}
      <FieldError fields={fields} name={name} />
    </p>
  );
}

function LevelField({ name, label, form, fields, onChange }) {
  return (
    <p>
      <label htmlFor={name}>{label}</label>
      <br />
      <select id={name} name={name} value={form[name]} onChange={onChange}>
        <option value="">Choose...</option>
        <option value="1">Normal</option>
        <option value="2">Above normal</option>
        <option value="3">Well above normal</option>
      </select>
      <br />
      <small>{UNSURE}</small>
      <FieldError fields={fields} name={name} />
    </p>
  );
}

function YesNoField({ name, label, form, fields, onChange }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      {[["1", "Yes"], ["0", "No"]].map(([value, text]) => (
        <label key={value}>
          <input type="radio" name={name} value={value} checked={form[name] === value} onChange={onChange}
            aria-label={`${label}: ${text}`} />
          {text}{" "}
        </label>
      ))}
      <FieldError fields={fields} name={name} />
    </fieldset>
  );
}

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    try {
      const result = await apiRequest("/predict", { method: "POST", body: toBody(form) });
      navigate(`/result/${result.prediction_id}`, { state: { result } });
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
      setBusy(false);
    }
  }

  const bmi = bmiOf(form);
  const shared = { form, fields, onChange: change };

  return (
    <>
      <h1>New Risk Assessment</h1>
      <p>Enter your health and lifestyle information. Results are for educational purposes only.</p>
      {error && <p role="alert">{error}</p>}

      <form onSubmit={submit} noValidate>
        <h2>About you</h2>
        <NumberField name="age" label="Age (years)" help="This tool supports ages 30 to 65." {...shared} />
        <p>
          <label htmlFor="gender">Gender</label>
          <br />
          <select id="gender" name="gender" value={form.gender} onChange={change}>
            <option value="">Choose...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <FieldError fields={fields} name="gender" />
        </p>
        <NumberField name="height" label="Height (cm)" {...shared} />
        <NumberField name="weight" label="Weight (kg)" {...shared} />
        {bmi && <p>Your BMI: {bmi}</p>}

        <h2>Health measurements</h2>
        <NumberField name="ap_hi" label="Systolic blood pressure (mmHg)"
          help="The two numbers from a blood pressure reading, e.g. 120/80: systolic is the first, diastolic the second."
          {...shared} />
        <NumberField name="ap_lo" label="Diastolic blood pressure (mmHg)" {...shared} />
        <LevelField name="cholesterol" label="Cholesterol level" {...shared} />
        <LevelField name="gluc" label="Glucose level" {...shared} />

        <h2>Lifestyle</h2>
        <YesNoField name="smoke" label="Smoking" {...shared} />
        <YesNoField name="alco" label="Alcohol intake" {...shared} />
        <YesNoField name="active" label="Physical activity" {...shared} />

        <p>
          <button type="submit" disabled={busy}>{busy ? "Analysing... (this can take up to 10 seconds)" : "Predict Risk"}</button>
        </p>
      </form>
    </>
  );
}
