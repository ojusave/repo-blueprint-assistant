/**
 * Background pipeline: fork upstream GitHub repo → push generated render.yaml to a new branch →
 * POST /v1/services to create a web service → poll deploy until live → persist public URL.
 * Invoked fire-and-forget from repo-analysis.routes after tryBeginProvision succeeds.
 */
import type { WebEnv } from "../../config/env.js";
import { extractWebServiceFromBlueprintYaml } from "../../domain/parseGeneratedBlueprint.js";
import type { GitHubFork } from "../../ports/github-fork.js";
import type { GitHubPublisher } from "../../ports/publish-github-branch.js";
import type { RunStore } from "../../ports/analysis-run-store.js";
import type { RenderDeploy } from "../../ports/render-deploy.js";
import { deployTerminalGuidance } from "../../domain/deployTerminalGuidance.js";
import type { Logger } from "pino";

const DEPLOY_POLL_MS = 4000;
const DEPLOY_MAX_POLLS = 120;

function safeServiceName(runId: string): string {
  const compact = runId.replace(/-/g, "").slice(0, 24);
  return `bpa-${compact || "app"}`.slice(0, 48);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Polls GET .../deploys/:deployId until status is terminal (live or failure). */
async function waitForDeployLive(
  deploy: RenderDeploy,
  serviceId: string,
  deployId: string,
  log: Logger
): Promise<void> {
  for (let i = 0; i < DEPLOY_MAX_POLLS; i++) {
    const d = await deploy.getDeploy(serviceId, deployId);
    const st = String(d.status ?? "").toLowerCase();
    log.info({ serviceId, deployId, status: st }, "deploy_poll");
    if (st === "live") return;
    if (
      st === "build_failed" ||
      st === "update_failed" ||
      st === "canceled" ||
      st === "pre_deploy_failed"
    ) {
      throw new Error(
        `Deploy ended with status: ${st}. ${deployTerminalGuidance(st)}`
      );
    }
    await sleep(DEPLOY_POLL_MS);
  }
  throw new Error("Timed out waiting for deploy to go live");
}

/** Reads web service public URL from GET /services/:id response body. */
function extractServicePublicUrl(svc: unknown): string | undefined {
  if (!svc || typeof svc !== "object") return undefined;
  const o = svc as Record<string, unknown>;
  const details = o.serviceDetails;
  if (
    details &&
    typeof details === "object" &&
    typeof (details as { url?: string }).url === "string"
  ) {
    return (details as { url: string }).url;
  }
  return undefined;
}

/**
 * Fork upstream repo, push generated render.yaml to a new branch, create Render web service,
 * poll deploy until live, save deployed_url on the run row (or failProvision on error).
 */
export async function runForkDeployProvision(opts: {
  env: WebEnv;
  runs: RunStore;
  fork: GitHubFork;
  publisher: GitHubPublisher;
  deploy: RenderDeploy;
  log: Logger;
  runId: string;
  yaml: string;
  upstreamOwner: string;
  upstreamRepo: string;
}): Promise<void> {
  const {
    env,
    runs,
    fork,
    publisher,
    deploy,
    log,
    runId,
    yaml,
    upstreamOwner,
    upstreamRepo,
  } = opts;
  const ownerId = env.RENDER_OWNER_ID.trim();
  if (!ownerId) {
    await runs.failProvision(runId, "RENDER_OWNER_ID is not set");
    return;
  }

  try {
    const commands = extractWebServiceFromBlueprintYaml(yaml);
    const forked = await fork.ensureFork({
      upstreamOwner,
      upstreamRepo,
    });

    await runs.updateForkMeta(runId, {
      forkOwner: forked.owner,
      forkRepo: forked.repo,
      forkHtmlUrl: forked.htmlUrl,
    });

    const branch = `assistant/bpa-${runId.replace(/-/g, "").slice(0, 10)}`;
    await runs.updateForkBranch(runId, branch);

    await publisher.publishFileOnNewBranch({
      owner: forked.owner,
      repo: forked.repo,
      path: "render.yaml",
      content: yaml,
      branch,
      baseBranch: forked.defaultBranch,
    });

    const repoUrl = `https://github.com/${forked.owner}/${forked.repo}`;
    const body: Record<string, unknown> = {
      type: "web_service",
      name: safeServiceName(runId),
      ownerId,
      repo: repoUrl,
      branch,
      autoDeploy: "yes",
      serviceDetails: {
        runtime: commands.runtime,
        plan: env.RENDER_DEPLOY_PLAN,
        region: env.RENDER_DEPLOY_REGION,
        healthCheckPath: "/",
        envSpecificDetails: {
          buildCommand: commands.buildCommand,
          startCommand: commands.startCommand,
        },
      },
    };

    const created = await deploy.createWebService(body);
    const svcWrap = created as {
      service?: { id?: string };
      deployId?: string;
    };
    const serviceId = svcWrap.service?.id;
    const deployId = svcWrap.deployId;
    if (!serviceId || !deployId) {
      throw new Error(
        "Render create service response missing service.id or deployId"
      );
    }

    await runs.setRenderServiceId(runId, serviceId);
    await waitForDeployLive(deploy, serviceId, deployId, log);

    const svc = await deploy.getService(serviceId);
    const url = extractServicePublicUrl(svc);
    if (!url || typeof url !== "string") {
      throw new Error("Render service has no public URL yet");
    }

    await runs.completeProvisionDone(runId, url);
    log.info({ runId, url }, "provision_done");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ runId, err: msg }, "provision_failed");
    await runs.failProvision(runId, msg);
  }
}
