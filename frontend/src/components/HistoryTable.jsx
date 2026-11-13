import { Link } from "react-router";
import { formatDateTime } from "../format.js";
import { categoryClass } from "./RiskGauge.jsx";

/** Past assessments with a View link each (dashboard and history page). Read-only (UC-600). */
export default function HistoryTable({ predictions }) {
  return (
    // Wide tables scroll inside their box on phones, never the whole page.
    <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Risk Score</th>
          <th>Category</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {predictions.map((p) => (
          <tr key={p.prediction_id}>
            <td>{p.prediction_id}</td>
            <td>{formatDateTime(p.prediction_date)}</td>
            <td>{p.risk_percent}%</td>
            <td><span className={`chip ${categoryClass(p.risk_category)}`}>{p.risk_category}</span></td>
            <td>
              <Link to={`/result/${p.prediction_id}`}>View</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
