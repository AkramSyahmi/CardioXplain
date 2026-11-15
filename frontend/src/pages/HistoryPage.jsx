// UC-600 View My history (Figure 3.32). Read-only.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api.js";
import HistoryTable from "../components/HistoryTable.jsx";
import RiskTrend from "../components/RiskTrend.jsx";
import Skeleton from "../components/Skeleton.jsx";
import "./HistoryPage.css";

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/history").then(setHistory).catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <h1>My history</h1>
      <p className="page-lead">All your previous cardiovascular risk assessments, newest first.</p>
      {error && <p role="alert">{error}</p>}
      {!history && !error && <Skeleton lines={6} />}
      {history && history.predictions.length === 0 && (
        <>
          <p>{history.message}</p>
          <p><Link className="btn btn-primary" to="/assessment">Start risk assessment</Link></p>
        </>
      )}
      {history && history.predictions.length > 0 && (
        <div className="history-layout">
          <div className="card"><HistoryTable predictions={history.predictions} /></div>
          <div className="history-side"><RiskTrend predictions={history.predictions} /></div>
        </div>
      )}
    </>
  );
}
