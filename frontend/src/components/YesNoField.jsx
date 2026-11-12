import FieldError from "./FieldError.jsx";

/** Yes / No radio buttons for smoke, alco and active (values "1" / "0"). */
export default function YesNoField({ name, label, form, fields, onChange }) {
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
