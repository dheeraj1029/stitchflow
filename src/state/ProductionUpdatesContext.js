import { createContext, useContext } from "react";

export const ProductionUpdatesContext = createContext(null);

export function useProductionUpdates() {
  const context = useContext(ProductionUpdatesContext);
  if (!context) {
    throw new Error(
      "useProductionUpdates must be used within ProductionUpdatesProvider.",
    );
  }
  return context;
}
