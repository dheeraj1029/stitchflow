import { createContext, useContext } from "react";

export const IssuesContext = createContext(null);

export function useIssues() {
  const context = useContext(IssuesContext);
  if (!context) {
    throw new Error("useIssues must be used within IssuesProvider.");
  }
  return context;
}
