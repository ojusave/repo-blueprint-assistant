import { describe, expect, it } from "vitest";
import { inferNodeDepsInstall, mergeSlices } from "./mergeInventory.js";
import type { PackageSlice } from "../contracts/analyze-repository-types.js";

describe("inferNodeDepsInstall", () => {
  it("detects pnpm lockfile", () => {
    expect(inferNodeDepsInstall(["package.json", "pnpm-lock.yaml"])).toContain(
      "pnpm"
    );
  });

  it("detects npm lockfile", () => {
    expect(inferNodeDepsInstall(["package.json", "package-lock.json"])).toBe(
      "npm ci --include=dev"
    );
  });

  it("defaults to npm install with dev deps", () => {
    expect(inferNodeDepsInstall(["package.json"])).toBe(
      "npm install --include=dev"
    );
  });
});

describe("mergeSlices", () => {
  it("sets nodeDepsInstall from paths", () => {
    const slice: PackageSlice = {
      rootPath: ".",
      hasDockerfile: false,
      scripts: { build: "vite build" },
    };
    const merged = mergeSlices([slice], [
      "package.json",
      "pnpm-lock.yaml",
      "src/index.ts",
    ]);
    expect(merged.nodeDepsInstall).toContain("pnpm");
  });
});
