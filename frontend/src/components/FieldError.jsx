/** One field's error message from the API, e.g. fields.ap_hi. */
export default function FieldError({ fields, name }) {
  if (!fields?.[name]) return null;
  return <p role="alert">{fields[name]}</p>;
}
