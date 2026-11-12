// UC-200 result page. Uses the result passed from the form, or loads it again after a refresh.
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import { apiRequest } from "../api.js";
import ResultView from "../components/ResultView.jsx";
import { formatDateTime } from "../format.js";

export default function ResultPage() {
  const { id } = useParams();
  const passed = useLocation().state?.result;
  const [result, setResult] = useState(passed?.prediction_id === Number(id) ? passed : null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (result) return;
    apiRequest(`/history/${id}`).then(setResult).catch((err) => setError(err.message));
  }, [id, result]);

  return (
    <>
      <h1>Risk Assessment Results</h1>
      {result?.prediction_date && <p>Assessment #{result.prediction_id} - {formatDateTime(result.prediction_date)}</p>}
      {error && <p role="alert">{error}</p>}
      {!result && !error && <p>Loading...</p>}
      {result && <ResultView result={result} />}
    </>
  );
}
