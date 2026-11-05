import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import {
  BuyersPage,
  DelayWarningsPage,
  OrdersPage,
  OverviewPage,
  ProductionUpdatesPage,
  SettingsPage,
} from "./pages/WorkspacePages.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route
          path="production-updates"
          element={<ProductionUpdatesPage />}
        />
        <Route path="delay-warnings" element={<DelayWarningsPage />} />
        <Route path="buyers" element={<BuyersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}
