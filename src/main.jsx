import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { OrdersProvider } from "./state/OrdersProvider.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <OrdersProvider>
        <App />
      </OrdersProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
