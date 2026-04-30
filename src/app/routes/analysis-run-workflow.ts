/** Helpers for interpreting Render Workflow task run status strings. */

export function workflowReady(env: {
  RENDER_API_KEY: string;
  WORKFLOW_SLUG: string;
}): boolean {
  return Boolean(env.RENDER_API_KEY?.trim() && env.WORKFLOW_SLUG?.trim());
}

export function isWorkflowTerminalStatus(statusRaw: string | undefined): boolean {
  const s = String(statusRaw || "").toLowerCase();
  return (
    s === "succeeded" ||
    s === "completed" ||
    s === "success" ||
    s === "failed" ||
    s === "canceled" ||
    s === "cancelled"
  );
}

export function isWorkflowFailedStatus(statusRaw: string | undefined): boolean {
  const s = String(statusRaw || "").toLowerCase();
  return s === "failed" || s === "canceled" || s === "cancelled";
}
