import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext.js";
import { apiRequest } from "../auth/authApi.js";
import { BuyerPortalContext } from "./BuyerPortalContext.js";

export default function BuyerPortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBuyerData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [orderResult, issueResult] = await Promise.all([
        apiRequest("/api/orders"),
        apiRequest("/api/issues"),
      ]);
      if (!Array.isArray(orderResult.orders) || !Array.isArray(issueResult.issues)) {
        throw new Error("The buyer portal returned invalid data.");
      }
      setOrders(orderResult.orders);
      setIssues(issueResult.issues);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Buyer data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBuyerData();
  }, [loadBuyerData]);

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="buyer-shell">
      <header className="buyer-topbar">
        <Link aria-label="StitchFlow buyer portal home" className="buyer-brand" to="/buyer">
          <span aria-hidden="true" className="buyer-brand__mark">S</span>
          <span>
            <strong>StitchFlow</strong>
            <small>Buyer Portal</small>
          </span>
        </Link>
        <nav aria-label="Buyer navigation" className="buyer-navigation">
          <NavLink end to="/buyer">Dashboard</NavLink>
          <NavLink to="/buyer/orders">My orders</NavLink>
        </nav>
        <div className="buyer-account">
          <span className="buyer-account__organization">{user?.buyerOrganizationName}</span>
          <span className="buyer-account__name">{user?.name}</span>
          <button aria-label="Sign out" onClick={signOut} type="button">
            <LogOut aria-hidden="true" size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </header>
      <main className="buyer-content">
        {loading ? (
          <p aria-live="polite" className="buyer-load-state">Loading your orders…</p>
        ) : error ? (
          <section className="buyer-error-state" role="alert">
            <h1>Buyer portal unavailable</h1>
            <p>{error}</p>
            <button onClick={loadBuyerData} type="button">Try again</button>
          </section>
        ) : (
          <BuyerPortalContext.Provider value={{ orders, issues, reload: loadBuyerData }}>
            <Outlet />
          </BuyerPortalContext.Provider>
        )}
      </main>
      <footer className="buyer-footer">
        Buyer access is restricted to your organization. Order and confirmed
        issue data is loaded from the persistent StitchFlow database.
      </footer>
    </div>
  );
}
