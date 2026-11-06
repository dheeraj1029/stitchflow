import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext.js";
import { getRoleHome } from "./permissions.js";

export default function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }
  return children || <Outlet />;
}
