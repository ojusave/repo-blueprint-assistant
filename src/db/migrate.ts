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
  await sql`ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS provision_state TEXT`;
  await sql`ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS provision_skip_reason TEXT`;
  await sql`ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS fork_owner TEXT`;
  await sql`ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS fork_repo TEXT`;
  await sql`ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS fork_html_url TEXT`;
  await sql`ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS fork_branch TEXT`;
  await sql`ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS render_service_id TEXT`;
  await sql`ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS deployed_url TEXT`;
  await sql`ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS provision_error TEXT`;
}
