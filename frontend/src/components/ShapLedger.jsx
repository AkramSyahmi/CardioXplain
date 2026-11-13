// SHAP waterfall (UC-300): everyone starts at the average risk, each factor pushes up or down,
// and the pushes add up to the user's risk. SHAP values are in probability terms, so they sum exactly.
import { displayValue } from "../format.js";
import Icon from "./Icon.jsx";
import "./ShapLedger.css";

const ICONS = {
  ap_hi: "drop", ap_lo: "drop", cholesterol: "drop", age: "clock", active: "run", bmi: "scale",
  weight: "scale", height: "scale", gluc: "sugar", smoke: "smoke", alco: "dots", gender: "user",
};

const round2 = (x) => Math.round(x * 100) / 100;
const percent = (x) => Math.round(x * 100);

/** Running sums from the baseline, plus a zoomed scale (padded 3 points, rounded out to 5). */
export function ledgerRows(shap, riskScore) {
  const baseline = riskScore - shap.reduce((sum, item) => sum + item.shap, 0);
  let at = baseline;
  const rows = shap.map((item) => {
    const from = at;
    at += item.shap;
    return { ...item, from, to: at };
  });
  const points = [baseline, ...rows.map((row) => row.to)];
  const lo = Math.max(0, round2(Math.floor((Math.min(...points) - 0.03) / 0.05) * 0.05));
  const hi = Math.min(1, round2(Math.ceil((Math.max(...points) + 0.03) / 0.05) * 0.05));
  return { baseline, rows, scale: { lo, hi } };
}

function effectText(shap) {
  const points = Math.abs(shap * 100).toFixed(1);
  if (points === "0.0") return "0.0%";
  return shap < 0 ? `−${points}%` : `+${points}%`;
}

/** Axis labels on round numbers: every 5 points on a narrow scale, every 10 on a wide one. */
function axisTicks({ lo, hi }) {
  const step = hi - lo > 0.25 ? 0.1 : 0.05;
  const ticks = [];
  for (let x = Math.ceil(lo / step - 1e-9) * step; x <= hi + 1e-9; x += step) ticks.push(round2(x));
  return ticks;
}

// riskPercent: the backend's whole percent (rounded down), so the total always matches the gauge.
export default function ShapLedger({ shap, riskScore, riskPercent = percent(riskScore), estimated = [] }) {
  const { baseline, rows, scale } = ledgerRows(shap, riskScore);
  const pos = (x) => ((x - scale.lo) / (scale.hi - scale.lo)) * 100;
  const axis = axisTicks(scale);
  const average = <span className="ledger-avg" style={{ left: `${pos(baseline)}%` }} />;

  return (
    <div className="ledger">
      <p className="ledger-intro">
        Everyone starts at the average risk in the data ({percent(baseline)}%). Each factor pushed you up or down
        from there, and the pushes add up to your {riskPercent}%.
      </p>
      <ol className="ledger-rows">
        {rows.map((row) => {
          const up = row.shap >= 0;
          const word = effectText(row.shap) === "0.0%" ? "No effect" : up ? "Raises risk" : "Lowers risk";
          return (
            <li key={row.feature} className="ledger-row">
              <span className="ledger-icon"><Icon name={ICONS[row.feature] ?? "dots"} /></span>
              <span className="ledger-name">
                {row.label}
                <small>
                  {displayValue(row.feature, row.value)}
                  {estimated.includes(row.feature) && " (estimated)"}
                </small>
              </span>
              <span className="ledger-bar" aria-hidden="true">
                {average}
                <span className={`ledger-seg ${up ? "up" : "down"}`} style={{
                  left: `${pos(Math.min(row.from, row.to))}%`,
                  width: `max(2px, ${(Math.abs(row.shap) / (scale.hi - scale.lo)) * 100}%)`,
                }} />
              </span>
              <span className={`ledger-effect ${up ? "up" : "down"}`}>
                {effectText(row.shap)}
                <span className="visually-hidden">{word}</span>
              </span>
            </li>
          );
        })}
        <li className="ledger-row ledger-total">
          <span className="ledger-icon"><Icon name="heart" /></span>
          <span className="ledger-name">Your estimate<small>average + all pushes</small></span>
          <span className="ledger-bar" aria-hidden="true">
            {average}
            <span className="ledger-you" style={{ left: `${pos(riskScore)}%` }} />
          </span>
          <span className="ledger-effect">{riskPercent}%</span>
        </li>
      </ol>
      <div className="ledger-axis" aria-hidden="true">
        <span className="ledger-axis-track">
          {axis.map((x) => <span key={x} style={{ left: `${pos(x)}%` }}>{percent(x)}%</span>)}
        </span>
      </div>
      <p className="ledger-legend" aria-hidden="true">
        <span><i className="up" />Raises your risk</span>
        <span><i className="down" />Lowers your risk</span>
        <span><i className="avg" />Average person</span>
      </p>
    </div>
  );
}
