import { Search, X } from "lucide-react";
import { orderStatuses } from "../data/productionOrders.js";

export default function OrderFilters({
  buyers,
  hasActiveFilters,
  onBuyerChange,
  onReset,
  onSearchChange,
  onStatusChange,
  onUnitChange,
  search,
  selectedBuyer,
  selectedStatus,
  selectedUnit,
  units,
}) {
  return (
    <div className="order-filters">
      <label className="order-search">
        <Search aria-hidden="true" size={17} />
        <span className="visually-hidden">Search production orders</span>
        <input
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search PO, buyer or style"
          type="search"
          value={search}
        />
        {search && (
          <button
            aria-label="Clear search"
            className="order-search__clear"
            onClick={() => onSearchChange("")}
            type="button"
          >
            <X aria-hidden="true" size={15} />
          </button>
        )}
      </label>

      <div className="order-filters__controls">
        <label className="filter-field">
          <span>Buyer</span>
          <select
            onChange={(event) => onBuyerChange(event.target.value)}
            value={selectedBuyer}
          >
            <option value="">All buyers</option>
            {buyers.map((buyer) => (
              <option key={buyer} value={buyer}>
                {buyer}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Production unit</span>
          <select
            onChange={(event) => onUnitChange(event.target.value)}
            value={selectedUnit}
          >
            <option value="">All units</option>
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Status</span>
          <select
            onChange={(event) => onStatusChange(event.target.value)}
            value={selectedStatus}
          >
            <option value="">All statuses</option>
            {orderStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        {hasActiveFilters && (
          <button
            className="text-button order-filters__reset"
            onClick={onReset}
            type="button"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
