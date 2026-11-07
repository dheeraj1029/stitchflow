import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { IssuesContext } from "./IssuesContext.js";
import {
  listIssues,
  reviewSavedIssue,
  saveIssueForReview,
} from "./issueApi.js";

export function IssuesProvider({ children }) {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const savedIssues = await listIssues();
      if (requestId.current === activeRequest) setIssues(savedIssues);
      return savedIssues;
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Production issues could not be loaded.";
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

  const createIssue = useCallback(
    async (issue) => {
      try {
        const savedIssue = await saveIssueForReview(issue);
        await reload();
        return {
          ok: true,
          issue: { ...issue, id: savedIssue.id, reviewStatus: savedIssue.reviewStatus },
        };
      } catch (saveError) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "The issue could not be saved.";
        setError(message);
        return { ok: false, error: message };
      }
    },
    [reload],
  );

  const refreshAfterAction = useCallback(
    async () => {
      try {
        await reload();
        return { ok: true };
      } catch (actionError) {
        return {
          ok: false,
          error:
            actionError instanceof Error
              ? actionError.message
              : "The issue could not be refreshed.",
        };
      }
    },
    [reload],
  );

  const confirmIssue = useCallback(
    async (id, review) => {
      try {
        await reviewSavedIssue(id, {
          ...review,
          decision: "CONFIRMED",
        });
        await reload();
        return { ok: true };
      } catch (actionError) {
        return {
          ok: false,
          error:
            actionError instanceof Error
              ? actionError.message
              : "The review could not be saved.",
        };
      }
    },
    [reload],
  );

  const rejectIssue = useCallback(
    async (id, reviewerNote) => {
      try {
        await reviewSavedIssue(id, {
          decision: "REJECTED",
          reviewerNote,
        });
        await reload();
        return { ok: true };
      } catch (actionError) {
        return {
          ok: false,
          error:
            actionError instanceof Error
              ? actionError.message
              : "The review could not be saved.",
        };
      }
    },
    [reload],
  );

  return (
    <IssuesContext.Provider
      value={{
        issues,
        loading,
        error,
        reload,
        createIssue,
        applyClassification: refreshAfterAction,
        markClassificationFailed: refreshAfterAction,
        confirmIssue,
        rejectIssue,
      }}
    >
      {children}
    </IssuesContext.Provider>
  );
}
