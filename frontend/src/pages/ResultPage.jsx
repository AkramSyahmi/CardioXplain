// UC-200 result page. Uses the result passed from the form, or loads it again after a refresh.
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { apiRequest } from "../api.js";
import PageHeader from "../components/PageHeader.jsx";
import ResultView from "../components/ResultView.jsx";
import { categoryClass } from "../components/RiskGauge.jsx";
import { formatDateTime } from "../format.js";
import Skeleton from "../components/Skeleton.jsx";

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
      <PageHeader icon="heart" title="Assessment result"
        lead={<><Link to="/history">My history</Link> › Assessment #{id}
          {result?.prediction_date && <> · {formatDateTime(result.prediction_date)}</>}</>}>
        {result && (
          <span className={`chip ${categoryClass(result.risk_category)}`}>{result.risk_category} risk · {result.risk_percent}%</span>
        )}
      </PageHeader>
      {error && <p role="alert">{error}</p>}
      {!result && !error && <Skeleton cards={2} lines={5} />}
      {result && <ResultView result={result} />}
    </>
  );
}
