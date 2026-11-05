import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

const pageTitles = {
  "/overview": "Overview",
  "/orders": "Orders",
  "/production-updates": "Production Updates",
  "/delay-warnings": "Delay Warnings",
  "/buyers": "Buyers",
  "/settings": "Settings",
};

export default function AppLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const location = useLocation();
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

  const currentPage = pageTitles[location.pathname] ?? "Overview";
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
