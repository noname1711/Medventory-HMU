import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthForm from "./components/AuthForm";
import ForgotPassword from "./components/ForgotPassword";
import Dashboard from "./components/Dashboard";
import ResetPassword from "./components/ResetPassword";
import "./App.css";

function getStoredUser() {
  const savedUser = localStorage.getItem("currentUser");
  if (!savedUser) return null;

  try {
    const user = JSON.parse(savedUser);
    return user?.id ? user : null;
  } catch {
    localStorage.removeItem("currentUser");
    return null;
  }
}

function RequireAuth({ children }) {
  const location = useLocation();
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthForm />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
