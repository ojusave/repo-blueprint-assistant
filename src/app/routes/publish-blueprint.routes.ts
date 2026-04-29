import { Router } from "express";
import { z } from "zod";
import type { WebEnv } from "../../config/env.js";
import { ok, fail } from "../../domain/apiEnvelope.js";
import { AppError } from "../../domain/errors.js";
import type { GitHubPublisher } from "../../ports/publish-github-branch.js";
import type { GitHubRepository } from "../../ports/read-github-repo.js";
import type { Logger } from "pino";

const branchName = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9._/-]+$/);

const bodySchema = z.object({
  owner: z.string().min(1).max(200),
  repo: z.string().min(1).max(200),
  yaml: z.string().min(1).max(450_000),
  path: z.string().min(1).max(400).default("render.yaml"),
  branch: branchName.optional(),
  baseBranch: branchName.optional(),
});

function defaultBranchName(): string {
  return `assistant/bpa-${Date.now().toString(36)}`;
}

export function createPublishRouter(deps: {
  env: WebEnv;
  github: GitHubRepository;
  publisher: GitHubPublisher | null;
  log: Logger;
}): Router {
  const r = Router();

  r.post("/api/publish", async (req, res, next) => {
    try {
      if (!deps.env.BLUEPRINT_PUBLISH_ENABLED) {
        res
          .status(503)
          .json(
            fail(
              "FEATURE_DISABLED",
              "Publishing is disabled via BLUEPRINT_PUBLISH_ENABLED"
            )
          );
        return;
      }
      if (!deps.publisher) {
        res
          .status(503)
          .json(
            fail(
              "GITHUB_TOKEN_REQUIRED",
              "Set GITHUB_TOKEN with contents:write on the target repo to enable publishing."
            )
          );
        return;
      }

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION", parsed.error.message, 400);
      }

      const {
        owner,
        repo,
        yaml,
        path,
        branch: branchOpt,
        baseBranch,
      } = parsed.data;
      const branch = branchOpt ?? defaultBranchName();
      const base =
        baseBranch ?? (await deps.github.getDefaultBranch(owner, repo));

      const result = await deps.publisher.publishFileOnNewBranch({
        owner,
        repo,
        path,
        content: yaml,
        branch,
        baseBranch: base,
      });

      deps.log.info({ owner, repo, branch: result.branch }, "blueprint_published");

      res.json(
        ok({
          branch: result.branch,
          htmlUrl: result.htmlUrl,
        })
      );
    } catch (e) {
      next(e);
    }
  });

  return r;
}
