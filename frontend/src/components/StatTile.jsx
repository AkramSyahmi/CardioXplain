import "./StatTile.css";

/** A stat tile: screen readers get one plain sentence, sighted users a small label and a big value. */
export default function StatTile({ label, value, children, tone = "" }) {
  return (
    <li className={`stat ${tone}`}>
      <span className="visually-hidden">{label}: {value}</span>
      <span className="stat-label" aria-hidden="true">{label}</span>
      <span className="stat-value" aria-hidden="true">{children ?? value}</span>
    </li>
  );
}
