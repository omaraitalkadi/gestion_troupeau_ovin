import { Navigate, Outlet } from "react-router-dom";

// Replace with your real auth/role hook
const useRole = () => "eleveur"; // or "admin"

export default function RequireAdmin() {
  const role = useRole();
  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
