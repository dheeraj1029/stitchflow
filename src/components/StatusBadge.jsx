const statusLabels = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  delayed: "Delayed",
  completed: "Completed",
  pending: "Pending",
};

export default function StatusBadge({ status }) {
  const label = statusLabels[status];

  if (!label) {
    throw new Error(`Unknown status: ${status}`);
  }

  return (
    <span className={`status-badge status-badge--${status}`}>{label}</span>
  );
}
