import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import OrderForm from "./components/OrderForm.jsx";
import {
  BuyersPage,
  DelayWarningsPage,
  OverviewPage,
  SettingsPage,
} from "./pages/WorkspacePages.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import OrderDetailsPage from "./pages/OrderDetailsPage.jsx";
import ProductionUpdateForm from "./components/ProductionUpdateForm.jsx";
import ProductionUpdateDetailsPage from "./pages/ProductionUpdateDetailsPage.jsx";
import ProductionUpdatesPage from "./pages/ProductionUpdatesPage.jsx";
import IssueReportPage from "./features/issues/IssueReportPage.jsx";
import IssueManagementPage from "./features/issues/IssueManagementPage.jsx";
import SupervisorIssueStatusPage from "./features/issues/SupervisorIssueStatusPage.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import ProtectedRoute from "./features/auth/ProtectedRoute.jsx";
import RoleRoute from "./features/auth/RoleRoute.jsx";
import { useAuth } from "./features/auth/AuthContext.js";
import { getRoleHome } from "./features/auth/permissions.js";
import BuyerPortalLayout from "./features/buyer/BuyerPortalLayout.jsx";
import BuyerDashboard from "./features/buyer/BuyerDashboard.jsx";
import BuyerOrdersPage from "./features/buyer/BuyerOrdersPage.jsx";
import BuyerOrderDetailsPage from "./features/buyer/BuyerOrderDetailsPage.jsx";
import UserManagementPage from "./features/admin/UserManagementPage.jsx";

function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={getRoleHome(user?.role)} replace />;
}

function RolePage({ roles, children }) {
  return <RoleRoute roles={roles}>{children}</RoleRoute>;
}

function IssuesPageRoute() {
  const { user } = useAuth();
  return user?.role === "SUPERVISOR" ? (
    <SupervisorIssueStatusPage />
  ) : (
    <RolePage roles={["ADMIN", "MERCHANDISER"]}>
      <IssueManagementPage />
    </RolePage>
  );
}

const internalRoles = ["ADMIN", "MERCHANDISER", "SUPERVISOR"];

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <RoleHomeRedirect /> : <LoginPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route path="buyer" element={<RoleRoute roles={["BUYER"]} />}>
          <Route element={<BuyerPortalLayout />}>
            <Route index element={<BuyerDashboard />} />
            <Route path="orders" element={<BuyerOrdersPage />} />
            <Route path="orders/:orderId" element={<BuyerOrderDetailsPage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute roles={internalRoles} />}>
          <Route element={<AppLayout />}>
            <Route index element={<RoleHomeRedirect />} />
            <Route path="overview" element={<RolePage roles={["ADMIN", "MERCHANDISER"]}><OverviewPage /></RolePage>} />
            <Route path="orders" element={<RolePage roles={["ADMIN", "MERCHANDISER", "SUPERVISOR"]}><OrdersPage /></RolePage>} />
            <Route path="orders/new" element={<RolePage roles={["MERCHANDISER"]}><OrderForm /></RolePage>} />
            <Route path="orders/:poNumber/edit" element={<RolePage roles={["MERCHANDISER"]}><OrderForm /></RolePage>} />
            <Route path="orders/:poNumber" element={<RolePage roles={["ADMIN", "MERCHANDISER", "SUPERVISOR"]}><OrderDetailsPage /></RolePage>} />
            <Route path="production-updates" element={<RolePage roles={["MERCHANDISER", "SUPERVISOR"]}><ProductionUpdatesPage /></RolePage>} />
            <Route path="production-updates/new" element={<RolePage roles={["SUPERVISOR"]}><ProductionUpdateForm /></RolePage>} />
            <Route path="production-updates/:updateId/edit" element={<RolePage roles={["SUPERVISOR"]}><ProductionUpdateForm /></RolePage>} />
            <Route path="production-updates/:updateId" element={<RolePage roles={["MERCHANDISER", "SUPERVISOR"]}><ProductionUpdateDetailsPage /></RolePage>} />
            <Route path="issues" element={<IssuesPageRoute />} />
            <Route path="issues/new" element={<RolePage roles={["SUPERVISOR"]}><IssueReportPage /></RolePage>} />
            <Route path="delay-warnings" element={<RolePage roles={["MERCHANDISER"]}><DelayWarningsPage /></RolePage>} />
            <Route path="buyers" element={<RolePage roles={["ADMIN", "MERCHANDISER"]}><BuyersPage /></RolePage>} />
            <Route path="settings" element={<RolePage roles={["ADMIN"]}><SettingsPage /></RolePage>} />
            <Route path="admin/users" element={<RolePage roles={["ADMIN"]}><UserManagementPage /></RolePage>} />
            <Route path="*" element={<RoleHomeRedirect />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
