// UC-1000 View Personalised Health Action Plan (Figure 3.31).
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { Link, useLocation } from "react-router";
import { apiRequest } from "../api.js";
import { formatDateTime } from "../format.js";

const NO_PLAN_YET = "No health action plan yet.";

export default function PlanPage() {
  // A1: values sent from the What-If simulator replace the assessment values.
  const lifestyle = useLocation().state?.lifestyle;
  const [plan, setPlan] = useState(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [noAssessment, setNoAssessment] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [riskCategory, setRiskCategory] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest("/action-plan")
      .then((data) => {
        setPlan(data.plan);
        setDisclaimer(data.disclaimer);
      })
      .catch((err) => {
        if (err.message === NO_PLAN_YET) setNotice(err.message);
        else if (err.status === 404) setNoAssessment(err.message);
        else setError(err.message);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError("");
    setRiskCategory("");
    try {
      const data = await apiRequest("/action-plan", { method: "POST", body: lifestyle ? { lifestyle } : {} });
      setPlan(data.plan);
      setDisclaimer(data.disclaimer);
      setNotice("");
    } catch (err) {
      setError(err.message);
      if (err.status === 503 && err.data?.risk_category) setRiskCategory(err.data.risk_category);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Health Action Plan</h1>
      <p>A personalised plan based on your risk result and lifestyle. For educational support only.</p>

      {!loaded && <p>Loading...</p>}
      {noAssessment && (
        <>
          <p role="alert">{noAssessment}</p>
          <p><Link to="/assessment">Start Risk Assessment</Link></p>
        </>
      )}

      {loaded && !noAssessment && (
        <>
          {lifestyle && <p>Using your What-If values.</p>}
          {notice && <p>{notice}</p>}
          {error && <p role="alert">{error}</p>}
          {riskCategory && <p>Your risk category: {riskCategory}</p>}
          <p>
            <button type="button" onClick={generate} disabled={busy}>
              {busy ? "Generating your plan... (this can take up to 10 seconds)"
                : plan ? "Generate a new plan" : "Generate my plan"}
            </button>
          </p>
        </>
      )}

      {plan && (
        <article>
          <p>Generated: {formatDateTime(plan.generated_at)}</p>
          {/* LLM text shown as Markdown; raw HTML in it is not rendered. */}
          <Markdown>{plan.plan_text}</Markdown>
          <p><em>{disclaimer}</em></p>
        </article>
      )}
    </>
  );
}
