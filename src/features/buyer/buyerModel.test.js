import assert from "node:assert/strict";
import test from "node:test";
import { filterBuyerOrders, getBuyerDashboardStats } from "./buyerModel.js";

const orders = [
  {
    id: "b-1",
    poNumber: "B-PO-88213",
    style: "Crew Neck Tee",
    colour: "Navy",
    status: "on-track",
    hasConfirmedWarnings: true,
    progressByStage: [{ status: "IN_PROGRESS" }],
  },
  {
    id: "b-2",
    poNumber: "B-PO-88240",
    style: "Polo",
    colour: "White",
    status: "at-risk",
    hasConfirmedWarnings: false,
    progressByStage: [{ status: "IN_PROGRESS" }],
  },
  {
    id: "b-3",
    poNumber: "B-PO-88250",
    style: "Jacket",
    colour: "Black",
    status: "completed",
    hasConfirmedWarnings: false,
    progressByStage: [{ status: "COMPLETED" }],
  },
];

test("buyer dashboard counts are based only on delivered API records", () => {
  assert.deepEqual(
    getBuyerDashboardStats(orders, [{ id: "warning-1" }]),
    {
      activeOrders: 2,
      inProduction: 2,
      shipped: 0,
      attention: 2,
      confirmedWarnings: 1,
    },
  );
});

test("buyer search and status filters compose", () => {
  assert.deepEqual(
    filterBuyerOrders(orders, { search: "polo white", status: "at-risk" }).map((order) => order.id),
    ["b-2"],
  );
  assert.deepEqual(
    filterBuyerOrders(orders, { search: "B-PO-88213", status: "delayed" }),
    [],
  );
  assert.equal(filterBuyerOrders(orders, {}).length, 3);
});
