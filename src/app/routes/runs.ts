import { Router } from "express";
import { z } from "zod";
import type { WebEnv } from "../../config/env.js";
import { ok, fail } from "../../domain/apiEnvelope.js";
import { AppError } from "../../domain/errors.js";
import { parseRepoInput } from "../../domain/parseRepoUrl.js";
import type { GitHubRepository } from "../../ports/github.repository.js";
import type { RunStore } from "../../ports/run.store.js";
import type { WorkflowTrigger } from "../../ports/workflow.trigger.js";
import type { Logger } from "pino";

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
      const wf = await deps.workflow.getTaskRun(record.taskRunId);
      res.json(ok({ record, workflow: wf }));
    } catch (e) {
      next(e);
    }
  });

  return r;
}
