// User dashboard (Figure 3.27).
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api.js";
import heart from "../assets/heart-3d.png";
import { useAuth } from "../auth.jsx";
import HistoryTable from "../components/HistoryTable.jsx";
import Icon from "../components/Icon.jsx";
import { categoryClass } from "../components/RiskGauge.jsx";
import { formatDate } from "../format.js";
import "./DashboardPage.css";

const QUICK_ACTIONS = [
  ["/assessment", "Start Risk Assessment", "plus", "sky"],
  ["/simulator", "What-If Simulator", "gauge", "sage"],
  ["/plan", "Health Action Plan", "calendar", "butter"],
  ["/navigator", "Care Navigator", "chat", "white"],
];

/** A stat tile: screen readers get one plain sentence, sighted users a small label and a big value. */
function Stat({ label, value, children, tone = "" }) {
  return (
    <li className={`stat ${tone}`}>
      <span className="visually-hidden">{label}: {value}</span>
      <span className="stat-label" aria-hidden="true">{label}</span>
      <span className="stat-value" aria-hidden="true">{children ?? value}</span>
    </li>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/history").then(setHistory).catch((err) => setError(err.message));
  }, []);

  const predictions = history?.predictions ?? [];
  const latest = predictions[0];

  return (
    <>
      <section className="hero">
        <div>
          <p className="hello">Welcome back, {user.full_name.split(" ")[0]}! Your cardiovascular health overview.</p>
          <h1>Dashboard</h1>
        </div>
        <img className="hero-heart" src={heart} alt="" width="190" height="190" />
        <div className="hero-actions">
          <Link className="btn btn-light" to="/history">View all<span className="go"><Icon name="arrow" /></span></Link>
          <Link className="btn btn-primary" to="/assessment">
            New Assessment<span className="go go-light"><Icon name="plus" /></span>
          </Link>
        </div>
      </section>

      {error && <p role="alert">{error}</p>}
      {!history && !error && <p>Loading...</p>}

      {history && (
        <ul className="stats" aria-label="Summary">
          <Stat label="Total Assessments" value={predictions.length} />
          <Stat label="Latest Risk Score" value={latest ? `${latest.risk_percent}%` : "-"} tone="sky">
            {latest ? <>{latest.risk_percent}<span className="unit">%</span></> : "-"}
          </Stat>
          <Stat label="Risk Category" value={latest ? latest.risk_category : "-"}>
            {latest ? <span className={`chip ${categoryClass(latest.risk_category)}`}>{latest.risk_category}</span> : "-"}
          </Stat>
          <Stat label="Last Assessment" value={latest ? formatDate(latest.prediction_date) : "-"} tone="sage" />
        </ul>
      )}

      <div className="dash-grid">
        <section className="card recent" aria-labelledby="recent-heading">
          <div className="card-head">
            <h2 id="recent-heading">Recent Assessments</h2>
            {predictions.length > 0 && <Link to="/history">View all</Link>}
          </div>
          {history && predictions.length === 0 && <p>{history.message}</p>}
          {predictions.length > 0 && <HistoryTable predictions={predictions.slice(0, 5)} />}
        </section>

        <section aria-labelledby="actions-heading">
          <h2 id="actions-heading">Quick Actions</h2>
          <ul className="actions">
            {QUICK_ACTIONS.map(([to, label, icon, tone]) => (
              <li key={to}>
                <Link className={`action action-${tone}`} to={to}>
                  <span className="action-icon"><Icon name={icon} /></span>
                  {label}
                  <span className="go"><Icon name="arrow" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="notice" aria-labelledby="notice-heading">
        <h2 id="notice-heading"><Icon name="alert" />Educational Notice</h2>
        <p>
          CardioXplain provides AI-driven risk awareness for educational purposes. Results are not a
          medical diagnosis. Always consult a qualified healthcare professional for medical advice.
        </p>
      </section>
    </>
  );
}
