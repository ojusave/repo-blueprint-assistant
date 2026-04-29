import { ClientError, Render, ServerError } from "@renderinc/sdk";
import { AppError } from "../domain/errors.js";
import type { WorkflowTrigger } from "../ports/workflow.trigger.js";

/** SDK builds messages like `Failed to run task: ${error}`; plain objects become `[object Object]`. */
function formatSdkWorkflowError(err: unknown): string {
  if (err instanceof ClientError || err instanceof ServerError) {
    const body = err.response as unknown;
    if (body !== undefined && body !== null) {
      if (typeof body === "string") return `Workflow API HTTP ${err.statusCode}: ${body}`;
      if (typeof body === "object") {
        const o = body as Record<string, unknown>;
        const piece =
          typeof o.message === "string"
            ? o.message
            : typeof o.error === "string"
              ? o.error
              : typeof o.detail === "string"
                ? o.detail
                : JSON.stringify(body);
        return `Workflow API HTTP ${err.statusCode}: ${piece}`;
      }
    }
    return `Workflow API HTTP ${err.statusCode}: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) return JSON.stringify(err);
  return String(err);
}

function upstreamHttpStatus(err: unknown): number {
  if (err instanceof ClientError || err instanceof ServerError) {
    const c = err.statusCode;
    if (c >= 400 && c < 600) return c;
  }
  return 502;
}

/**
 * Render Workflows API adapter (SDK contained here).
 */
export class RenderWorkflowAdapter implements WorkflowTrigger {
  private readonly client: Render;
  private readonly slug: string;

  constructor(opts: {
    apiKey: string;
    workflowSlug: string;
    baseUrl?: string;
  }) {
    this.client = new Render({
      token: opts.apiKey?.trim() ? opts.apiKey : undefined,
      baseUrl: opts.baseUrl,
    });
    this.slug = opts.workflowSlug.replace(/\/$/, "");
  }

  async startAnalyzeRepository(input: {
    owner: string;
    repo: string;
    ref: string;
  }): Promise<{ taskRunId: string }> {
    const taskSlug = `${this.slug}/analyze_repository`;
    try {
      const started = await this.client.workflows.startTask(taskSlug, [input]);
      return { taskRunId: started.taskRunId };
    } catch (e) {
      throw new AppError(
        "WORKFLOW_UPSTREAM",
        formatSdkWorkflowError(e),
        upstreamHttpStatus(e)
      );
    }
  }

  async getTaskRun(taskRunId: string) {
    try {
      const details = await this.client.workflows.getTaskRun(taskRunId);
      return {
        id: details.id,
        status: String(details.status),
        results: details.results as unknown[] | undefined,
        error: details.error,
        startedAt: details.startedAt,
        completedAt: details.completedAt,
      };
    } catch (e) {
      throw new AppError(
        "WORKFLOW_UPSTREAM",
        formatSdkWorkflowError(e),
        upstreamHttpStatus(e)
      );
    }
  }
}
