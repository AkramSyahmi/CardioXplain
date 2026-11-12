import { Link } from "react-router";
import { formatDateTime } from "../format.js";

/** Past assessments with a View link each (dashboard and history page). Read-only (UC-600). */
export default function HistoryTable({ predictions }) {
  return (
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
            <td>{p.risk_category}</td>
            <td>
              <Link to={`/result/${p.prediction_id}`}>View</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
