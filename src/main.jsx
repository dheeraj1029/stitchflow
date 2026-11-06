import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { OrdersProvider } from "./state/OrdersProvider.jsx";
import { ProductionUpdatesProvider } from "./state/ProductionUpdatesProvider.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProductionUpdatesProvider>
        <OrdersProvider>
          <App />
        </OrdersProvider>
      </ProductionUpdatesProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
