// Who is logged in (UC-100), and page guards by role.
import { createContext, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { apiRequest, clearToken, getToken, setToken } from "./api.js";
import Layout from "./components/Layout.jsx";

const AuthContext = createContext(null);

export function homeFor(user) {
  return user?.role === "admin" ? "/admin" : "/dashboard";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Restore a saved login when the page is opened or refreshed.
    if (getToken()) {
      apiRequest("/auth/me")
        .then((data) => setUser(data.user))
        // api.js already forgets the token on a 401; any other failure (server down) keeps the login
        .catch((err) => {
          if (err.status !== 401) setNotice(err.message);
        })
        .finally(() => setLoading(false));
    }
    // api.js fires this on any 401 (expired, invalid or deactivated login).
    const onLogout = () => {
      setUser(null);
      setNotice("Please log in again.");
    };
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  async function login(email, password) {
    const data = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    setNotice("");
    return data.user;
  }

  function register(form) {
    return apiRequest("/auth/register", { method: "POST", body: form });
  }

  function logout() {
    clearToken();
    setUser(null);
    setNotice("");
  }

  return (
    <AuthContext.Provider value={{ user, loading, notice, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Shows the page (inside the main layout) only to a logged-in user with the given role. */
export function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <Layout>{children}</Layout>;
}
