/**
 * Decides whether to skip or start fork/deploy after the workflow reaches a terminal state.
 */
import type { WebEnv } from "../../config/env.js";
import { parseAnalyzeRepositoryOutcome } from "../../domain/workflowResult.js";
import type { RunStore } from "../../ports/analysis-run-store.js";
import type { GitHubFork } from "../../ports/github-fork.js";
import type { GitHubPublisher } from "../../ports/publish-github-branch.js";
import type { RenderDeploy } from "../../ports/render-deploy.js";
import type { Logger } from "pino";
import { runForkDeployProvision } from "../provision/run-provision.js";
import {
  isWorkflowFailedStatus,
  isWorkflowTerminalStatus,
} from "./analysis-run-workflow.js";

export type RunsProvisionDeps = {
  env: WebEnv;
  runs: RunStore;
  fork: GitHubFork | null;
  publisher: GitHubPublisher | null;
  deploy: RenderDeploy | null;
  log: Logger;
};

/** When the workflow has finished and Postgres shows no provision decision yet, classify result and maybe provision. */
export async function maybeDispatchProvision(
  deps: RunsProvisionDeps,
  runId: string,
  wf: {
    status?: string;
    results?: unknown;
  }
): Promise<void> {
  const record = await deps.runs.getById(runId);
  if (!record || record.provisionState !== null) return;

  const st = wf.status;
  if (!isWorkflowTerminalStatus(st)) return;

  if (isWorkflowFailedStatus(st)) {
    await deps.runs.markProvisionSkipped(runId, "analysis_error");
    return;
  }

  const outcome = parseAnalyzeRepositoryOutcome(wf.results);
  if (outcome.kind === "running") return;

  if (outcome.kind === "existing_blueprint") {
    await deps.runs.markProvisionSkipped(runId, "existing_blueprint");
    return;
  }

  if (outcome.kind === "error") {
    await deps.runs.markProvisionSkipped(runId, "analysis_error");
    return;
  }

  if (outcome.kind !== "generated") return;

  if (!deps.env.AUTO_DEPLOY_ENABLED) {
    await deps.runs.markProvisionSkipped(runId, "auto_deploy_disabled");
    return;
  }

  if (!deps.env.RENDER_OWNER_ID?.trim()) {
    await deps.runs.markProvisionSkipped(runId, "no_render_owner");
    return;
  }

  if (!deps.publisher || !deps.fork) {
    await deps.runs.markProvisionSkipped(runId, "no_github_token");
    return;
  }

  if (!deps.deploy) {
    await deps.runs.markProvisionSkipped(runId, "no_render_deploy");
    return;
  }

  const began = await deps.runs.tryBeginProvision(runId);
  if (!began) return;

  void runForkDeployProvision({
    env: deps.env,
    runs: deps.runs,
    fork: deps.fork,
    publisher: deps.publisher,
    deploy: deps.deploy,
    log: deps.log,
    runId,
    yaml: outcome.yaml,
    upstreamOwner: record.owner,
    upstreamRepo: record.repo,
  }).catch((e) => {
    deps.log.error({ runId, err: e }, "provision_unhandled");
  });
}
