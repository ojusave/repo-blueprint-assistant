/**
 * Analysis runs API: POST /api/runs, GET /api/runs/:id (workflow + provision envelope).
 */
import { Router } from "express";
import { z } from "zod";
import type { WebEnv } from "../../config/env.js";
import { ok, fail } from "../../domain/apiEnvelope.js";
import { AppError } from "../../domain/errors.js";
import { parseRepoInput } from "../../domain/parseRepoUrl.js";
import type { RunStore } from "../../ports/analysis-run-store.js";
import type { GitHubFork } from "../../ports/github-fork.js";
import type { GitHubPublisher } from "../../ports/publish-github-branch.js";
import type { GitHubRepository } from "../../ports/read-github-repo.js";
import type { RenderDeploy } from "../../ports/render-deploy.js";
import type { WorkflowTrigger } from "../../ports/render-workflow-client.js";
import type { Logger } from "pino";
import { maybeDispatchProvision } from "./analysis-run-provision-dispatch.js";
import { workflowReady } from "./analysis-run-workflow.js";

const bodySchema = z.object({
  repoUrl: z.string().min(4),
});

const uuidSchema = z.string().uuid();

export function createRunsRouter(deps: {
  env: WebEnv;
  github: GitHubRepository;
  workflow: WorkflowTrigger;
  runs: RunStore;
  log: Logger;
  fork: GitHubFork | null;
  publisher: GitHubPublisher | null;
  deploy: RenderDeploy | null;
}): Router {
  const r = Router();

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

      await maybeDispatchProvision(deps, record.id, wf);

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
