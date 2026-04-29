import postgres from "postgres";
import type { RunRecord, RunStore } from "../ports/run.store.js";

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
      }[]
    >`
      INSERT INTO analysis_runs (task_run_id, owner, repo, ref)
      VALUES (${data.taskRunId}, ${data.owner}, ${data.repo}, ${data.ref})
      RETURNING id, task_run_id, owner, repo, ref, created_at
    `;
    const r = rows[0];
    return {
      id: r.id,
      taskRunId: r.task_run_id,
      owner: r.owner,
      repo: r.repo,
      ref: r.ref,
      createdAt: r.created_at.toISOString(),
    };
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
      }[]
    >`
      SELECT id, task_run_id, owner, repo, ref, created_at
      FROM analysis_runs WHERE id = ${id}::uuid LIMIT 1
    `;
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      taskRunId: r.task_run_id,
      owner: r.owner,
      repo: r.repo,
      ref: r.ref,
      createdAt: r.created_at.toISOString(),
    };
  }
}
