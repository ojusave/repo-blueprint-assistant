import { Router } from "express";
import { z } from "zod";
import type { WebEnv } from "../../config/env.js";
import { parseAnalyzeRepositoryOutcome } from "../../domain/workflowResult.js";
import { ok, fail } from "../../domain/apiEnvelope.js";
import { AppError } from "../../domain/errors.js";
import { parseRepoInput } from "../../domain/parseRepoUrl.js";
import { runForkDeployProvision } from "../provision/run-provision.js";
import type { GitHubPublishRestAdapter } from "../../infra/github-http-publish.js";
import type { RenderDeployRestAdapter } from "../../infra/render-http-deploy.js";
import type { GitHubFork } from "../../ports/github-fork.js";
import type { GitHubRepository } from "../../ports/read-github-repo.js";
import type { RunStore } from "../../ports/analysis-run-store.js";
import type { WorkflowTrigger } from "../../ports/render-workflow-client.js";
import type { Logger } from "pino";

const bodySchema = z.object({
  repoUrl: z.string().min(4),
});

const uuidSchema = z.string().uuid();

function workflowReady(env: {
  RENDER_API_KEY: string;
  WORKFLOW_SLUG: string;
}): boolean {
  return Boolean(env.RENDER_API_KEY?.trim() && env.WORKFLOW_SLUG?.trim());
}

function isWorkflowTerminalStatus(statusRaw: string | undefined): boolean {
  const s = String(statusRaw || "").toLowerCase();
  return (
    s === "succeeded" ||
    s === "completed" ||
    s === "success" ||
    s === "failed" ||
    s === "canceled" ||
    s === "cancelled"
  );
}

function isWorkflowFailedStatus(statusRaw: string | undefined): boolean {
  const s = String(statusRaw || "").toLowerCase();
  return s === "failed" || s === "canceled" || s === "cancelled";
}

export function createRunsRouter(deps: {
  env: WebEnv;
  github: GitHubRepository;
  workflow: WorkflowTrigger;
  runs: RunStore;
  log: Logger;
  fork: GitHubFork | null;
  publisher: GitHubPublishRestAdapter | null;
  deploy: RenderDeployRestAdapter | null;
}): Router {
  const r = Router();

  async function maybeDispatchProvision(
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

  r.post("/api/runs", async (req, res, next) => {
    try {
      if (!deps.env.ANALYSIS_ENABLED) {
        res
          .status(503)
          .json(
            fail(
              "FEATURE_DISABLED",
              "Analysis is disabled via ANALYSIS_ENABLED"
            )
          );
        return;
      }
      if (!workflowReady(deps.env)) {
        res.status(503).json(
          fail(
            "WORKFLOW_NOT_CONFIGURED",
            "Set RENDER_API_KEY and WORKFLOW_SLUG in the web service environment (Dashboard), then redeploy or restart."
          )
        );
        return;
      }
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION", parsed.error.message, 400);
      }
      const { owner, repo } = parseRepoInput(parsed.data.repoUrl);
      const ref = await deps.github.getDefaultBranch(owner, repo);

      const started = await deps.workflow.startAnalyzeRepository({
        owner,
        repo,
        ref,
      });

      const record = await deps.runs.create({
        taskRunId: started.taskRunId,
        owner,
        repo,
        ref,
      });

      deps.log.info(
        { runId: record.id, taskRunId: record.taskRunId },
        "analysis_started"
      );

      res.json(
        ok({
          runId: record.id,
          taskRunId: record.taskRunId,
          owner,
          repo,
          ref,
        })
      );
    } catch (e) {
      next(e);
    }
  });

  r.get("/api/runs/:runId", async (req, res, next) => {
    try {
      const parsed = uuidSchema.safeParse(req.params.runId);
      if (!parsed.success) {
        throw new AppError("VALIDATION", "runId must be a UUID", 400);
      }
      const record = await deps.runs.getById(parsed.data);
      if (!record) {
        throw new AppError("NOT_FOUND", "Run not found", 404);
      }
      if (!workflowReady(deps.env)) {
        res.status(503).json(
          fail(
            "WORKFLOW_NOT_CONFIGURED",
            "Set RENDER_API_KEY and WORKFLOW_SLUG before polling workflow status."
          )
        );
        return;
      }
      const wf = await deps.workflow.getTaskRun(record.taskRunId);

      await maybeDispatchProvision(record.id, wf);

      const refreshed = await deps.runs.getById(record.id);
      res.json(
        ok({
          record: refreshed ?? record,
          workflow: wf,
          provision: refreshed
            ? {
                state: refreshed.provisionState,
                skipReason: refreshed.provisionSkipReason,
                forkHtmlUrl: refreshed.forkHtmlUrl,
                forkBranch: refreshed.forkBranch,
                forkOwner: refreshed.forkOwner,
                forkRepo: refreshed.forkRepo,
                deployedUrl: refreshed.deployedUrl,
                renderServiceId: refreshed.renderServiceId,
                error: refreshed.provisionError,
              }
            : null,
        })
      );
    } catch (e) {
      next(e);
    }
  });

  return r;
}
