import { describe, expect, it } from "vitest";
import { deployTerminalGuidance } from "./deployTerminalGuidance.js";

describe("deployTerminalGuidance", () => {
  it("explains build_failed without implying API key issues", () => {
    const g = deployTerminalGuidance("build_failed");
    expect(g).toMatch(/build/i);
    expect(g).toMatch(/Dashboard|deploy log/i);
    expect(g).toMatch(/API key|credentials/i);
  });

  it("handles other terminal statuses", () => {
    expect(deployTerminalGuidance("pre_deploy_failed")).toMatch(/pre-deploy/i);
    expect(deployTerminalGuidance("canceled")).toMatch(/canceled/i);
  });
});
