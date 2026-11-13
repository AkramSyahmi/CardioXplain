import { Link } from "react-router";
import heart from "../assets/heart-3d.png";
import "./AdminPages.css";

export default function NotFoundPage() {
  return (
    <main className="not-found">
      <div className="card">
        <img src={heart} alt="" width="140" height="140" />
        <h1>Page not found</h1>
        <p>
          <Link className="btn btn-primary" to="/">Go to the home page</Link>
        </p>
      </div>
    </main>
  );
}
