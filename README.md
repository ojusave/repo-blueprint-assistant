# Repo Blueprint Assistant

Scan a **public** GitHub repo with **Render Workflows**: detect `render.yaml`, or generate a starter Blueprint with **fan-out** over npm workspace roots.

**Design approval:** see [`DESIGN.md`](DESIGN.md) (Coding Agent Template steps **(a)–(e)** before implementation).

## Highlights

- **Express** API with a consistent JSON envelope (`ok` / `error`).
- **Ports + adapters** for GitHub REST, Render Workflow triggers, and Postgres run metadata.
- **Render Postgres** stores run rows (`runId` UUID); polling merges Dashboard workflow status.
- **`render.yaml`** + **manual preview** (`previews.generation: manual`, opt-in with `[render preview]` on PRs).
- **Kill switch:** `ANALYSIS_ENABLED=false`.

## Overview

Operators deploy the **web** service from Blueprint, then attach a **Workflow** service (Dashboard) because Workflow is **not** in Blueprint yet. Attendees paste `owner/repo`; the UI receives a **run id**, polls `/api/runs/:runId`, and renders YAML when generation succeeds.

## Usage (product)

1. Open the deployed site.
2. Enter `https://github.com/owner/repo` or `owner/repo`.
3. Wait for polling to finish; copy YAML or read validation notes.

## HTTP API

All successful bodies wrap as `{ "ok": true, "data": ... }`. Errors: `{ "ok": false, "error": { "code", "message" } }`.

| Method | Path | Body | Response `data` |
|--------|------|------|-------------------|
| `GET` | `/health` | — | `{ "status": "ok" }` |
| `GET` | `/api/meta` | — | Signup URLs (Ojus UTMs), `publicGithubRepo` |
| `POST` | `/api/runs` | `{ "repoUrl": string }` | `{ runId, taskRunId, owner, repo, ref }` |
| `GET` | `/api/runs/:runId` | — | `{ record, workflow }` |

Example:

```http
POST /api/runs
Content-Type: application/json

{"repoUrl":"https://github.com/vercel/next.js"}
```

## Deploy on Render

1. Push this repo to GitHub.
2. **Blueprint:** connect repo → deploy [`render.yaml`](render.yaml) (web + Postgres).
3. **Workflow** ([Workflows are not in Blueprints yet](https://render.com/docs/workflows)): **New → Workflow** → link **the same repo**.
   - **Root Directory:** leave **blank** (repository root). Task entry is `dist/workflow/entry.js` after root-level `npm run build`.
   - **Build:** `npm ci && npm run build`
   - **Start:** `npm run workflow:start`
4. Set web env: **`WORKFLOW_SLUG`** (must match the Workflow service slug in the Dashboard exactly), **`RENDER_API_KEY`**, optional **`GITHUB_TOKEN`**, **`PUBLIC_GITHUB_REPO`** (this repo URL).
5. Workflow env: **`GITHUB_TOKEN`** recommended for GitHub API rate limits.

### Verify workflows locally

Requires [Render CLI](https://render.com/docs/cli-glossary) **2.11.0+** (`render --version`). Greenfield setups often start with `render workflows init`; this repo matches that layout manually.

```bash
npm ci && npm run build
render workflows dev -- npm run workflow:dev
# Other terminal:
render workflows tasks list --local
```

Confirm **`analyze_repository`** (and related tasks) appear. See [Intro to Render Workflows](https://render.com/docs/workflows) if a task is missing.

## Configuration

| Variable | Service | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Web | From Blueprint `fromDatabase` |
| `RENDER_API_KEY` | Web | Invoke Render API (can be empty until set in Dashboard; app still starts) |
| `WORKFLOW_SLUG` | Web | e.g. `my-workflow` (same: optional until Workflow service exists) |
| `GITHUB_TOKEN` | Web + Workflow | Higher GitHub rate limits |
| `PUBLIC_GITHUB_REPO` | Web | Header + footer GitHub links |
| `ANALYSIS_ENABLED` | Web | `"false"` disables `POST /api/runs` |
| `RENDER_API_URL` | Web | Local workflow dev only |
| `GITHUB_HTTP_TIMEOUT_MS` | Both | Default `15000` |
| `LOG_LEVEL` | Web | Pino level |

## Operations

- Logs: Dashboard → service → **Logs**.
- Health: `/health` for Blueprint checks.

## Local development

Needs **`DATABASE_URL`** (e.g. local Postgres).

```bash
npm ci
npm run build
DATABASE_URL=postgres://... RENDER_API_KEY=... WORKFLOW_SLUG=... npm start
```

Workflow locally:

```bash
render workflows dev -- npm run workflow:dev
```

Set **`RENDER_API_URL=http://localhost:8090`** on the web process when using the local workflow server.

## Project layout

- `src/app/` — Express routes, middleware.
- `src/ports/` — Interfaces.
- `src/infra/` — Adapters (GitHub, Render workflows, Postgres).
- `src/workflow/` — Task definitions (`npm run workflow:start`).
- `src/domain/` — Pure helpers + envelope types.
- `public/` — Static UI + **`api.js`** (single API client).

## License

Add a license file when publishing.
