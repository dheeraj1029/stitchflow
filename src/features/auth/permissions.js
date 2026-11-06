export const ROLE_HOME = {
  ADMIN: "/overview",
  MERCHANDISER: "/overview",
  SUPERVISOR: "/production-updates",
  BUYER: "/buyer",
};

const navigationByRole = {
  ADMIN: [
    { label: "Overview", to: "/overview", iconName: "overview" },
    { label: "Orders", to: "/orders", iconName: "orders" },
    { label: "Production Issues", to: "/issues", iconName: "issues" },
    { label: "User Management", to: "/admin/users", iconName: "users" },
  ],
  MERCHANDISER: [
    { label: "Overview", to: "/overview", iconName: "overview" },
    { label: "Orders", to: "/orders", iconName: "orders" },
    { label: "Production Updates", to: "/production-updates", iconName: "updates" },
    { label: "Production Issues", to: "/issues", iconName: "issues" },
    { label: "Delay Warnings", to: "/delay-warnings", iconName: "warnings" },
    { label: "Buyers", to: "/buyers", iconName: "buyers" },
  ],
  SUPERVISOR: [
    { label: "Production Updates", to: "/production-updates", iconName: "updates" },
    { label: "Issue Reports", to: "/issues", iconName: "issues" },
  ],
  BUYER: [
    { label: "Buyer dashboard", to: "/buyer", iconName: "overview" },
    { label: "My orders", to: "/buyer/orders", iconName: "orders" },
  ],
};

const allowedRoutes = {
  ADMIN: [
    /^\/overview$/,
    /^\/orders$/,
    /^\/orders\/(?!new$)[^/]+$/,
    /^\/issues$/,
    /^\/admin\/users$/,
    /^\/buyers$/,
  ],
  MERCHANDISER: [
    /^\/overview$/,
    /^\/orders$/,
    /^\/orders\/new$/,
    /^\/orders\/[^/]+\/edit$/,
    /^\/orders\/(?!new$)[^/]+$/,
    /^\/production-updates$/,
    /^\/production-updates\/[^/]+$/,
    /^\/issues$/,
    /^\/issues\/new$/,
    /^\/delay-warnings$/,
    /^\/buyers$/,
  ],
  SUPERVISOR: [
    /^\/production-updates$/,
    /^\/production-updates\/new$/,
    /^\/production-updates\/[^/]+$/,
    /^\/orders$/,
    /^\/orders\/(?!new$)[^/]+$/,
    /^\/issues$/,
    /^\/issues\/new$/,
  ],
  BUYER: [/^\/buyer$/, /^\/buyer\/orders$/, /^\/buyer\/orders\/[^/]+$/],
};

export function getRoleHome(role) {
  return ROLE_HOME[role] || "/login";
}

export function getNavigationForRole(role) {
  return navigationByRole[role] || [];
}

export function canAccessPath(role, pathname) {
  return Boolean(
    (allowedRoutes[role] || []).some((pattern) => pattern.test(pathname)),
  );
}

export function validateLoginInput({ email = "", password = "" } = {}) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Enter a valid email address.";
  }
  if (!password) {
    return "Enter your password.";
  }
  if (password.length > 72) {
    return "Password must be 72 characters or fewer.";
  }
  return "";
}
