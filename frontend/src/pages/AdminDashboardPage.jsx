// UC-900 Monitor Model Performance (Figure 3.34).
import { useEffect, useState } from "react";

const LOG_PREVIEW = 10; // the log can hold 50 rows; the rest are one click away
import { apiRequest } from "../api.js";
import StatTile from "../components/StatTile.jsx";
import { formatDateTime } from "../format.js";
import "./AdminPages.css";

const percent = (value) => `${(value * 100).toFixed(1)}%`;

/** Loads one admin endpoint; each section shows its own error. */
function useAdminData(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest(path).then(setData).catch((err) => setError(err.message));
  }, [path]);
  return [data, error];
}

function Metrics({ metrics, training }) {
  const cm = metrics.confusion_matrix;
  return (
    <>
      <p className="help">Results on {metrics.test_rows} unseen test records.</p>
      <ul className="stats stats-5" aria-label="Model metrics">
        <StatTile label="Accuracy" value={percent(metrics.accuracy)} tone="sky" />
        <StatTile label="Precision" value={percent(metrics.precision)} />
        <StatTile label="Recall" value={percent(metrics.recall)} />
        <StatTile label="F1-score" value={percent(metrics.f1_score)} />
        <StatTile label="AUC" value={metrics.auc} tone="sage" />
      </ul>

      <div className="admin-tables">
      <div className="card">
      <h3>Confusion matrix</h3>
      <div className="table-scroll">
      <table aria-label="Confusion matrix">
        <thead>
          <tr><th></th><th>Predicted: No CVD</th><th>Predicted: CVD</th></tr>
        </thead>
        <tbody>
          <tr><th>Actual: No CVD</th><td>{cm.true_negative}</td><td>{cm.false_positive}</td></tr>
          <tr><th>Actual: CVD</th><td>{cm.false_negative}</td><td>{cm.true_positive}</td></tr>
        </tbody>
      </table>
      </div>
      </div>

      {metrics.risk_categories && (
        <div className="card">
          <h3>Risk category check (test set)</h3>
          <div className="table-scroll">
          <table aria-label="Risk category check">
            <thead>
              <tr><th>Category</th><th>People</th><th>Actually have CVD</th></tr>
            </thead>
            <tbody>
              {Object.entries(metrics.risk_categories).map(([name, row]) => (
                <tr key={name}><td>{name}</td><td>{row.people}</td><td>{row.actual_cvd_percent}%</td></tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      </div>

      <div className="card training">
        <h3>Training</h3>
        <p>{training.method}. Cross-validation AUC: {training.best_cv_auc_mean}.</p>
        <ul className="params">
          {Object.entries(training.best_params).map(([name, value]) => (
            <li key={name}>{name}: {value}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function AdminDashboardPage() {
  const [model, modelError] = useAdminData("/admin/metrics");
  const [stats, statsError] = useAdminData("/admin/stats");
  const [logs, logsError] = useAdminData("/admin/logs?limit=50");
  const [allLogs, setAllLogs] = useState(false);
  const shownLogs = logs ? (allLogs ? logs.logs : logs.logs.slice(0, LOG_PREVIEW)) : [];

  return (
    <>
      <h1>Model Performance</h1>

      <section className="admin-section">
        <h2>Model evaluation</h2>
        {modelError && <p role="alert">{modelError}</p>}
        {!model && !modelError && <p>Loading...</p>}
        {model && <Metrics metrics={model.metrics} training={model.training} />}
      </section>

      <section className="admin-section">
        <h2>System usage</h2>
        {statsError && <p role="alert">{statsError}</p>}
        {stats && (
          <ul className="stats stats-6" aria-label="System usage">
            <StatTile label="Total users" value={stats.total_users} />
            <StatTile label="Total assessments" value={stats.total_assessments} tone="sky" />
            {Object.entries(stats.risk_distribution).map(([name, count]) => (
              <StatTile key={name} label={name} value={count} />
            ))}
            <StatTile label="LLM calls" value={`${stats.llm_calls.success} successful, ${stats.llm_calls.failed} failed`}
              tone={stats.llm_calls.failed > 0 ? "butter" : "sage"}>
              {stats.llm_calls.success}<span className="unit">ok</span> {stats.llm_calls.failed}<span className="unit">failed</span>
            </StatTile>
          </ul>
        )}
      </section>

      <section className="admin-section card">
        <h2>Recent activity</h2>
        {logsError && <p role="alert">{logsError}</p>}
        {logs && logs.logs.length === 0 && <p>No activity yet.</p>}
        {logs && logs.logs.length > 0 && (
          <div className="table-scroll">
          <table aria-label="Activity log">
            <thead>
              <tr><th>Time</th><th>Action</th><th>User ID</th><th>Description</th></tr>
            </thead>
            <tbody>
              {shownLogs.map((log) => (
                <tr key={log.log_id}>
                  <td>{formatDateTime(log.timestamp)}</td>
                  <td>{log.action}</td>
                  <td>{log.user_id ?? "-"}</td>
                  <td>{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {logs && !allLogs && logs.logs.length > LOG_PREVIEW && (
          <button type="button" className="show-more" onClick={() => setAllLogs(true)}>Show all {logs.logs.length}</button>
        )}
      </section>
    </>
  );
}
