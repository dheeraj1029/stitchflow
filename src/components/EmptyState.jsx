import { SearchX } from "lucide-react";

export default function EmptyState({ onReset }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-state__icon">
        <SearchX size={20} />
      </span>
      <h3 className="empty-state__title">No production orders found</h3>
      <p className="empty-state__description">
        Try another search or adjust your filters to see matching orders.
      </p>
      {onReset && (
        <button className="text-button" onClick={onReset} type="button">
          Clear search and filters
        </button>
      )}
    </div>
  );
}
