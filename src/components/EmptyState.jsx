import { SearchX } from "lucide-react";

export default function EmptyState({
  onReset,
  title = "No production orders found",
  description = "Try another search or adjust your filters to see matching orders.",
  actionLabel = "Clear search and filters",
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-state__icon">
        <SearchX size={20} />
      </span>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__description">{description}</p>
      {onReset && (
        <button className="text-button" onClick={onReset} type="button">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
