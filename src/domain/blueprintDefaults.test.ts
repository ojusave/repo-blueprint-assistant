import { describe, expect, it } from "vitest";
import {
  composeRenderBuildCommand,
  composeStartCommand,
  defaultBuildCommand,
  defaultStartCommand,
} from "./blueprintDefaults.js";
import type { MergedInventory } from "../contracts/analyze-repository-types.js";

function inv(p: Partial<MergedInventory>): MergedInventory {
  return {
    runtime: "node",
    hasPackageJson: true,
    hasDockerfile: false,
    primarySliceRootPath: ".",
    dependencyKeys: [],
    warnings: [],
    slices: [],
    ...p,
  };
}

describe("composeRenderBuildCommand", () => {
  it("prepends npm ci with dev deps when package-lock and vite-style build", () => {
    expect(
      composeRenderBuildCommand(
        inv({
          scripts: { build: "vite build && cp x y" },
          nodeDepsInstall: "npm ci --include=dev",
        })
      )
    ).toBe("npm ci --include=dev && vite build && cp x y");
  });

  it("prepends pnpm install when inventory says so", () => {
    expect(
      composeRenderBuildCommand(
        inv({
          scripts: { build: "vite build" },
          nodeDepsInstall:
            "corepack enable && pnpm install --frozen-lockfile",
        })
      )
    ).toBe(
      "corepack enable && pnpm install --frozen-lockfile && vite build"
    );
  });

  it("collapses duplicate npm install when there is no build script", () => {
    expect(
      composeRenderBuildCommand(
        inv({
          scripts: { start: "node app.js" },
          nodeDepsInstall: "npm ci --include=dev",
        })
      )
    ).toBe("npm ci --include=dev");
  });

  it("wraps build in cd when primary slice is not repo root", () => {
    expect(
      composeRenderBuildCommand(
        inv({
          primarySliceRootPath: "apps/web",
          scripts: { build: "vite build" },
          nodeDepsInstall: "npm ci --include=dev",
        })
      )
    ).toBe("npm ci --include=dev && cd apps/web && vite build");
  });
});

describe("defaultBuildCommand", () => {
  it("uses explicit build script", () => {
    expect(
      defaultBuildCommand(
        inv({ scripts: { build: "npm run compile" }, hasPackageJson: true })
      )
    ).toBe("npm run compile");
  });

  it("defaults to npm install for Node with no build script", () => {
    expect(
      defaultBuildCommand(
        inv({ scripts: { start: "node app.js" }, hasPackageJson: true })
      )
    ).toBe("npm install");
  });
});

describe("composeStartCommand", () => {
  it("prefixes cd for non-root primary slice", () => {
    expect(
      composeStartCommand(
        inv({
          primarySliceRootPath: "packages/api",
          scripts: { start: "node dist/index.js" },
        })
      )
    ).toBe("cd packages/api && node dist/index.js");
  });
});

describe("defaultStartCommand", () => {
  it("uses explicit start script", () => {
    expect(
      defaultStartCommand(inv({ scripts: { start: "node app.js" } }))
    ).toBe("node app.js");
  });

  it("uses main when start missing", () => {
    expect(
      defaultStartCommand(inv({ main: "dist/server.js", scripts: {} }))
    ).toBe("node dist/server.js");
  });

  it("falls back to node index.js", () => {
    expect(defaultStartCommand(inv({ scripts: {} }))).toBe("node index.js");
  });
});
