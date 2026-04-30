import { describe, expect, it } from "vitest";
import {
  inferNodeDepsInstall,
  mergeSlices,
  pickPrimarySlice,
} from "./mergeInventory.js";
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

describe("pickPrimarySlice", () => {
  it("prefers root when it has build or start", () => {
    const root: PackageSlice = {
      rootPath: ".",
      hasDockerfile: false,
      scripts: { build: "turbo build", start: "turbo start" },
    };
    const pkg: PackageSlice = {
      rootPath: "apps/web",
      hasDockerfile: false,
      scripts: { build: "vite build", start: "vite preview" },
    };
    expect(pickPrimarySlice([pkg, root])).toBe(root);
  });

  it("falls back to slice with both build and start when root has neither", () => {
    const root: PackageSlice = {
      rootPath: ".",
      hasDockerfile: false,
    };
    const pkg: PackageSlice = {
      rootPath: "apps/web",
      hasDockerfile: false,
      scripts: { build: "vite build", start: "node server.js" },
    };
    expect(pickPrimarySlice([root, pkg])).toBe(pkg);
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

  it("unions dependencyKeys across slices", () => {
    const a: PackageSlice = {
      rootPath: ".",
      hasDockerfile: false,
      dependencyKeys: ["react", "pg"],
    };
    const b: PackageSlice = {
      rootPath: "apps/web",
      hasDockerfile: false,
      dependencyKeys: ["vite", "pg"],
    };
    const merged = mergeSlices([a, b], ["package.json"]);
    expect(merged.dependencyKeys).toEqual(["pg", "react", "vite"]);
  });

  it("sets primarySliceRootPath from pickPrimarySlice", () => {
    const root: PackageSlice = {
      rootPath: ".",
      hasDockerfile: false,
    };
    const pkg: PackageSlice = {
      rootPath: "apps/web",
      hasDockerfile: false,
      scripts: { build: "vite build", start: "node dist/server.js" },
      dependencyKeys: ["express"],
    };
    const merged = mergeSlices([root, pkg], ["package.json"]);
    expect(merged.primarySliceRootPath).toBe("apps/web");
    expect(merged.scripts?.build).toBe("vite build");
  });
});
