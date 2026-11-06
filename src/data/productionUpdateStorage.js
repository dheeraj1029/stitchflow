const STORAGE_KEY = "stitchflow.production-updates.v1";

function isValidUpdate(update) {
  const date = new Date(`${update?.productionDate}T12:00:00`);
  return (
    update &&
    typeof update === "object" &&
    typeof update.id === "string" &&
    typeof update.orderId === "string" &&
    typeof update.poNumber === "string" &&
    typeof update.stage === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(update.productionDate) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === update.productionDate &&
    Number.isInteger(update.completedQuantity) &&
    update.completedQuantity > 0 &&
    typeof update.submittedAt === "string" &&
    !Number.isNaN(Date.parse(update.submittedAt)) &&
    (update.issueNote === undefined || typeof update.issueNote === "string") &&
    (update.issueCategory === undefined ||
      typeof update.issueCategory === "string") &&
    (update.attachment === null ||
      update.attachment === undefined ||
      (typeof update.attachment.fileName === "string" &&
        typeof update.attachment.mimeType === "string" &&
        Number.isFinite(update.attachment.size) &&
        update.attachment.size >= 0))
  );
}

export function loadProductionUpdates() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return { updates: [], error: "" };
    }

    const parsed = JSON.parse(stored);
    if (
      !parsed ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.updates) ||
      !parsed.updates.every(isValidUpdate) ||
      new Set(parsed.updates.map((update) => update.id)).size !==
        parsed.updates.length
    ) {
      return {
        updates: [],
        error:
          "Saved production updates could not be read. Showing an empty history; check browser storage before saving new updates.",
      };
    }

    return {
      updates: parsed.updates.map((update) => ({
        issueNote: "",
        issueCategory: "",
        attachment: null,
        ...update,
      })),
      error: "",
    };
  } catch {
    return {
      updates: [],
      error:
        "Saved production updates are unavailable. Showing an empty history; check browser storage before saving new updates.",
    };
  }
}

export function writeProductionUpdates(updates) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, updates }),
  );
}
