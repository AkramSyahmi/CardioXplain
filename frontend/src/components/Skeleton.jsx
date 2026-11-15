// Grey placeholder shapes while data loads, so the page does not jump when it arrives.
import "./Skeleton.css";

const range = (n) => Array.from({ length: n }, (_, i) => i);

function Lines({ count }) {
  return range(count).map((i) => <span key={i} className="sk sk-line" />);
}

export default function Skeleton({ tiles = 0, cards = 1, lines = 3 }) {
  return (
    <div className="skeleton" role="status">
      <span className="visually-hidden">Loading...</span>
      {tiles > 0 && (
        <div className="stats sk-tiles" aria-hidden="true">
          {range(tiles).map((i) => <span key={i} className="sk sk-tile" />)}
        </div>
      )}
      {cards === 0 ? lines > 0 && (
        <div className="sk-bare" aria-hidden="true"><Lines count={lines} /></div>
      ) : range(cards).map((i) => (
        <div key={i} className="card sk-card" aria-hidden="true">
          <span className="sk sk-title" />
          <Lines count={lines} />
        </div>
      ))}
    </div>
  );
}
