import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, ProtectedRoute, homeFor, useAuth } from "./auth.jsx";
import AssessmentPage from "./pages/AssessmentPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NavigatorPage from "./pages/NavigatorPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import PlanPage from "./pages/PlanPage.jsx";
import ResultPage from "./pages/ResultPage.jsx";
import SimulatorPage from "./pages/SimulatorPage.jsx";

// Placeholder for pages built in later tasks (replaced task by task).
function ComingSoon({ title }) {
  return <h1>{title}</h1>;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  return <Navigate to={user ? homeFor(user) : "/login"} replace />;
}

const USER_PAGES = [
  ["/dashboard", <DashboardPage />],
  ["/assessment", <AssessmentPage />],
  ["/result/:id", <ResultPage />],
  ["/simulator", <SimulatorPage />],
  ["/history", <HistoryPage />],
  ["/plan", <PlanPage />],
  ["/navigator", <NavigatorPage />],
];
const ADMIN_PAGES = [
  ["/admin", <ComingSoon title="Model Performance" />],
  ["/admin/users", <ComingSoon title="User Management" />],
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      {USER_PAGES.map(([path, page]) => (
        <Route key={path} path={path} element={<ProtectedRoute role="general_user">{page}</ProtectedRoute>} />
      ))}
      {ADMIN_PAGES.map(([path, page]) => (
        <Route key={path} path={path} element={<ProtectedRoute role="admin">{page}</ProtectedRoute>} />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
