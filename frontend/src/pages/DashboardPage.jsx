// User dashboard (Figure 3.27).
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api.js";
import { useAuth } from "../auth.jsx";
import HistoryTable from "../components/HistoryTable.jsx";
import Icon from "../components/Icon.jsx";
import { categoryClass } from "../components/RiskGauge.jsx";
import RiskDrivers from "../components/RiskDrivers.jsx";
import RiskTrend from "../components/RiskTrend.jsx";
import StatTile from "../components/StatTile.jsx";
import TodayPlan from "../components/TodayPlan.jsx";
import { formatDate } from "../format.js";
import "./DashboardPage.css";
import Skeleton from "../components/Skeleton.jsx";

const QUICK_ACTIONS = [
  ["/assessment", "Start risk assessment", "plus", "sky"],
  ["/simulator", "What-If Simulator", "gauge", "sage"],
  ["/plan", "Health Action Plan", "calendar", "butter"],
  ["/navigator", "Care Navigator", "chat", "white"],
];

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
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/assessment">
            New assessment<span className="go go-light"><Icon name="plus" /></span>
          </Link>
        </div>
      </section>

      {error && <p role="alert">{error}</p>}
      {!history && !error && <Skeleton tiles={4} lines={0} cards={0} />}

      {history && (
        <ul className="stats" aria-label="Summary">
          <StatTile label="Total assessments" value={predictions.length} />
          <StatTile label="Latest risk score" value={latest ? `${latest.risk_percent}%` : "-"}>
            {latest ? <>{latest.risk_percent}<span className="unit">%</span></> : "-"}
          </StatTile>
          <StatTile label="Risk category" value={latest ? latest.risk_category : "-"}>
            {latest ? <span className={`chip ${categoryClass(latest.risk_category)}`}>{latest.risk_category}</span> : "-"}
          </StatTile>
          <StatTile label="Last assessment" value={latest ? formatDate(latest.prediction_date) : "-"}>
            <span className="stat-text">{latest ? formatDate(latest.prediction_date) : "-"}</span>
          </StatTile>
        </ul>
      )}

      {/* Two stacked columns, so each card keeps its natural height. */}
      <div className="dash-columns">
        <div className="dash-col">
          {predictions.length > 0 && <RiskTrend predictions={predictions} />}
          <section className="card recent" aria-labelledby="recent-heading">
            <div className="card-head">
              <h2 id="recent-heading">Recent assessments</h2>
              {predictions.length > 0 && <Link to="/history">View all</Link>}
            </div>
            {!history && !error && <Skeleton cards={0} lines={4} />}
            {history && predictions.length === 0 && <p>{history.message}</p>}
            {predictions.length > 0 && <HistoryTable predictions={predictions.slice(0, 5)} />}
          </section>
          <section className="dash-actions" aria-labelledby="actions-heading">
            <h2 id="actions-heading">Quick actions</h2>
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
        {predictions.length > 0 && (
          <div className="dash-col">
            <RiskDrivers predictionId={latest.prediction_id} />
            <TodayPlan />
          </div>
        )}
      </div>
    </>
  );
}
