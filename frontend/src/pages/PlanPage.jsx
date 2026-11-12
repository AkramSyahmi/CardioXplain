// UC-1000 View Personalised Health Action Plan (Figure 3.31), as a day-by-day calendar (CHANGES.md #25).
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { Link, useLocation } from "react-router";
import { apiRequest } from "../api.js";
import PlanCalendar from "../components/PlanCalendar.jsx";
import { formatDateTime } from "../format.js";

const NO_PLAN_YET = "No health action plan yet.";
const WAIT = "(this can take up to 45 seconds)";

function daysPlanned(calendar) {
  return calendar.weeks.reduce((total, week) => total + week.days.length, 0);
}

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
  const [length, setLength] = useState(7);
  const [busy, setBusy] = useState("");

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

  async function request(path, body, waitingText) {
    if (busy) return;
    setBusy(waitingText);
    setError("");
    setRiskCategory("");
    try {
      const data = await apiRequest(path, { method: "POST", body });
      setPlan(data.plan);
      setDisclaimer(data.disclaimer);
      setNotice("");
    } catch (err) {
      setError(err.message);
      if (err.status === 503 && err.data?.risk_category) setRiskCategory(err.data.risk_category);
    } finally {
      setBusy("");
    }
  }

  function generate() {
    request("/action-plan", lifestyle ? { length, lifestyle } : { length }, `Generating your plan... ${WAIT}`);
  }

  const calendar = plan?.calendar;
  const planned = calendar ? daysPlanned(calendar) : 0;
  const nextWeek = calendar && calendar.length === 30 && planned < 30 ? calendar.weeks.length + 1 : null;

  return (
    <>
      <h1>Health Action Plan</h1>
      <p>A day-by-day plan based on your risk result and lifestyle. For educational support only.</p>

      {!loaded && <p>Loading...</p>}
      {noAssessment && (
        <>
          <p role="alert">{noAssessment}</p>
          <p><Link to="/assessment">Start Risk Assessment</Link></p>
        </>
      )}

      {loaded && !noAssessment && (
        <section aria-label="Create a plan">
          {lifestyle && <p>Using your What-If values.</p>}
          {notice && <p>{notice}</p>}
          <fieldset>
            <legend>Plan length</legend>
            <label>
              <input type="radio" name="length" checked={length === 7} onChange={() => setLength(7)} /> 7-day plan
            </label>{" "}
            <label>
              <input type="radio" name="length" checked={length === 30} onChange={() => setLength(30)} /> 30-day plan
              (built one week at a time)
            </label>
          </fieldset>
          <p>
            <button type="button" onClick={generate} disabled={Boolean(busy)}>
              {busy.startsWith("Generating your plan") ? busy : plan ? "Generate a new plan" : "Generate my plan"}
            </button>
          </p>
          {error && <p role="alert">{error}</p>}
          {riskCategory && <p>Your risk category: {riskCategory}</p>}
        </section>
      )}

      {plan && (
        <article>
          <p>Generated: {formatDateTime(plan.generated_at)}</p>
          {calendar ? (
            <>
              <p>Day {planned} of {calendar.length} planned.</p>
              {/* key: a new plan starts fresh instead of keeping the old plan's ticks */}
              <PlanCalendar key={plan.generated_at} plan={plan} />
              {nextWeek && (
                <p>
                  <button type="button" disabled={Boolean(busy)}
                    onClick={() => request("/action-plan/next-week", {}, `Generating Week ${nextWeek}... ${WAIT}`)}>
                    {busy.startsWith("Generating Week") ? busy : `Generate Week ${nextWeek}`}
                  </button>
                </p>
              )}
            </>
          ) : (
            // Older plans were saved as text; show them as Markdown (raw HTML is not rendered).
            <Markdown>{plan.plan_text}</Markdown>
          )}
          <p><em>{disclaimer}</em></p>
        </article>
      )}
    </>
  );
}
