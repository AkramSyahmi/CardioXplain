// "Your risk over time" (the monitoring part of CardioXplain): every assessment's risk on Low / Moderate / High bands.
import { formatDate } from "../format.js";
import "./RiskTrend.css";

const W = 640, H = 240, PAD_X = 36, PAD_TOP = 16, PAD_BOTTOM = 28;
const y = (percent) => PAD_TOP + (1 - percent / 100) * (H - PAD_TOP - PAD_BOTTOM);
const BANDS = [["band-high", 70, 100, "High"], ["band-mod", 40, 70, "Moderate"], ["band-low", 0, 40, "Low"]];

function changeText(first, last) {
  const points = last - first;
  if (points === 0) return "No change since your first assessment";
  return `${points > 0 ? "Up" : "Down"} ${Math.abs(points)} points since your first assessment`;
}

export default function RiskTrend({ predictions }) {
  const points = [...predictions].reverse(); // oldest first
  const step = points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : 0;
  const x = (i) => (points.length > 1 ? PAD_X + i * step : W / 2);
  const label = `Risk over time: ${points.map((p) => `${p.risk_percent}% on ${formatDate(p.prediction_date)}`).join(", ")}`;
  const first = points[0]?.risk_percent;
  const last = points.at(-1)?.risk_percent;
  const trend = last > first ? "trend-up" : last < first ? "trend-down" : "";

  return (
    <section className="card trend" aria-labelledby="trend-heading">
      <div className="card-head">
        <h2 id="trend-heading">Your risk over time</h2>
        {points.length > 1 && <span className={`chip ${trend}`}>{changeText(first, last)}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="trend-chart">
        {BANDS.map(([cls, lo, hi, name]) => (
          <g key={cls}>
            <rect className={cls} x={PAD_X - 16} width={W - PAD_X * 2 + 32} y={y(hi)} height={y(lo) - y(hi)} rx="10" />
            <text className="band-label" x={W - PAD_X + 10} y={y(hi) + 16} textAnchor="end">{name}</text>
          </g>
        ))}
        {points.length > 1 && (
          <polyline className="trend-line" points={points.map((p, i) => `${x(i)},${y(p.risk_percent)}`).join(" ")} />
        )}
        {points.map((p, i) => (
          <g key={p.prediction_id}>
            <circle className="trend-dot" cx={x(i)} cy={y(p.risk_percent)} r={i === points.length - 1 ? 7 : 5} />
            <text className="trend-value" x={x(i)} y={y(p.risk_percent) - 14} textAnchor="middle">{p.risk_percent}%</text>
          </g>
        ))}
        {points.map((p, i) => (
          // Date labels only for the first and last point, so they never overlap.
          (i === 0 || i === points.length - 1) && (
            <text key={`d${p.prediction_id}`} className="trend-date" x={x(i)} y={H - 6}
              textAnchor={points.length === 1 ? "middle" : i === 0 ? "start" : "end"}>
              {formatDate(p.prediction_date)}
            </text>
          )
        ))}
      </svg>
      {points.length === 1 && <p className="help">Do another assessment later to see your trend.</p>}
    </section>
  );
}
