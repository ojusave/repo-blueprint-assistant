import { task } from "@renderinc/sdk/workflows";
import { getGithubRepository } from "../../infra/registry.js";
import type { RepoInput, RepoSnapshot } from "../../contracts/analysis.js";

type PlanInput = RepoInput & RepoSnapshot;

export const planTargets = task(
  {
    name: "plan_analysis_targets",
    plan: "starter",
    timeoutSeconds: 60,
    retry: {
      maxRetries: 2,
      waitDurationMs: 2000,
      backoffScaling: 2,
    },
  },
  async function planTargetsTask(input: PlanInput): Promise<{ targets: string[] }> {
    if (!input.paths.includes("package.json")) {
      return { targets: ["."] };
    }
    const gh = getGithubRepository();
    const raw = await gh.fetchFile(
      input.owner,
      input.repo,
      "package.json",
      input.ref
    );
    let pkg: { workspaces?: unknown };
    try {
      pkg = JSON.parse(raw) as { workspaces?: unknown };
    } catch {
      return { targets: ["."] };
    }

    const ws = pkg.workspaces;
    const globs: string[] = [];
    if (Array.isArray(ws)) {
      globs.push(...ws);
    } else if (ws && typeof ws === "object" && ws !== null && "packages" in ws) {
      const p = (ws as { packages?: unknown }).packages;
      if (Array.isArray(p)) globs.push(...p);
    }

    if (globs.length === 0) {
      return { targets: ["."] };
    }

    const targets = new Set<string>();
    for (const g of globs) {
      if (g.includes("*")) {
        const prefix = g.split("*")[0]?.replace(/\/$/, "") ?? "";
        if (!prefix) continue;
        for (const p of input.paths) {
          if (p.startsWith(`${prefix}/`) && p.endsWith("/package.json")) {
            const root = p.replace(/\/package.json$/, "");
            targets.add(root);
          }
        }
      } else {
        const path = g.replace(/\/$/, "");
        if (input.paths.includes(`${path}/package.json`)) {
          targets.add(path);
        }
      }
    }

    if (targets.size === 0) {
      return { targets: ["."] };
    }
    return { targets: Array.from(targets).sort() };
  }
);
