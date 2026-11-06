import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { useOrders } from "../state/OrdersContext.js";

const pageTitles = {
  "/overview": "Overview",
  "/orders": "Orders",
  "/orders/new": "Create Order",
  "/production-updates": "Production Updates",
  "/production-updates/new": "Submit Production Update",
  "/issues": "Production Issues",
  "/issues/new": "Report Production Issue",
  "/delay-warnings": "Delay Warnings",
  "/buyers": "Buyers",
  "/settings": "Settings",
};

export default function AppLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const location = useLocation();
  const { storageError } = useOrders();
  const closeMobileMenu = useCallback(() => {
    setIsMobileOpen(false);
    if (window.matchMedia("(max-width: 767px)").matches) {
      menuButtonRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeMobileMenu, isMobileOpen]);

  const currentPage =
    pageTitles[location.pathname] ??
    (location.pathname.endsWith("/edit")
      ? "Edit Order"
      : location.pathname.startsWith("/orders/")
        ? "Order Details"
        : location.pathname.startsWith("/production-updates/")
          ? "Production Update Details"
        : "Overview");
  return (
    <div className="app-shell">
      <Sidebar
        isMobileOpen={isMobileOpen}
        onNavigate={closeMobileMenu}
      />
      {isMobileOpen && (
        <button
          aria-label="Close navigation menu"
          className="drawer-backdrop"
          onClick={closeMobileMenu}
          type="button"
        />
      )}
      <div className="main-column">
        <Topbar
          currentPage={currentPage}
          isMobileOpen={isMobileOpen}
          menuButtonRef={menuButtonRef}
          onMenuClick={() => setIsMobileOpen((isOpen) => !isOpen)}
        />
        <main className="main-content" id="main-content">
          {storageError && (
            <p className="storage-warning" role="alert">
              {storageError}
            </p>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
