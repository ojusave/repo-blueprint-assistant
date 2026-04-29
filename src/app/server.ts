import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import pino from "pino";
import postgres from "postgres";
import { loadWebEnv } from "../config/env.js";
import { migrate } from "../db/migrate.js";
import { GitHubForkRestAdapter } from "../infra/github-http-fork.js";
import { GitHubPublishRestAdapter } from "../infra/github-http-publish.js";
import { GitHubRestAdapter } from "../infra/github-http-read.js";
import { PostgresRunStore } from "../infra/postgres-analysis-runs.js";
import { RenderDeployRestAdapter } from "../infra/render-http-deploy.js";
import { RenderWorkflowAdapter } from "../infra/render-workflows-client.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { createMetaRouter } from "./routes/meta.js";
import { createPublishRouter } from "./routes/publish-blueprint.routes.js";
import { createRunsRouter } from "./routes/repo-analysis.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

async function main(): Promise<void> {
  const env = loadWebEnv();
  const sql = postgres(env.DATABASE_URL, { max: 10 });
  await migrate(sql);

  const github = new GitHubRestAdapter({
    token: process.env.GITHUB_TOKEN,
    timeoutMs: Number(process.env.GITHUB_HTTP_TIMEOUT_MS ?? 15000),
  });

  const githubToken = process.env.GITHUB_TOKEN?.trim() ?? "";
  const githubHttpTimeoutMs = Number(process.env.GITHUB_HTTP_TIMEOUT_MS ?? 15000);
  const githubPush =
    githubToken.length > 0
      ? new GitHubPublishRestAdapter({
          token: githubToken,
          timeoutMs: githubHttpTimeoutMs,
        })
      : null;
  const githubPublisher =
    env.BLUEPRINT_PUBLISH_ENABLED && githubPush ? githubPush : null;
  const githubFork =
    githubToken.length > 0
      ? new GitHubForkRestAdapter({
          token: githubToken,
          timeoutMs: githubHttpTimeoutMs,
        })
      : null;

  const renderApiBase =
    env.RENDER_API_URL?.trim() || "https://api.render.com";
  const renderDeploy =
    env.RENDER_API_KEY.trim().length > 0
      ? new RenderDeployRestAdapter({
          apiKey: env.RENDER_API_KEY.trim(),
          baseUrl: renderApiBase,
          timeoutMs: 60000,
        })
      : null;

  const workflow = new RenderWorkflowAdapter({
    apiKey: env.RENDER_API_KEY,
    workflowSlug: env.WORKFLOW_SLUG,
    baseUrl: env.RENDER_API_URL,
  });

  const runs = new PostgresRunStore(sql);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "512kb" }));

  const repoRoot = path.join(__dirname, "..", "..");
  app.use(
    "/dds",
    express.static(path.join(repoRoot, "node_modules", "render-dds", "dist"))
  );
  app.use(express.static(path.join(repoRoot, "public")));

  app.use(healthRouter);
  app.use(createMetaRouter(env));
  app.use(
    createRunsRouter({
      env,
      github,
      workflow,
      runs,
      log,
      fork: githubFork,
      publisher: githubPush,
      deploy: renderDeploy,
    })
  );
  app.use(
    createPublishRouter({
      env,
      github,
      publisher: githubPublisher,
      log,
    })
  );

  app.use(errorHandler);

  app.listen(env.PORT, "0.0.0.0", () => {
    log.info({ port: env.PORT }, "web listening");
  });
}

main().catch((e) => {
  log.error(e);
  process.exit(1);
});
