// Half-circle tick gauge for the risk score. The category always comes from the backend and is shown in words.
import "./RiskGauge.css";

const TICKS = 51;
const STOPS = [[0, [47, 174, 107]], [0.4, [230, 163, 30]], [0.7, [240, 100, 60]], [1, [229, 72, 77]]];
const CHIP = { Low: "chip-low", Moderate: "chip-mod", High: "chip-high" };

export function categoryClass(category) {
  return CHIP[category] ?? "";
}

/** Colour at t (0-1) between the green, amber, orange and red stops. */
function tickColour(t) {
  for (let i = 1; i < STOPS.length; i++) {
    const [a, from] = STOPS[i - 1];
    const [b, to] = STOPS[i];
    if (t <= b) {
      const k = (t - a) / (b - a);
      return `rgb(${from.map((c, j) => Math.round(c + (to[j] - c) * k)).join(",")})`;
    }
  }
  return "rgb(229,72,77)";
}

export default function RiskGauge({ percent, category, size = "large" }) {
  const value = percent / 100;
  const cx = 200, cy = 210, inner = 150, outer = 190;
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const t = i / (TICKS - 1);
    const angle = Math.PI * (1 - t);
    const long = i % 10 === 0;
    const r1 = long ? inner - 10 : inner;
    const on = t <= value + 1e-9;
    return (
      <line key={i} data-on={on} x1={cx + r1 * Math.cos(angle)} y1={cy - r1 * Math.sin(angle)}
        x2={cx + outer * Math.cos(angle)} y2={cy - outer * Math.sin(angle)} stroke={tickColour(t)}
        strokeWidth={long ? 6 : 5} strokeLinecap="round" opacity={on ? 1 : 0.18} />
    );
  });
  const needle = Math.PI * (1 - Math.min(Math.max(value, 0), 1));

  return (
    <figure className={`gauge gauge-${size}`}>
      <div className="gauge-dial">
        <svg viewBox="0 0 400 230" role="img" aria-label={`Risk gauge: ${percent} percent, ${category} risk`}>
          {ticks}
          <circle cx={cx + (inner - 26) * Math.cos(needle)} cy={cy - (inner - 26) * Math.sin(needle)} r="7"
            fill="currentColor" />
        </svg>
        <p className="gauge-read" aria-hidden="true">{percent}<span className="unit">%</span></p>
      </div>
      <figcaption>
        <span className="gauge-scale" aria-hidden="true">Low under 40 · Moderate · High 70+</span>
        <span className={`chip ${categoryClass(category)}`}>{category} risk</span>
      </figcaption>
    </figure>
  );
}
