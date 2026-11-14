import { Link, NavLink, useNavigate } from "react-router";
import { homeFor, useAuth } from "../auth.jsx";
import logo from "../assets/logo-full.png";
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
      <header className={links.length > 3 ? "topbar" : "topbar topbar-few"}>
        <Link className="logo" to={homeFor(user)} aria-label="CardioXplain home">
          <img src={logo} alt="" width="211" height="40" />
        </Link>
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
