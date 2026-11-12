import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth.jsx";

const USER_LINKS = [
  ["/dashboard", "Dashboard"],
  ["/assessment", "New Assessment"],
  ["/history", "My History"],
  ["/simulator", "What-If Simulator"],
  ["/plan", "Health Action Plan"],
  ["/navigator", "Care Navigator"],
];
const ADMIN_LINKS = [
  ["/admin", "Model Performance"],
  ["/admin/users", "User Management"],
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user.role === "admin" ? ADMIN_LINKS : USER_LINKS;

  function signOut() {
    logout();
    navigate("/login");
  }

  return (
    <>
      <header>
        <p>
          <strong>CardioXplain</strong> - CVD Risk Assessment
        </p>
        <nav>
          <ul>
            {links.map(([to, label]) => (
              <li key={to}>
                <Link to={to}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <p>
          {user.full_name} ({user.role === "admin" ? "Administrator" : "General User"}){" "}
          <button type="button" onClick={signOut}>Sign Out</button>
        </p>
        <hr />
      </header>
      <main>{children}</main>
    </>
  );
}
