import { useRef, useState } from "react";
import {
  applyIssueClassification,
  confirmIssueReview,
  markIssueClassificationFailed,
  rejectIssueReview,
} from "./issueModel.js";
import { loadIssueData, writeIssueData } from "./issueStorage.js";
import { IssuesContext } from "./IssuesContext.js";

export function IssuesProvider({ children }) {
  const [initialData] = useState(loadIssueData);
  const [issues, setIssues] = useState(initialData.issues);
  const issuesRef = useRef(initialData.issues);
  const [storageError, setStorageError] = useState(initialData.error);

  function commit(nextIssues, issue, errorMessage) {
    try {
      writeIssueData(nextIssues);
      issuesRef.current = nextIssues;
      setIssues(nextIssues);
      setStorageError("");
      return { ok: true, issue };
    } catch {
      const error =
        errorMessage ||
        "The issue could not be saved in this browser. Check storage availability and try again.";
      setStorageError(error);
      return { ok: false, error };
    }
  }

  function createIssue(issue) {
    if (issuesRef.current.some((saved) => saved.id === issue.id)) {
      return { ok: false, error: "This issue was already submitted." };
    }
    return commit([...issuesRef.current, issue], issue);
  }

  function updateWith(operation) {
    const result = operation(issuesRef.current);
    if (!result.ok) {
      return result;
    }
    return commit(result.issues, result.issue);
  }

  const value = {
    issues,
    storageError,
    createIssue,
    applyClassification: (id, classification) =>
      updateWith((current) =>
        applyIssueClassification(
          current,
          id,
          classification,
          new Date().toISOString(),
        ),
      ),
    markClassificationFailed: (id, message) =>
      updateWith((current) =>
        markIssueClassificationFailed(
          current,
          id,
          message,
          new Date().toISOString(),
        ),
      ),
    confirmIssue: (id, review) =>
      updateWith((current) =>
        confirmIssueReview(
          current,
          id,
          review,
          new Date().toISOString(),
        ),
      ),
    rejectIssue: (id, note) =>
      updateWith((current) =>
        rejectIssueReview(
          current,
          id,
          note,
          new Date().toISOString(),
        ),
      ),
  };

  return (
    <IssuesContext.Provider value={value}>{children}</IssuesContext.Provider>
  );
}
