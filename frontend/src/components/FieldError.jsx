import Icon from "./Icon.jsx";

/** One field's error message from the API, e.g. fields.ap_hi. */
export default function FieldError({ fields, name }) {
  if (!fields?.[name]) return null;
  return <p role="alert" className="field-error"><Icon name="alert" size={16} />{fields[name]}</p>;
}
