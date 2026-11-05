import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  Settings2,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import NavigationItem from "./NavigationItem.jsx";

const navigationItems = [
  { label: "Overview", to: "/overview", icon: LayoutDashboard },
  { label: "Orders", to: "/orders", icon: ClipboardList },
  { label: "Production Updates", to: "/production-updates", icon: Activity },
  { label: "Delay Warnings", to: "/delay-warnings", icon: TriangleAlert },
  { label: "Buyers", to: "/buyers", icon: UsersRound },
  { label: "Settings", to: "/settings", icon: Settings2 },
];

export default function Sidebar({ isMobileOpen, onNavigate }) {
  return (
    <aside
      aria-label="Primary sidebar"
      className={`sidebar${isMobileOpen ? " sidebar--mobile-open" : ""}`}
    >
      <Link
        aria-label="StitchFlow overview"
        className="sidebar__brand"
        onClick={onNavigate}
        to="/overview"
      >
        <span aria-hidden="true" className="brand-mark">
          <span />
          <span />
          <span />
        </span>
        <span className="sidebar__brand-copy">
          <span className="sidebar__brand-name">StitchFlow</span>
          <span className="sidebar__brand-caption">Production Workspace</span>
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
            icon={item.icon}
            key={item.to}
            label={item.label}
            onNavigate={onNavigate}
            to={item.to}
          />
        ))}
      </nav>

      <div className="sidebar__footer">
        <div aria-hidden="true" className="avatar avatar--sidebar">
          W
        </div>
        <div className="sidebar__profile-copy">
          <span className="sidebar__profile-name">Workspace User</span>
          <span className="sidebar__profile-role">Team member</span>
        </div>
      </div>
    </aside>
  );
}
