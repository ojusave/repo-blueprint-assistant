import { describe, expect, it } from "vitest";
import {
  pathScore,
  pickComposeFilePath,
  pickDockerfilePath,
  pickEnvExamplePath,
  pickFrameworkConfigPath,
  pickRenderBlueprintSamplePath,
  pickScoredPath,
} from "./repoPathPick.js";

describe("pathScore", () => {
  it("prefers shallow paths when primary is root", () => {
    expect(pathScore("Dockerfile", ".")).toBeLessThan(
      pathScore("apps/web/Dockerfile", ".")
    );
  });

  it("prefers paths under primary package", () => {
    expect(pathScore("apps/web/Dockerfile", "apps/web")).toBeLessThan(
      pathScore("Dockerfile", "apps/web")
    );
  });
});

describe("pickDockerfilePath", () => {
  it("selects Dockerfile under primary when present", () => {
    const p = pickDockerfilePath(
      ["Dockerfile", "apps/web/Dockerfile", "apps/web/package.json"],
      "apps/web"
    );
    expect(p).toBe("apps/web/Dockerfile");
  });
});

describe("pickEnvExamplePath", () => {
  it("matches .env.example", () => {
    expect(
      pickEnvExamplePath(["apps/web/.env.example", ".env.local"], "apps/web")
    ).toBe("apps/web/.env.example");
  });
});

describe("pickScoredPath", () => {
  it("returns undefined when no match", () => {
    expect(
      pickScoredPath(["a/b.txt"], ".", (base) => base === "nope")
    ).toBeUndefined();
  });
});

describe("pickComposeFilePath", () => {
  it("prefers compose file under primary package", () => {
    expect(
      pickComposeFilePath(
        ["docker-compose.yml", "apps/api/compose.yaml"],
        "apps/api"
      )
    ).toBe("apps/api/compose.yaml");
  });
});

describe("pickRenderBlueprintSamplePath", () => {
  it("matches render.yaml.example", () => {
    expect(
      pickRenderBlueprintSamplePath(
        ["render.yaml", "docs/render.yaml.example"],
        "."
      )
    ).toBe("docs/render.yaml.example");
  });
});

describe("pickFrameworkConfigPath", () => {
  it("returns vite config under primary", () => {
    expect(
      pickFrameworkConfigPath(
        ["vite.config.ts", "apps/web/vite.config.ts"],
        "apps/web",
        "vite"
      )
    ).toBe("apps/web/vite.config.ts");
  });
});
