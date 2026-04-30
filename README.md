# Repo Blueprint Assistant

Public GitHub URL in: scan the repo with **Render Workflows**, surface **`render.yaml`** if it exists, or generate a starter blueprint from the tree (including workspace fan-out when relevant).

Design notes from initial scaffolding: [`DESIGN.md`](DESIGN.md).

## Table of contents

- [Highlights](#highlights)
- [What happens when you analyze](#what-happens-when-you-analyze)
- [Try it](#try-it)
- [Automatic fork and deploy](#automatic-fork-and-deploy)
- [Manual publish (optional branch push)](#manual-publish-optional-branch-push)
- [HTTP API](#http-api)
- [Deploy on Render](#deploy-on-render)
- [Configuration](#configuration)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)
- [Local development](#local-development)
- [Project layout](#project-layout)

## Highlights

- **Express** JSON API (`ok` / `error` envelope) + static UI (polls run status).
- **Render Workflows** task `analyze_repository`: GitHub REST snapshot (no full clone), detect or generate YAML, validate.
- **Postgres** stores each run; **`GET /api/runs/:id`** merges workflow status with optional **provision** state (fork URL, deploy URL).
- **Optional:** fork repo under your PAT → push YAML → **Render REST** creates a web service (when env is set).
- **Optional:** **`POST /api/publish`** pushes YAML to a **new branch on the repo you analyzed** (needs push access to that repo).
- **Kill switches:** `ANALYSIS_ENABLED=false`, `BLUEPRINT_PUBLISH_ENABLED=false`, `AUTO_DEPLOY_ENABLED=false`.

## What happens when you analyze

1. **`POST /api/runs`** resolves owner/repo, default branch, starts **`{WORKFLOW_SLUG}/analyze_repository`**, saves a row in Postgres.
2. The workflow walks the repo via GitHub API, optionally detects **`render.yaml`**, otherwise builds inventory and **generates** YAML.
3. The UI polls **`GET /api/runs/:runId`** until the task is terminal. You see pipeline timing when present, then YAML output.

After that, behavior splits:

| Outcome | What you see next |
|--------|-------------------|
| **Existing `render.yaml`** | Raw YAML; fork/deploy is **skipped** (`provision.skipReason`: `existing_blueprint`). |
| **Generated YAML** | Generated file in the UI. If **auto-deploy** env is set: background **fork → push branch → create Render service → live URL** in **`provision`**. If not: **`provision`** explains skip (missing owner id, token, etc.). |
| **Manual publish** | Separate button calling **`POST /api/publish`**: pushes to a branch on **the same owner/repo you analyzed**, only if your **`GITHUB_TOKEN`** can push there. |

The UI updates every few seconds (HTTP polling), not a live WebSocket stream.

## Try it

1. Open your deployed web URL.
2. Enter `https://github.com/owner/repo` or `owner/repo`.
3. Wait for **Run status** to finish. Inspect **Pipeline** timings and **`render.yaml`** when shown.
4. If **Fork & deploy** appears: it tracks automatic fork + Render service creation when enabled.
5. **Push render.yaml to new branch** only if you use manual publish and your token has rights to that repo (see below).

## Automatic fork and deploy

Runs only when the workflow result is **`generated`** (no existing blueprint in repo) and env allows it.

Rough sequence: GitHub **fork** (or reuse same-named repo under the PAT user) → **contents API** push to branch `assistant/bpa-…` → **`POST /v1/services`** with build/start from YAML → poll deploy until **live** → persist **`deployed_url`**.

Code: `src/app/provision/run-provision.ts`, `src/infra/github-http-fork.ts`, `src/infra/render-http-deploy.ts`.

**Needs:** `GITHUB_TOKEN`, `RENDER_API_KEY`, **`RENDER_OWNER_ID`** (workspace id `tea-…`), and **`AUTO_DEPLOY_ENABLED`** not `false`. The GitHub account behind the token should be **linked to Render** so the new service can build from that fork.

## Manual publish (optional branch push)

Different from fork/deploy: **`POST /api/publish`** targets **owner/repo/ref from the analyze request** (the upstream URL you pasted), not necessarily the fork.

**Requirements:** **`BLUEPRINT_PUBLISH_ENABLED`** and a **`GITHUB_TOKEN`** with **Contents: Read and write** on repos you push to. Fine-grained PAT: set resource owner, avoid **Public repositories**-only mode for writes, add **Contents** Read and write. Classic PAT: **`repo`** scope.

**Third-party repos** you do not own: publish usually returns **403** or GitHub may return **404** on write APIs. That is expected unless that repo grants your user push access.

If you only need scanning: set **`BLUEPRINT_PUBLISH_ENABLED=false`** or omit publish usage.

## HTTP API

Success: `{ "ok": true, "data": ... }`. Errors: `{ "ok": false, "error": { "code", "message" } }`.

| Method | Path | Body | `data` |
|--------|------|------|--------|
| `GET` | `/health` | — | `{ "status": "ok" }` |
| `GET` | `/api/meta` | — | `publicGithubRepo`, signup URLs (UTMs), `publishAvailable`, `autoDeployConfigured` |
| `POST` | `/api/runs` | `{ "repoUrl": string }` | `runId`, `taskRunId`, `owner`, `repo`, `ref` |
| `GET` | `/api/runs/:runId` | — | `record`, `workflow`, `provision` |
| `POST` | `/api/publish` | `owner`, `repo`, `yaml`, optional `path`, `branch`, `baseBranch` | `branch`, `htmlUrl` |

Example:

```http
POST /api/runs
Content-Type: application/json

{"repoUrl":"https://github.com/owner/public-repo"}
```

## Deploy on Render

1. Host this repository on GitHub.
2. **Blueprint:** deploy [`render.yaml`](render.yaml) (web service + Postgres).
3. **Workflow service:** Blueprints cannot declare Workflow services yet. Create one with **[Render CLI 2.16+](https://render.com/docs/cli#1-install-or-upgrade)** (`render workflows create`) or **[Dashboard → New → Workflow](https://dashboard.render.com/new)** on the **same repo**.

   Example CLI (replace repo URL and workspace):

   ```bash
   render login
   render workspace set <your-workspace>
   render workflows create \
     --name repo-blueprint-assistant-wf \
     --repo https://github.com/<you>/repo-blueprint-assistant \
     --branch main \
     --runtime node \
     --build-command "npm run workflow:build" \
     --run-command "npm run workflow:start" \
     --region oregon \
     --confirm -o json
   ```

   Shortcut after login: `npm run workflow:render:create` (see [`scripts/create-workflow-on-render.sh`](scripts/create-workflow-on-render.sh)).

   Use **`render workflows create`**, not **`render services create`**: the latter does not create Workflow services.

   Dashboard checklist: repository root (blank root dir), build `npm run workflow:build`, start `npm run workflow:start`, entry **`dist/workflow/entry.js`**. Prefer **standard** plan or higher for heavy repos ([workflow limits](https://render.com/docs/workflows-limits)).

4. Web service env: **`WORKFLOW_SLUG`** (exact slug used before `/analyze_repository`), **`RENDER_API_KEY`**, **`GITHUB_TOKEN`** (recommended), **`PUBLIC_GITHUB_REPO`**, plus fork/deploy vars if you use auto-deploy (see [Configuration](#configuration)).
5. Workflow service env: **`GITHUB_TOKEN`** recommended for GitHub API rate limits.

### Verify workflows locally

Needs [Render CLI](https://render.com/docs/cli-glossary) **2.11+**.

```bash
npm run workflow:build
render workflows dev -- node dist/workflow/entry.js
# Other terminal:
render workflows tasks list --local
```

Confirm **`analyze_repository`** is listed. Web calls **`{WORKFLOW_SLUG}/analyze_repository`**. See [Intro to Render Workflows](https://render.com/docs/workflows).

## Configuration

| Variable | Where | Purpose |
|----------|------|---------|
| `DATABASE_URL` | Web | Postgres connection (Blueprint `fromDatabase`) |
| `RENDER_API_KEY` | Web | Render API (workflows + REST deploy); may be empty until Dashboard sync |
| `WORKFLOW_SLUG` | Web | Must match workflow service slug; used as `{slug}/analyze_repository` |
| `GITHUB_TOKEN` | Web, Workflow | Higher GitHub rate limits; fork/publish need appropriate scopes |
| `PUBLIC_GITHUB_REPO` | Web | Header link to this app’s GitHub repo |
| `ANALYSIS_ENABLED` | Web | Set `false` to disable `POST /api/runs` |
| `BLUEPRINT_PUBLISH_ENABLED` | Web | Set `false` to disable `POST /api/publish` |
| `RENDER_OWNER_ID` | Web | Workspace id (`tea-…`) for `POST /v1/services` (fork deploy) |
| `AUTO_DEPLOY_ENABLED` | Web | Set `false` to disable fork + automatic service creation |
| `RENDER_DEPLOY_REGION` | Web | Region for created services (default `oregon`) |
| `RENDER_DEPLOY_PLAN` | Web | Plan slug for created services (default `starter`) |
| `RENDER_USE_LOCAL_DEV` | Web | `true` to use local CLI workflow server |
| `RENDER_LOCAL_DEV_URL` | Web | Default `http://localhost:8120` |
| `RENDER_API_URL` | Web | Override `https://api.render.com` if needed |
| `GITHUB_REST_API_VERSION` | Both | GitHub REST API version header |
| `GITHUB_HTTP_TIMEOUT_MS` | Both | Default `15000` |
| `LOG_LEVEL` | Web | Pino level |

## Operations

- **Logs:** Render Dashboard → service → Logs.
- **Health checks:** `GET /health`.

### Workflow missing in the Dashboard

- Create with **`render workflows create`** (CLI **2.16+**) or **New → Workflow**.
- **HIPAA workspaces:** new Workflow services may be blocked ([beta limitations](https://render.com/docs/workflows#beta-limitations)); use a non-HIPAA workspace or another compute type.

## Troubleshooting

**Publish returns 403 / 404 when pushing YAML**

The token cannot write **that** `owner/repo`, or GitHub hides forbidden repos behind **404**. Confirm fine-grained **Contents** Read and write on the correct resource owner. Third-party repos need explicit collaborator access.

**Fork & deploy never runs**

Check **`provision`** on **`GET /api/runs/:id`**: `skipReason` lists cases such as **`existing_blueprint`**, **`no_render_owner`**, **`no_github_token`**, **`auto_deploy_disabled`**. **`/api/meta`** exposes **`autoDeployConfigured`** when owner id, token, API key, and auto-deploy line up.

**Workflow stays `paused` in API briefly**

The UI keeps polling until terminal status and results; see workflow task run in the Render Dashboard if stuck longer than expected.

## Local development

Requires **`DATABASE_URL`** (local Postgres is fine).

```bash
npm ci
npm run build
DATABASE_URL=postgres://... RENDER_API_KEY=... WORKFLOW_SLUG=... npm start
```

Workflow tasks via CLI (default **8120**):

```bash
npm run build
render workflows dev -- node dist/workflow/entry.js
```

Point the web app at the local workflow server (SDK still wants an API key string):

```bash
export RENDER_USE_LOCAL_DEV=true
export RENDER_LOCAL_DEV_URL=http://localhost:8120
npm start
```

Or iterate with **`npm run workflow:dev`**.

## Project layout

| Path | Role |
|------|------|
| `src/app/` | Express routes, middleware |
| `src/app/provision/` | Fork + push + Render service create |
| `src/ports/` | Interfaces |
| `src/infra/` | GitHub read/publish/fork, Render workflows + REST deploy, Postgres |
| `src/workflow/` | Workflow tasks (`npm run workflow:start`) |
| `src/domain/` | Pure helpers, API envelope |
| `public/` | Static UI, `api.js` client |

## License

Add a license file when publishing publicly.
