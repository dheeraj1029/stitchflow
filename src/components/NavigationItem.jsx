import { NavLink } from "react-router-dom";

export default function NavigationItem({ icon: Icon, label, onNavigate, to }) {
  return (
    <NavLink
      className={({ isActive }) =>
        `navigation-item${isActive ? " navigation-item--active" : ""}`
      }
      onClick={onNavigate}
      to={to}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
      <span>{label}</span>
    </NavLink>
  );
}
