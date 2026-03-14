import { useState } from "react";

/**
 * Sub-hook: Case log state management.
 * Exposes state + setters so the orchestrator can populate them during bulk loading.
 */
export function useWorkflowCaseLog() {
  const [caseLog, setCaseLog] = useState([]);
  const [caseLogLoading, setCaseLogLoading] = useState(false);
  const [caseLogError, setCaseLogError] = useState("");

  return {
    caseLog,
    setCaseLog,
    caseLogLoading,
    setCaseLogLoading,
    caseLogError,
    setCaseLogError,
  };
}
