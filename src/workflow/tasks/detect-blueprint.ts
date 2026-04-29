import { task } from "@renderinc/sdk/workflows";
import { getGithubRepository } from "../../infra/registry.js";
import type { RepoInput, RepoSnapshot } from "../../contracts/analysis.js";

const BLUEPRINT_NAMES = new Set(["render.yaml", "render.yml"]);

function findBlueprintPath(paths: string[]): string | undefined {
  for (const p of paths) {
    const base = p.split("/").pop();
    if (base && BLUEPRINT_NAMES.has(base)) {
      return p;
    }
  }
  return undefined;
}

type DetectInput = RepoInput & RepoSnapshot;

export const detectBlueprint = task(
  {
    name: "detect_render_blueprint",
    plan: "starter",
    timeoutSeconds: 120,
    retry: {
      maxRetries: 2,
      waitDurationMs: 3000,
      backoffScaling: 2,
    },
  },
  async function detectBlueprintTask(
    input: DetectInput
  ): Promise<{ found: false } | { found: true; path: string; rawYaml: string }> {
    const path = findBlueprintPath(input.paths);
    if (!path) {
      return { found: false };
    }
    const gh = getGithubRepository();
    const rawYaml = await gh.fetchFile(input.owner, input.repo, path, input.ref);
    return { found: true, path, rawYaml };
  }
);
