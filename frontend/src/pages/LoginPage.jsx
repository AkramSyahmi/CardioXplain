// UC-100 Register & Login (Figures 3.25, 3.26).
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { homeFor, useAuth } from "../auth.jsx";
import FieldError from "../components/FieldError.jsx";
import LoginHeart from "../components/LoginHeart.jsx";
import logoLight from "../assets/logo-light.png";
import logo from "../assets/logo-full.png";
import "./LoginPage.css";

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
    <main className="login">
      <section className="login-art" aria-label="About CardioXplain">
        <p className="login-logo">
          {/* Desktop: light logo straight on the dark panel. Phones keep the logo on a white pill. */}
          <picture>
            <source srcSet={logoLight} media="(min-width: 821px)" />
            <img src={logo} alt="CardioXplain" width="170" height="32" />
          </picture>
          <span className="login-sub">XAI-Driven CVD Risk Assessment</span></p>
        <LoginHeart />
        <p className="login-line">Understand your heart risk and what you can change.</p>
      </section>

      <section className="login-panel">
        <div className="login-form">
          <h1>Welcome back</h1>
          <p className="page-lead">Sign in to your CardioXplain account</p>

          <div role="tablist" className="login-tabs">
            <button type="button" role="tab" aria-selected={tab === "signin"} onClick={() => switchTab("signin")}>
              Sign In
            </button>
            <button type="button" role="tab" aria-selected={tab === "register"} onClick={() => switchTab("register")}>
              Create Account
            </button>
          </div>

          {notice && <p role="status" className="login-status">{notice}</p>}
          {success && <p role="status" className="login-status">{success}</p>}
          {error && <p role="alert">{error}</p>}

          <form onSubmit={submit}>
            {tab === "register" && (
              <div className="field">
                <label htmlFor="full_name">Full Name</label>
                <input id="full_name" name="full_name" value={form.full_name} onChange={change} required />
                <FieldError fields={fields} name="full_name" />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email Address</label>
              <input id="email" name="email" type="email" value={form.email} onChange={change} required />
              <FieldError fields={fields} name="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" value={form.password} onChange={change} required />
              <FieldError fields={fields} name="password" />
            </div>
            {tab === "register" && (
              <div className="field">
                <label htmlFor="confirm">Confirm Password</label>
                <input id="confirm" name="confirm" type="password" value={form.confirm} onChange={change} required />
                <FieldError fields={fields} name="confirm" />
              </div>
            )}
            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? "Please wait..." : tab === "signin" ? "Sign In" : "Create my account"}
            </button>
          </form>
          {/* Desktop only (hidden on phones by CSS): a second, plainer way to switch between the two tabs. */}
          <p className="login-switch">
            {tab === "signin" ? "New here? " : "Already have an account? "}
            <button type="button" className="link-button" onClick={() => switchTab(tab === "signin" ? "register" : "signin")}>
              {tab === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </p>

          <p className="help login-note">This system is for educational purposes only and does not provide medical advice.</p>
        </div>
      </section>
    </main>
  );
}
