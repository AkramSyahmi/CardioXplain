// UC-600 View Prediction History (Figure 3.32). Read-only.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api.js";
import HistoryTable from "../components/HistoryTable.jsx";

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/history").then(setHistory).catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <h1>Prediction History</h1>
      <p>All your previous cardiovascular risk assessments, newest first.</p>
      {error && <p role="alert">{error}</p>}
      {!history && !error && <p>Loading...</p>}
      {history && history.predictions.length === 0 && (
        <>
          <p>{history.message}</p>
          <p><Link to="/assessment">Start Risk Assessment</Link></p>
        </>
      )}
      {history && history.predictions.length > 0 && <HistoryTable predictions={history.predictions} />}
    </>
  );
}
