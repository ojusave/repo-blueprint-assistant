/**
 * Port: persist analysis run metadata (Postgres behind adapter).
 * Provision fields track fork → deploy pipeline state; see maybeDispatchProvision in repo-analysis.routes.ts.
 */

export type ProvisionSkipReason =
  | "existing_blueprint"
  | "analysis_error"
  | "no_github_token"
  | "no_render_owner"
  | "no_render_deploy"
  | "auto_deploy_disabled";

export type RunRecord = {
  id: string;
  taskRunId: string;
  owner: string;
  repo: string;
  ref: string;
  createdAt: string;
  provisionState: string | null;
  provisionSkipReason: string | null;
  forkOwner: string | null;
  forkRepo: string | null;
  forkHtmlUrl: string | null;
  forkBranch: string | null;
  renderServiceId: string | null;
  deployedUrl: string | null;
  provisionError: string | null;
};

export type RunStore = {
  create(data: {
    taskRunId: string;
    owner: string;
    repo: string;
    ref: string;
  }): Promise<RunRecord>;

  getById(id: string): Promise<RunRecord | null>;

  /** First caller wins; starts fork/deploy pipeline. */
  tryBeginProvision(id: string): Promise<boolean>;

  markProvisionSkipped(
    id: string,
    reason: ProvisionSkipReason
  ): Promise<void>;

  updateForkMeta(
    id: string,
    meta: {
      forkOwner: string;
      forkRepo: string;
      forkHtmlUrl: string;
    }
  ): Promise<void>;

  updateForkBranch(id: string, branch: string): Promise<void>;

  setRenderServiceId(id: string, serviceId: string): Promise<void>;

  completeProvisionDone(id: string, deployedUrl: string): Promise<void>;

  failProvision(id: string, message: string): Promise<void>;
};
