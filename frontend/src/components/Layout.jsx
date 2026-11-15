import { Link, NavLink, useNavigate } from "react-router";
import { homeFor, useAuth } from "../auth.jsx";
import logo from "../assets/logo-full.png";
import Icon from "./Icon.jsx";
import "./Layout.css";

const USER_LINKS = [
  ["/dashboard", "Dashboard", "home"],
  ["/assessment", "New assessment", "plus"],
  ["/history", "My history", "list"],
  ["/simulator", "What-If Simulator", "gauge"],
  ["/plan", "Health Action Plan", "calendar"],
  ["/navigator", "Care Navigator", "chat"],
];
const ADMIN_LINKS = [
  ["/admin", "Model performance", "chart"],
  ["/admin/users", "User management", "user"],
];

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

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
      <a className="skip-link" href="#main">Skip to content</a>
      {/* Desktop: sidebar on the left, page on the right. Phones: top bar plus bottom tab bar. */}
      <div className="shell">
      <header className="topbar">
        <Link className="logo" to={homeFor(user)} aria-label="CardioXplain home">
          <img src={logo} alt="" width="211" height="40" />
        </Link>
        <nav className="mainnav" aria-label="Main">
          {links.map(([to, label, icon]) => (
            // end: "/admin" is not also active on "/admin/users".
            // title: a tooltip when the narrow sidebar shows icons only.
            <NavLink key={to} to={to} end title={label}>
              <Icon name={icon} />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <span className="avatar" aria-hidden="true">{initials(user.full_name)}</span>
          <span className="me-text">
            <span className="me-name">{user.full_name}</span>
            <small>{user.role === "admin" ? "Administrator" : "General User"}</small>
          </span>
          <button type="button" className="signout" onClick={signOut} title="Sign out">
            <Icon name="logout" />
            <span className="signout-label">Sign out</span>
          </button>
        </div>
      </header>
      <div className="page">
      <main id="main" tabIndex="-1">{children}</main>
      <footer className="app-footer">
        <p>
          <strong>CardioXplain</strong> · Final Year Project, Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA), 2026
        </p>
        <p>
          For education only. Results are not a medical diagnosis; always consult a qualified healthcare professional.
        </p>
      </footer>
      </div>
      </div>
    </>
  );
}
