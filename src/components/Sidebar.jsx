import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageSquareWarning,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.js";
import { getNavigationForRole, getRoleHome } from "../features/auth/permissions.js";
import NavigationItem from "./NavigationItem.jsx";

const icons = {
  overview: LayoutDashboard,
  orders: ClipboardList,
  updates: Activity,
  issues: MessageSquareWarning,
  warnings: TriangleAlert,
  buyers: UsersRound,
  users: UsersRound,
};

export default function Sidebar({ isMobileOpen, onNavigate, onLogout }) {
  const { user } = useAuth();
  const navigationItems = getNavigationForRole(user?.role);
  return (
    <aside
      aria-label="Primary sidebar"
      className={`sidebar${isMobileOpen ? " sidebar--mobile-open" : ""}`}
    >
      <Link
        aria-label="StitchFlow overview"
        className="sidebar__brand"
        onClick={onNavigate}
        to={getRoleHome(user?.role)}
      >
        <span aria-hidden="true" className="brand-mark">
          <span />
          <span />
          <span />
        </span>
        <span className="sidebar__brand-copy">
          <span className="sidebar__brand-name">StitchFlow</span>
          <span className="sidebar__brand-caption">
            {user?.role === "BUYER" ? "Buyer Portal" : "Production Workspace"}
          </span>
        </span>
      </Link>

      <p className="sidebar__section-label">WORKSPACE</p>
      <nav
        aria-label="Main navigation"
        className="sidebar__navigation"
        id="primary-navigation"
      >
        {navigationItems.map((item) => (
          <NavigationItem
            icon={icons[item.iconName]}
            key={item.to}
            label={item.label}
            onNavigate={onNavigate}
            to={item.to}
          />
        ))}
      </nav>

      <div className="sidebar__footer">
        <div aria-hidden="true" className="avatar avatar--sidebar">
          {user?.name?.slice(0, 1).toUpperCase() || "U"}
        </div>
        <div className="sidebar__profile-copy">
          <span className="sidebar__profile-name">{user?.name || "User"}</span>
          <span className="sidebar__profile-role">{user?.role || "Team member"}</span>
        </div>
        <button
          aria-label="Sign out"
          className="sidebar__logout"
          onClick={onLogout}
          title="Sign out"
          type="button"
        >
          <LogOut aria-hidden="true" size={17} />
        </button>
      </div>
    </aside>
  );
}
