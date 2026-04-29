import { Render } from "@renderinc/sdk";
import { AppError } from "../domain/errors.js";
import type { WorkflowTrigger } from "../ports/workflow.trigger.js";

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
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError("WORKFLOW_UPSTREAM", msg, 502);
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
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError("WORKFLOW_UPSTREAM", msg, 404);
    }
  }
}
