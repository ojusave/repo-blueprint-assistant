/**
 * Normalizes `analyze_repository` task output (results[0]) so HTTP routes can branch without
 * knowing raw workflow JSON shapes. "running" means missing payload or not yet terminal from
 * the caller’s perspective.
 */
export type WorkflowOutcome =
  | { kind: "generated"; yaml: string }
  | { kind: "existing_blueprint" }
  | { kind: "error"; message: string }
  | { kind: "running" };

export function parseAnalyzeRepositoryOutcome(
  results: unknown
): WorkflowOutcome {
  if (!Array.isArray(results) || results.length === 0) {
    return { kind: "running" };
  }
  const p = results[0];
  if (!p || typeof p !== "object") return { kind: "running" };
  const o = p as Record<string, unknown>;
  const status = o.status;
  if (status === "generated" && typeof o.yaml === "string") {
    return { kind: "generated", yaml: o.yaml };
  }
  if (status === "existing_blueprint") {
    return { kind: "existing_blueprint" };
  }
  if (status === "error") {
    const msg =
      typeof o.message === "string" ? o.message : "Workflow reported error";
    return { kind: "error", message: msg };
  }
  return { kind: "running" };
}
