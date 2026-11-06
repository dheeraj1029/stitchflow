import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { OrdersProvider } from "./state/OrdersProvider.jsx";
import { ProductionUpdatesProvider } from "./state/ProductionUpdatesProvider.jsx";
import { IssuesProvider } from "./features/issues/IssuesProvider.jsx";
import { AuthProvider } from "./features/auth/AuthProvider.jsx";
import { useAuth } from "./features/auth/AuthContext.js";
import "./styles.css";

function AppStateProviders({ children }) {
  const { user } = useAuth();
  if (!user || user.role === "BUYER") {
    return children;
  }
  return (
    <ProductionUpdatesProvider>
      <OrdersProvider>
        <IssuesProvider>{children}</IssuesProvider>
      </OrdersProvider>
    </ProductionUpdatesProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppStateProviders>
          <App />
        </AppStateProviders>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
