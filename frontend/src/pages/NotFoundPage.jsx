import { Link } from "react-router";
import Icon from "../components/Icon.jsx";
import "./AdminPages.css";

export default function NotFoundPage() {
  return (
    <main className="not-found">
      <div className="card">
        <span className="not-found-icon" aria-hidden="true"><Icon name="heart" size={40} /></span>
        <h1>Page not found</h1>
        <p>
          <Link className="btn btn-primary" to="/">Go to the home page</Link>
        </p>
      </div>
    </main>
  );
}
