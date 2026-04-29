import { task } from "@renderinc/sdk/workflows";
import { getGithubRepository } from "../../infra/workflow-github-registry.js";
import type { RepoInput, RepoSnapshot } from "../../contracts/analyze-repository-types.js";

export const fetchRepoSnapshot = task(
  {
    name: "fetch_repo_snapshot",
    plan: "starter",
    timeoutSeconds: 120,
    retry: {
      maxRetries: 2,
      waitDurationMs: 3000,
      backoffScaling: 2,
    },
  },
  async function fetchRepoSnapshotTask(input: RepoInput): Promise<RepoSnapshot> {
    const gh = getGithubRepository();
    const { sha, paths } = await gh.fetchTree(input.owner, input.repo, input.ref);
    return { sha, paths };
  }
);
