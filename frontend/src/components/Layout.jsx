import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../auth.jsx";
import Icon from "./Icon.jsx";
import "./Layout.css";

const USER_LINKS = [
  ["/dashboard", "Dashboard", "home"],
  ["/assessment", "New Assessment", "plus"],
  ["/history", "My History", "list"],
  ["/simulator", "What-If Simulator", "gauge"],
  ["/plan", "Health Action Plan", "calendar"],
  ["/navigator", "Care Navigator", "chat"],
];
const ADMIN_LINKS = [
  ["/admin", "Model Performance", "chart"],
  ["/admin/users", "User Management", "user"],
];

export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path d="M12 20.5 4.3 13a4.6 4.6 0 0 1 6.5-6.5L12 7.7l1.2-1.2a4.6 4.6 0 0 1 6.5 6.5Z" fill="#f0643c" />
        <path d="M5.5 13h3.2l1.4-2.6 2.2 4.8 1.3-2.2h4.6" fill="none" stroke="#fff" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

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
      <header className="topbar">
        <p className="logo">
          <LogoMark />
          <strong>CardioXplain</strong>
        </p>
        <nav className="mainnav" aria-label="Main">
          {links.map(([to, label, icon]) => (
            // end: "/admin" is not also active on "/admin/users".
            <NavLink key={to} to={to} end>
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
          <button type="button" className="signout" onClick={signOut}>
            <Icon name="logout" />
            Sign Out
          </button>
        </div>
      </header>
      <main id="main" tabIndex="-1">{children}</main>
    </>
  );
}
