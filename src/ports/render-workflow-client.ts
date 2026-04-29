/** Port: trigger and inspect Render Workflow task runs (SDK behind adapter). */

export type WorkflowTrigger = {
  startAnalyzeRepository(input: {
    owner: string;
    repo: string;
    ref: string;
  }): Promise<{ taskRunId: string }>;

  getTaskRun(taskRunId: string): Promise<{
    id: string;
    status: string;
    results?: unknown[];
    error?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
};
