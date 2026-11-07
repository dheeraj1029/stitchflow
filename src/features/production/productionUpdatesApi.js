import { apiRequest } from "../auth/authApi.js";

export async function listProductionUpdates() {
  const result = await apiRequest("/api/production-updates");
  if (!Array.isArray(result.updates)) {
    throw new Error("The production update service returned invalid data.");
  }
  return result.updates;
}

export async function createProductionUpdate(update) {
  const result = await apiRequest("/api/production-updates", {
    method: "POST",
    body: JSON.stringify(update),
  });
  if (!result.update || typeof result.update.id !== "string") {
    throw new Error("The production update service returned an invalid record.");
  }
  return result.update;
}

export async function editProductionUpdate(id, update) {
  const result = await apiRequest(
    `/api/production-updates/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(update),
    },
  );
  if (!result.update || result.update.id !== id) {
    throw new Error("The production update service returned an invalid record.");
  }
  return result.update;
}

export function removeProductionUpdate(id) {
  return apiRequest(`/api/production-updates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
