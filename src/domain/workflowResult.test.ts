import { describe, expect, it } from "vitest";
import { parseAnalyzeRepositoryOutcome } from "./workflowResult.js";

describe("parseAnalyzeRepositoryOutcome", () => {
  it("detects generated yaml", () => {
    const r = parseAnalyzeRepositoryOutcome([
      { status: "generated", yaml: "services:\n  - type: web\n" },
    ]);
    expect(r.kind).toBe("generated");
    if (r.kind === "generated") expect(r.yaml.length).toBeGreaterThan(0);
  });

  it("detects existing blueprint", () => {
    const r = parseAnalyzeRepositoryOutcome([
      { status: "existing_blueprint", blueprintPath: "render.yaml" },
    ]);
    expect(r.kind).toBe("existing_blueprint");
  });
});
