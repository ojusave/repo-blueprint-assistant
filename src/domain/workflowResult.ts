/** Parse workflow task results[] payload from analyze_repository (opaque JSON). */

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
