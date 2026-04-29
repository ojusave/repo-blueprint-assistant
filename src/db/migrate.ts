import type postgres from "postgres";

/** Idempotent schema for Render Postgres. */
export async function migrate(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_run_id TEXT NOT NULL UNIQUE,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      ref TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
