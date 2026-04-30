import { describe, expect, it } from "vitest";
import { inferFrameworkFromPaths } from "./inferFrameworkFromPaths.js";

describe("inferFrameworkFromPaths", () => {
  it("detects Next near primary package", () => {
    expect(
      inferFrameworkFromPaths(
        ["package.json", "apps/web/next.config.ts", "vite.config.ts"],
        "apps/web"
      )
    ).toBe("next");
  });

  it("detects Vite when Next absent", () => {
    expect(
      inferFrameworkFromPaths(
        ["package.json", "packages/ui/vite.config.ts"],
        "packages/ui"
      )
    ).toBe("vite");
  });

  it("returns undefined when no config", () => {
    expect(inferFrameworkFromPaths(["package.json", "src/index.ts"], ".")).toBe(
      undefined
    );
  });
});
