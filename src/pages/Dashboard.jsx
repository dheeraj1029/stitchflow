import {
  Activity,
  CircleAlert,
  CircleCheck,
  Clock3,
  ClipboardList,
} from "lucide-react";
import { useMemo, useState } from "react";
import DashboardHeader from "../components/DashboardHeader.jsx";
import KpiCard from "../components/KpiCard.jsx";
import OrderFiltersPanel from "../components/OrderFiltersPanel.jsx";
import ProductionOrdersTable from "../components/ProductionOrdersTable.jsx";
import { productionOrders } from "../data/productionOrders.js";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const buyers = useMemo(
    () => [...new Set(productionOrders.map((order) => order.buyer))],
    [],
  );
  const units = useMemo(
    () => [...new Set(productionOrders.map((order) => order.productionUnit))],
    [],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredOrders = productionOrders.filter((order) => {
    const matchesSearch =
      !normalizedSearch ||
      [order.poNumber, order.buyer, order.style].some((value) =>
        value.toLocaleLowerCase().includes(normalizedSearch),
      );

    return (
      matchesSearch &&
      (!selectedBuyer || order.buyer === selectedBuyer) &&
      (!selectedUnit || order.productionUnit === selectedUnit) &&
      (!selectedStatus || order.status === selectedStatus)
    );
  });
  const hasActiveFilters = Boolean(
    search || selectedBuyer || selectedUnit || selectedStatus,
  );
  const resetFilters = () => {
    setSearch("");
    setSelectedBuyer("");
    setSelectedUnit("");
    setSelectedStatus("");
  };
  const countByStatus = (status) =>
    productionOrders.filter((order) => order.status === status).length;
  const activeOrders = productionOrders.filter(
    (order) => !["completed", "pending"].includes(order.status),
  ).length;

  const metrics = [
    {
      label: "Active Orders",
      value: activeOrders,
      description: "Current production orders",
      icon: ClipboardList,
      tone: "navy",
    },
    {
      label: "On Track",
      value: countByStatus("on-track"),
      description: "Demo status · illustrative",
      icon: CircleCheck,
      tone: "green",
    },
    {
      label: "At Risk",
      value: countByStatus("at-risk"),
      description: "Demo status · illustrative",
      icon: Clock3,
      tone: "amber",
    },
    {
      label: "Delayed",
      value: countByStatus("delayed"),
      description: "Demo status · illustrative",
      icon: CircleAlert,
      tone: "red",
    },
  ];

  return (
    <div className="dashboard">
      <DashboardHeader />

      <section aria-label="Production order summary" className="kpi-grid">
        {metrics.map((metric) => (
          <KpiCard key={metric.label} {...metric} />
        ))}
      </section>

      <div className="dashboard__section-heading">
        <div>
          <h2>Production overview</h2>
          <p>
            <Activity aria-hidden="true" size={14} />
            Current stage output by order
          </p>
        </div>
        <span className="dashboard__sample-label">Illustrative sample data</span>
      </div>

      <OrderFiltersPanel
        buyers={buyers}
        hasActiveFilters={hasActiveFilters}
        onBuyerChange={setSelectedBuyer}
        onReset={resetFilters}
        onSearchChange={setSearch}
        onStatusChange={setSelectedStatus}
        onUnitChange={setSelectedUnit}
        search={search}
        selectedBuyer={selectedBuyer}
        selectedStatus={selectedStatus}
        selectedUnit={selectedUnit}
        units={units}
      >
        <ProductionOrdersTable
          onReset={resetFilters}
          orders={filteredOrders}
          resultCount={filteredOrders.length}
          totalCount={productionOrders.length}
        />
      </OrderFiltersPanel>
    </div>
  );
}
