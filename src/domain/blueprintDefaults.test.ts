import { describe, expect, it } from "vitest";
import { defaultBuildCommand, defaultStartCommand } from "./blueprintDefaults.js";
import type { MergedInventory } from "../contracts/analysis.js";

function inv(p: Partial<MergedInventory>): MergedInventory {
  return {
    runtime: "node",
    hasPackageJson: true,
    hasDockerfile: false,
    warnings: [],
    slices: [],
    ...p,
  };
}

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
