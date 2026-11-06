import { Bell, ChevronRight, LogOut, Menu, Search } from "lucide-react";
import Button from "./Button.jsx";

export default function Topbar({
  currentPage,
  isMobileOpen,
  onLogout,
  onMenuClick,
  menuButtonRef,
  user,
}) {
  return (
    <header className="topbar">
      <div className="topbar__leading">
        <Button
          aria-controls="primary-navigation"
          aria-expanded={isMobileOpen}
          aria-label={isMobileOpen ? "Close navigation menu" : "Open navigation menu"}
          className="topbar__menu-button"
          onClick={onMenuClick}
          ref={menuButtonRef}
          variant="quiet"
        >
          <Menu aria-hidden="true" size={20} />
        </Button>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <span className="breadcrumb__workspace">Production Workspace</span>
          <ChevronRight aria-hidden="true" size={15} />
          <span aria-current="page" className="breadcrumb__current">
            {currentPage}
          </span>
        </nav>
      </div>

      <div className="topbar__actions">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="visually-hidden">Search workspace</span>
          <input placeholder="Search" type="search" />
        </label>
        <span aria-hidden="true" className="topbar__divider" />
        <Button
          aria-label="Notifications are not available yet"
          className="topbar__notification"
          disabled
          title="Notifications are not available yet"
          variant="quiet"
        >
          <Bell aria-hidden="true" size={19} />
        </Button>
        <div aria-label={`${user?.name || "User"}, ${user?.role || "Team member"}`} className="topbar__user">
          <div aria-hidden="true" className="avatar avatar--topbar">
            {user?.name?.slice(0, 1).toUpperCase() || "U"}
          </div>
          <div className="topbar__user-copy">
            <span className="topbar__user-name">{user?.name || "User"}</span>
            <span className="topbar__user-role">{user?.role || "Team member"}</span>
          </div>
        </div>
        <Button
          aria-label="Sign out"
          className="topbar__logout"
          onClick={onLogout}
          title="Sign out"
          variant="quiet"
        >
          <LogOut aria-hidden="true" size={17} />
        </Button>
      </div>
    </header>
  );
}
