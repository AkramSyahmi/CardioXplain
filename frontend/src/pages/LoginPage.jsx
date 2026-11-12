// UC-100 Register & Login (Figures 3.25, 3.26).
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { homeFor, useAuth } from "../auth.jsx";
import FieldError from "../components/FieldError.jsx";

const EMPTY = { full_name: "", email: "", password: "", confirm: "" };

export default function LoginPage() {
  const { user, notice, login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("signin");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function switchTab(next) {
    setTab(next);
    setError("");
    setFields({});
    setSuccess("");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setFields({});
    if (tab === "register" && form.password !== form.confirm) {
      setFields({ confirm: "Passwords do not match." });
      return;
    }
    setBusy(true);
    try {
      if (tab === "signin") {
        const loggedIn = await login(form.email, form.password);
        navigate(homeFor(loggedIn), { replace: true });
      } else {
        const data = await register({ full_name: form.full_name, email: form.email, password: form.password });
        setTab("signin");
        setForm({ ...EMPTY, email: form.email });
        setSuccess(data.message);
      }
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <p>
        <strong>CardioXplain</strong> - XAI-Driven CVD Risk Assessment
      </p>
      <h1>Welcome back</h1>
      <p>Sign in to your CardioXplain account</p>

      <div role="tablist">
        <button type="button" role="tab" aria-selected={tab === "signin"} onClick={() => switchTab("signin")}>
          Sign In
        </button>{" "}
        <button type="button" role="tab" aria-selected={tab === "register"} onClick={() => switchTab("register")}>
          Create Account
        </button>
      </div>

      {notice && <p role="status">{notice}</p>}
      {success && <p role="status">{success}</p>}
      {error && <p role="alert">{error}</p>}

      <form onSubmit={submit}>
        {tab === "register" && (
          <p>
            <label htmlFor="full_name">Full Name</label>
            <br />
            <input id="full_name" name="full_name" value={form.full_name} onChange={change} required />
            <FieldError fields={fields} name="full_name" />
          </p>
        )}
        <p>
          <label htmlFor="email">Email Address</label>
          <br />
          <input id="email" name="email" type="email" value={form.email} onChange={change} required />
          <FieldError fields={fields} name="email" />
        </p>
        <p>
          <label htmlFor="password">Password</label>
          <br />
          <input id="password" name="password" type="password" value={form.password} onChange={change} required />
          <FieldError fields={fields} name="password" />
        </p>
        {tab === "register" && (
          <p>
            <label htmlFor="confirm">Confirm Password</label>
            <br />
            <input id="confirm" name="confirm" type="password" value={form.confirm} onChange={change} required />
            <FieldError fields={fields} name="confirm" />
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Please wait..." : tab === "signin" ? "Sign In" : "Create my account"}
        </button>
      </form>

      <p>This system is for educational purposes only and does not provide medical advice.</p>
    </main>
  );
}
