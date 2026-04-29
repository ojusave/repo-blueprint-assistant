/**
 * Postgres persistence for analysis runs: workflow task linkage plus optional fork/deploy
 * columns updated by the provision pipeline (see RunStore in ports/analysis-run-store.ts).
 */
import postgres from "postgres";
import type {
  ProvisionSkipReason,
  RunRecord,
  RunStore,
} from "../ports/analysis-run-store.js";

function mapRow(r: {
  id: string;
  task_run_id: string;
  owner: string;
  repo: string;
  ref: string;
  created_at: Date;
  provision_state: string | null;
  provision_skip_reason: string | null;
  fork_owner: string | null;
  fork_repo: string | null;
  fork_html_url: string | null;
  fork_branch: string | null;
  render_service_id: string | null;
  deployed_url: string | null;
  provision_error: string | null;
}): RunRecord {
  return {
    id: r.id,
    taskRunId: r.task_run_id,
    owner: r.owner,
    repo: r.repo,
    ref: r.ref,
    createdAt: r.created_at.toISOString(),
    provisionState: r.provision_state,
    provisionSkipReason: r.provision_skip_reason,
    forkOwner: r.fork_owner,
    forkRepo: r.fork_repo,
    forkHtmlUrl: r.fork_html_url,
    forkBranch: r.fork_branch,
    renderServiceId: r.render_service_id,
    deployedUrl: r.deployed_url,
    provisionError: r.provision_error,
  };
}

export class PostgresRunStore implements RunStore {
  constructor(private readonly sql: ReturnType<typeof postgres>) {}

  async create(data: {
    taskRunId: string;
    owner: string;
    repo: string;
    ref: string;
  }): Promise<RunRecord> {
    const rows = await this.sql<
      {
        id: string;
        task_run_id: string;
        owner: string;
        repo: string;
        ref: string;
        created_at: Date;
        provision_state: string | null;
        provision_skip_reason: string | null;
        fork_owner: string | null;
        fork_repo: string | null;
        fork_html_url: string | null;
        fork_branch: string | null;
        render_service_id: string | null;
        deployed_url: string | null;
        provision_error: string | null;
      }[]
    >`
      INSERT INTO analysis_runs (task_run_id, owner, repo, ref)
      VALUES (${data.taskRunId}, ${data.owner}, ${data.repo}, ${data.ref})
      RETURNING id, task_run_id, owner, repo, ref, created_at,
        provision_state, provision_skip_reason,
        fork_owner, fork_repo, fork_html_url, fork_branch,
        render_service_id, deployed_url, provision_error
    `;
    return mapRow(rows[0]);
  }

  async getById(id: string): Promise<RunRecord | null> {
    const rows = await this.sql<
      {
        id: string;
        task_run_id: string;
        owner: string;
        repo: string;
        ref: string;
        created_at: Date;
        provision_state: string | null;
        provision_skip_reason: string | null;
        fork_owner: string | null;
        fork_repo: string | null;
        fork_html_url: string | null;
        fork_branch: string | null;
        render_service_id: string | null;
        deployed_url: string | null;
        provision_error: string | null;
      }[]
    >`
      SELECT id, task_run_id, owner, repo, ref, created_at,
        provision_state, provision_skip_reason,
        fork_owner, fork_repo, fork_html_url, fork_branch,
        render_service_id, deployed_url, provision_error
      FROM analysis_runs WHERE id = ${id}::uuid LIMIT 1
    `;
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async tryBeginProvision(id: string): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      UPDATE analysis_runs
      SET provision_state = 'running'
      WHERE id = ${id}::uuid AND provision_state IS NULL
      RETURNING id
    `;
    return rows.length > 0;
  }

  async markProvisionSkipped(
    id: string,
    reason: ProvisionSkipReason
  ): Promise<void> {
    await this.sql`
      UPDATE analysis_runs
      SET provision_state = 'skipped',
          provision_skip_reason = ${reason}
      WHERE id = ${id}::uuid AND provision_state IS NULL
    `;
  }

  async updateForkMeta(
    id: string,
    meta: {
      forkOwner: string;
      forkRepo: string;
      forkHtmlUrl: string;
    }
  ): Promise<void> {
    await this.sql`
      UPDATE analysis_runs
      SET fork_owner = ${meta.forkOwner},
          fork_repo = ${meta.forkRepo},
          fork_html_url = ${meta.forkHtmlUrl}
      WHERE id = ${id}::uuid
    `;
  }

  async updateForkBranch(id: string, branch: string): Promise<void> {
    await this.sql`
      UPDATE analysis_runs
      SET fork_branch = ${branch}
      WHERE id = ${id}::uuid
    `;
  }

  async setRenderServiceId(id: string, serviceId: string): Promise<void> {
    await this.sql`
      UPDATE analysis_runs
      SET render_service_id = ${serviceId}
      WHERE id = ${id}::uuid
    `;
  }

  async completeProvisionDone(id: string, deployedUrl: string): Promise<void> {
    await this.sql`
      UPDATE analysis_runs
      SET provision_state = 'done',
          deployed_url = ${deployedUrl},
          provision_error = NULL
      WHERE id = ${id}::uuid
    `;
  }

  async failProvision(id: string, message: string): Promise<void> {
    await this.sql`
      UPDATE analysis_runs
      SET provision_state = 'failed',
          provision_error = ${message}
      WHERE id = ${id}::uuid
    `;
  }
}
