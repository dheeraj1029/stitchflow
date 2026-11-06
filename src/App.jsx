import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import OrderForm from "./components/OrderForm.jsx";
import {
  BuyersPage,
  DelayWarningsPage,
  OverviewPage,
  ProductionUpdatesPage,
  SettingsPage,
} from "./pages/WorkspacePages.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import OrderDetailsPage from "./pages/OrderDetailsPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/new" element={<OrderForm />} />
        <Route path="orders/:poNumber/edit" element={<OrderForm />} />
        <Route path="orders/:poNumber" element={<OrderDetailsPage />} />
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
