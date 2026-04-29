# Repo Blueprint Assistant — design approval (Coding Agent Template)

This document satisfies **step 1** of the template: **(a)–(e)** before implementation. **Implementation proceeds only after this document exists** (repo creation).

---

## (a) Stack proposal

Major decisions (candidates → **pick** → reason):

| Area | Options | Pick | Reason |
|------|---------|------|--------|
| Language | TypeScript, Python | **TypeScript** | Matches Render Workflows SDK support and CascadiaJS audience; shared types for API + UI contracts. |
| Web framework | Express, Fastify, Hono | **Express** | Workspace default; SSE-friendly; boring ops story on Render. |
| Persistence | Render Postgres + `pg`, Drizzle + Postgres, SQLite | **Render Postgres + `pg`** | Template rule: relational data on Render Postgres before external DBs; minimal ORM surface for run metadata. |
| Validation | Zod, Valibot, none | **Zod** | Boundary validation for HTTP bodies and env; one schema per route. |
| Auth | None (public repo only), GitHub OAuth | **None for v1** | Stated product scope: public repos only; no user GitHub login. |
| Frontend | Static HTML + vanilla TS client, React SPA | **Static assets + single `api.ts` client** | Template asks one API client; no SPA framework needed for one screen. |
| Workflow orchestration | Render Workflows, Temporal, queues | **Render Workflows** | Template rule: durable steps + retries on Render before external orchestrators. |
| Observability | Pino, Winston, console JSON | **Pino** | Structured logs on Render without heavy ceremony. |
| Testing | Vitest, Node test runner | **Vitest** | Fits TypeScript; fast unit tests for domain + adapters with mocks. |
| Lint/format | ESLint + Prettier | **ESLint 9 flat + Prettier** | Ecosystem default; CI-ready. |

---

## (b) Render service discovery (fresh docs, 2026)

