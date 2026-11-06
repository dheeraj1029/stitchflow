import { createContext, useContext } from "react";

export const BuyerPortalContext = createContext(null);

export function useBuyerPortal() {
  const context = useContext(BuyerPortalContext);
  if (!context) {
    throw new Error("useBuyerPortal must be used within BuyerPortalLayout.");
  }
  return context;
}
