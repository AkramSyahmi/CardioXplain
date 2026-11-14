// "What's driving your risk": the top SHAP factors that raise the latest result (XAI on the dashboard).
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api.js";
import { displayValue } from "../format.js";
import Icon from "./Icon.jsx";
import "./RiskDrivers.css";

export default function RiskDrivers({ predictionId }) {
  const [shap, setShap] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiRequest(`/history/${predictionId}`).then((data) => setShap(data.shap ?? [])).catch(() => setFailed(true));
  }, [predictionId]);

  const drivers = (shap ?? []).filter((item) => item.shap > 0).sort((a, b) => b.shap - a.shap).slice(0, 3);
  const biggest = drivers[0]?.shap ?? 1;

  return (
    <section className="card drivers" aria-labelledby="drivers-heading">
      <div className="card-head">
        <h2 id="drivers-heading">What's driving your risk</h2>
        <span className="chip">SHAP</span>
      </div>
      {!shap && !failed && <p className="help">Loading...</p>}
      {(failed || (shap && shap.length === 0)) && <p className="help">No explanation was saved for this result.</p>}
      {shap && shap.length > 0 && drivers.length === 0 && (
        <p className="help">None of your answers raised your risk above the average.</p>
      )}
      {drivers.length > 0 && (
        <ol className="driver-list">
          {drivers.map((item) => (
            <li key={item.feature}>
              <span className="driver-name">{item.label}<small>{displayValue(item.feature, item.value)}</small></span>
              <span className="driver-effect">+{(item.shap * 100).toFixed(1)}%</span>
              <span className="driver-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(4, (item.shap / biggest) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
      <Link className="btn btn-light drivers-link" to={`/result/${predictionId}`}>
        See the full explanation<span className="go"><Icon name="arrow" /></span>
      </Link>
    </section>
  );
}