From [Service types](https://render.com/docs/service-types) and related docs, Render currently exposes:

**Compute / routing**

- Web services (HTTP, public URL)
- Static sites (CDN static assets)
- Private services (internal hostname, private network)
- Background workers (long-running, no inbound HTTP)
- Cron jobs (scheduled exit)
- **Workflow** (beta): distributed task runs, chaining, retries

**Data**

- **Render Postgres** (managed PostgreSQL)
- **Render Key Value** (Redis-compatible cache/queue)

**Other primitives** (referenced in docs ecosystem)

- Blueprints (`render.yaml`) for IaC
- Environment groups
- Persistent disks (attach to eligible service types)
- Private network between services in same region

**External services**

- **GitHub.com API**: Not offered by Render. **Considered:** N/A as a Render primitive. **Use:** HTTPS `fetch` from workflow tasks and optional PAT `GITHUB_TOKEN`.

**Mapping app → Render**

| Component | Render primitive | Notes |
|-----------|------------------|--------|
| Browser UI | Static assets served by **web service** (or could be **static site** + CORS) | Single **web** keeps one origin for API + DDS CSS proxy; simpler for workshop. |
| HTTP API | **Web service** | Express, `/health`, `/api/*`. |
| Run metadata (task id, repo, timestamps) | **Render Postgres** | Durable cross-instance; template prefers Postgres over skip. |
| Multi-step analysis + fan-out | **Workflow** (beta) | Not representable in Blueprint today; **second service** created in Dashboard; same repo, `npm run workflow:start`. |
| Cache / queue | **Key Value** | **Not used in v1:** single-pass workflow + Postgres sufficient; add later if GitHub rate limits require cache-by-SHA. |
| Cron | **Cron job** | **Not used:** analysis is on-demand only. |
| Background worker | **Worker** | **Not used:** Workflows replace long HTTP work. |

**Private network:** Web service triggers Workflow via **Render API** (authenticated); traffic can use platform routing as documented; no third-party VPC.

**Preview environments:** [Preview environments](https://render.com/docs/preview-environments) require **Pro+**; Blueprint supports `previews.generation`. We add **`previews.generation: manual`** so PRs opt-in with `[render preview]` (cost-aware).

---

## (c) Folder structure and key files

```
repo-blueprint-assistant/
  DESIGN.md                 # This approval doc
  render.yaml               # Blueprint: web + Postgres + previews
  package.json
  tsconfig.json
  eslint.config.js
  vitest.config.ts
  src/
    config/
      env.ts                # Zod-validated env (composition inputs)
    ports/
      read-github-repo.ts           # Port: tree + file + default branch (read)
      publish-github-branch.ts      # Port: push blueprint YAML to a branch (write)
      render-workflow-client.ts     # Port: startTask, getTaskRun
      analysis-run-store.ts        # Port: persist analysis run rows (Postgres)
    infra/
      github-http-read.ts           # Adapter: GitHub REST read + timeouts
      github-http-publish.ts        # Adapter: GitHub REST branch + contents write
      github-api-version.ts         # Shared REST API calendar version header
      render-workflows-client.ts    # Adapter: @renderinc/sdk Render.workflows
      postgres-analysis-runs.ts     # Adapter: RunStore via postgres.js
      workflow-github-registry.ts   # Singleton GitHub reader for workflow worker only
    domain/
      mergeInventory.ts
      parseRepoUrl.ts
      pipeline-step-timer.ts # Wall-clock steps for pipeline UI
      apiEnvelope.ts        # { ok, data?, error? }
    contracts/
      analyze-repository-types.ts  # AnalyzeResult + inventory shared by workflow + HTTP
    workflow/
      entry.ts              # Registers tasks
      tasks/
        *.ts                # Tasks call ports via workflow-github-registry only
    app/
      server.ts             # Express composition root (web)
      routes/
        health.ts
        meta.ts
        repo-analysis.routes.ts   # POST /api/runs, GET /api/runs/:id
        publish-blueprint.routes.ts # POST /api/publish
      middleware/
        errorHandler.ts
    db/
      migrate.ts            # CREATE TABLE IF NOT EXISTS on boot
  public/
    index.html
    styles.css
    api.js                  # Browser fetch helper + app.js UI
  scripts/
    lint-staged optional
```

**Cross-import rule:** `app/` and `workflow/` import **ports** through **`workflow-github-registry`** (workflow only) or **constructor injection** (web); **`infra/*` does not import `app/`**. Domain is pure (no IO).

---

## (d) `render.yaml` sketch

```yaml
# previews: Pro plan required — manual mode limits surprise billing
previews:
  generation: manual

databases:
  - name: blueprint-assistant-db
    plan: basic-256mb   # adjust per workspace needs

services:
  - type: web
    name: blueprint-assistant-web
    runtime: node
    plan: starter
    buildCommand: npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /health
    previews:
      plan: starter
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: blueprint-assistant-db
          property: connectionString
      - key: RENDER_API_KEY
        sync: false
      - key: WORKFLOW_SLUG
        sync: false
      - key: GITHUB_TOKEN
        sync: false
      - key: PUBLIC_GITHUB_REPO
        sync: false
      - key: ANALYSIS_ENABLED
        value: "true"
```

**Workflow service (Dashboard, same repo):**

- Build: `npm ci && npm run build`
- Start: `npm run workflow:start`
- Env: `GITHUB_TOKEN`, `DATABASE_URL` (optional same DB if tasks write later), secrets as needed

Not in YAML until Blueprint supports Workflow type.

---

## (e) Dependencies and ports

| Module / dependency | Port interface | Implementation | On failure | Critical? |
|---------------------|----------------|----------------|------------|-----------|
| GitHub REST | `GitHubRepository` | `GitHubRestAdapter` | Throw typed `AppError` → HTTP 502 / workflow error result | **Yes** for analysis path |
| Render Workflows API | `WorkflowTrigger` | `RenderWorkflowAdapter` | `AppError` / 503 if misconfigured | **Yes** to start runs |
| Postgres | `RunStore` | `PostgresRunStore` | 503 if DB down on write; log | **Yes** for persistence |
| YAML parse | N/A (stdlib `yaml`) | inline in validate task | validation errors non-throwing | Yes for correctness |
| `@renderinc/sdk` workflows | Inside Workflow adapter boundary only on web; tasks use SDK task API | N/A | — | — |
| `pino` logger | `Logger` port (optional thin wrapper) | `pino` implementation | never throws | Non-critical |

**Feature flag:** `ANALYSIS_ENABLED=false` → API returns structured error without calling workflow (**kill switch**, template).

**Fake implementations (tests):** `FakeGithubRepository`, `FakeWorkflowTrigger`, `FakeRunStore` in `src/test-utils/`.

---

## Approval

This design was produced **before** application code in this repository. Proceeding to implementation is authorized by filling this repo (`DESIGN.md` present + implementation follows it).
