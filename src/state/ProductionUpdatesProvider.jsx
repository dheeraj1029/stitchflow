import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../features/auth/AuthContext.js";
import {
  createProductionUpdate,
  editProductionUpdate,
  listProductionUpdates,
  removeProductionUpdate,
} from "../features/production/productionUpdatesApi.js";
import { ProductionUpdatesContext } from "./ProductionUpdatesContext.js";

export function ProductionUpdatesProvider({ children }) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const savedUpdates = await listProductionUpdates();
      if (requestId.current === activeRequest) setUpdates(savedUpdates);
      return savedUpdates;
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Production updates could not be loaded.";
      if (requestId.current === activeRequest) setError(message);
      throw loadError;
    } finally {
      if (requestId.current === activeRequest) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    reload().catch(() => {
      if (!active) return;
    });
    return () => {
      active = false;
      requestId.current += 1;
    };
  }, [reload, user?.id]);

  const mutate = useCallback(
    async (operation, message) => {
      try {
        const update = await operation();
        await reload();
        return { ok: true, update };
      } catch (mutationError) {
        const errorMessage =
          mutationError instanceof Error ? mutationError.message : message;
        setError(errorMessage);
        return { ok: false, error: errorMessage };
      }
    },
    [reload],
  );

  const saveProductionUpdate = useCallback(
    (update) =>
      mutate(
        () => createProductionUpdate(update),
        "The production update could not be saved.",
      ),
    [mutate],
  );
  const updateProductionUpdate = useCallback(
    (id, update) =>
      mutate(
        () => editProductionUpdate(id, update),
        "The production update could not be changed.",
      ),
    [mutate],
  );
  const deleteProductionUpdate = useCallback(
    (id) =>
      mutate(
        async () => {
          await removeProductionUpdate(id);
          return null;
        },
        "The production update could not be removed.",
      ),
    [mutate],
  );

  return (
    <ProductionUpdatesContext.Provider
      value={{
        updates,
        saveProductionUpdate,
        updateProductionUpdate,
        deleteProductionUpdate,
        loading,
        error,
        reload,
      }}
    >
      {children}
    </ProductionUpdatesContext.Provider>
  );
}
