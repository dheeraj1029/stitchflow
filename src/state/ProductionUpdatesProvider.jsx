import { useState } from "react";
import {
  loadProductionUpdates,
  writeProductionUpdates,
} from "../data/productionUpdateStorage.js";
import { ProductionUpdatesContext } from "./ProductionUpdatesContext.js";

export function ProductionUpdatesProvider({ children }) {
  const [initialData] = useState(loadProductionUpdates);
  const [updates, setUpdates] = useState(initialData.updates);
  const [storageError, setStorageError] = useState(initialData.error);

  function saveProductionUpdate(update) {
    if (updates.some((savedUpdate) => savedUpdate.id === update.id)) {
      return { ok: false, error: "This production update was already saved." };
    }

    const nextUpdates = [...updates, update];
    try {
      writeProductionUpdates(nextUpdates);
      setUpdates(nextUpdates);
      setStorageError("");
      return { ok: true, update };
    } catch {
      const error =
        "The production update could not be saved in this browser. Check storage availability and try again.";
      setStorageError(error);
      return { ok: false, error };
    }
  }

  return (
    <ProductionUpdatesContext.Provider
      value={{ updates, saveProductionUpdate, storageError }}
    >
      {children}
    </ProductionUpdatesContext.Provider>
  );
}
