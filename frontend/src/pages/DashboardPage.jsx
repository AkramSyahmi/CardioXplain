// User dashboard (Figure 3.27).
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api.js";
import { useAuth } from "../auth.jsx";
import HistoryTable from "../components/HistoryTable.jsx";
import { formatDate } from "../format.js";

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
      <h1>Dashboard</h1>
      <p>Welcome back, {user.full_name.split(" ")[0]}! Your cardiovascular health overview.</p>
      <p>
        <Link to="/assessment">+ New Assessment</Link>
      </p>

      {error && <p role="alert">{error}</p>}
      {!history && !error && <p>Loading...</p>}

      {history && (
        <ul aria-label="Summary">
          <li>Total Assessments: {predictions.length}</li>
          <li>Latest Risk Score: {latest ? `${latest.risk_percent}%` : "-"}</li>
          <li>Risk Category: {latest ? latest.risk_category : "-"}</li>
          <li>Last Assessment: {latest ? formatDate(latest.prediction_date) : "-"}</li>
        </ul>
      )}

      <h2>Recent Assessments</h2>
      {history && predictions.length === 0 && <p>{history.message}</p>}
      {predictions.length > 0 && (
        <>
          <HistoryTable predictions={predictions.slice(0, 5)} />
          <p>
            <Link to="/history">View all</Link>
          </p>
        </>
      )}

      <h2>Quick Actions</h2>
      <ul>
        <li><Link to="/assessment">Start Risk Assessment</Link></li>
        <li><Link to="/simulator">What-If Simulator</Link></li>
        <li><Link to="/plan">Health Action Plan</Link></li>
        <li><Link to="/navigator">Care Navigator</Link></li>
      </ul>

      <h2>Educational Notice</h2>
      <p>
        CardioXplain provides AI-driven risk awareness for educational purposes. Results are not a
        medical diagnosis. Always consult a qualified healthcare professional for medical advice.
      </p>
    </>
  );
}
