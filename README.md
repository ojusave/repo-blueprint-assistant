# Repo Blueprint Assistant

**Scan a public GitHub repo with Render Workflows:** find `render.yaml` or generate a starter blueprint from the repository tree (workspace fan-out when relevant). Ships as an Express API plus a static UI that polls run status.

**Repo:** [github.com/ojusave/repo-blueprint-assistant](https://github.com/ojusave/repo-blueprint-assistant) · **Blueprint:** [`render.yaml`](render.yaml) · **Deploy:** [Render docs](https://render.com/docs/deploy-to-render-button)

---

## Table of contents

- [Highlights](#highlights)
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
- [Deploy on Render](#deploy-on-render)
- [Configuration](#configuration)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)
- [Developing locally](#developing-locally)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Highlights

- **Workflow-backed analysis:** `analyze_repository` walks the repo via **GitHub REST** (snapshot, not a full clone), detects existing YAML or **generates** and **validates** a scaffold.
- **Express + Postgres:** each analyze gets a durable row; **`GET /api/runs/:id`** returns workflow status plus optional **provision** metadata (fork URL, deploy URL).
- **Optional fork → live URL:** after a **generated** blueprint, the server can fork under your PAT, push `render.yaml`, create a **Render web service** via REST, and record the public URL (env-dependent).
- **Optional manual push:** **`POST /api/publish`** opens a branch on **the repo you analyzed** if your token has push access (different from fork/deploy).
- **Kill switches:** `ANALYSIS_ENABLED`, `BLUEPRINT_PUBLISH_ENABLED`, `AUTO_DEPLOY_ENABLED`.

Design history for this codebase lives in [`DESIGN.md`](DESIGN.md).

---

## Overview

This project is for **operators** who already use Render and want a concrete sample of **Workflows** plus a thin web UI: paste a URL, wait for the task run, read YAML output. **Contributors** extend tasks under `src/workflow/` or adapters under `src/infra/`.

After **`POST /api/runs`**, the Render Workflow task **`{WORKFLOW_SLUG}/analyze_repository`** runs with `{ owner, repo, ref }`. If the repo already defines blueprint YAML, the UI shows it and skips automatic fork/deploy. If not, the workflow generates YAML; the UI may then show **Fork & deploy** when server-side provisioning is enabled and credentials allow it. Updates arrive through **HTTP polling** (a few seconds between refreshes), not streaming sockets.

---

## Prerequisites

- **Node.js 20+** for build and tests.
- **Render account** and a GitHub repository hosting this code.
- **Second Render service** of type **Workflow** (Blueprint cannot define it yet): same repo, build/start commands as documented below.

---

## Usage

### Web UI (after deploy)

1. Open your Render web URL for this service.
2. Enter `https://github.com/owner/repo` or `owner/repo`, submit **Analyze**.
3. Wait for **Run status** to finish. Inspect **Pipeline** timings and **`render.yaml`** when shown.
4. If **Fork & deploy** appears, provisioning is running or finished; check **`provision`** on the API response or the panel message.
5. **Push render.yaml to new branch** only when you use manual publish and your **`GITHUB_TOKEN`** can push to **that** upstream repo (see [Troubleshooting](#troubleshooting)).

### API (minimal)

Responses use `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

```http
POST /api/runs
Content-Type: application/json

{"repoUrl":"https://github.com/owner/repo"}
```

Poll **`GET /api/runs/<uuid>`** until workflow status is terminal; response includes **`workflow`** and **`provision`**.

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Load balancer / Blueprint health |
| `GET /api/meta` | Repo link, signup URLs with UTMs, `publishAvailable`, `autoDeployConfigured` |
| `POST /api/runs` | Start analysis |
| `GET /api/runs/:runId` | Poll workflow + provision |
| `POST /api/publish` | Push YAML to a new branch (manual path) |

---

## Deploy on Render

Goal: **web service** from Blueprint + **Workflow service** from CLI or Dashboard.

1. **Push** this repository to GitHub (fork or clone under your org).

2. **Create resources from Blueprint:** connect the repo and deploy **[`render.yaml`](render.yaml)**. That provisions **Postgres** and the **web** service.

3. **Create the Workflow service** (not expressible in Blueprint today):

   - **CLI** ([install Render CLI 2.16+](https://render.com/docs/cli#1-install-or-upgrade)): `render workflows create` with this repo, `npm run workflow:build`, `npm run workflow:start`. Helper: **`npm run workflow:render:create`** after `render login` (see [`scripts/create-workflow-on-render.sh`](scripts/create-workflow-on-render.sh)).
   - **Dashboard:** [New → Workflow](https://dashboard.render.com/new), same repository URL, empty root directory, build **`npm run workflow:build`**, start **`npm run workflow:start`**, entry **`dist/workflow/entry.js`**.

   Use **`render workflows create`**, not **`render services create`**: only the former creates Workflow services.

4. **Wire the web service environment:** set **`WORKFLOW_SLUG`** to the slug that prefixes **`analyze_repository`** (copy from the Workflow service or `render workflows list -o json`). Set **`RENDER_API_KEY`**, **`GITHUB_TOKEN`** (recommended on both web and workflow for rate limits), **`PUBLIC_GITHUB_REPO`**, and fork/deploy variables from [Configuration](#configuration) if you use automatic deploy.

5. **Redeploy or restart** the web service after secrets sync.

Further detail: [Intro to Render Workflows](https://render.com/docs/workflows), [workflow limits](https://render.com/docs/workflows-limits).

---

## Configuration

| Variable | Default / notes | If missing or wrong |
|----------|-----------------|----------------------|
| `DATABASE_URL` | From Blueprint `fromDatabase` | Web cannot migrate or save runs |
| `RENDER_API_KEY` | Optional at first boot (`sync: false`) | Cannot start or poll workflows |
| `WORKFLOW_SLUG` | Must match Workflow service | Workflow calls fail or hit wrong task |
| `GITHUB_TOKEN` | Recommended | Lower GitHub rate limits; fork/publish need scopes |
| `PUBLIC_GITHUB_REPO` | Falls back to this repo URL | Wrong header link |
| `ANALYSIS_ENABLED` | true unless `false` | `POST /api/runs` returns 503 |
| `BLUEPRINT_PUBLISH_ENABLED` | true unless `false` | `POST /api/publish` disabled |
| `RENDER_OWNER_ID` | Workspace id `tea-…` | Cannot call `POST /v1/services` for fork deploy |
| `AUTO_DEPLOY_ENABLED` | true unless `false` | No fork + automatic web service |
| `RENDER_DEPLOY_REGION` | `oregon` | Used when creating services |
| `RENDER_DEPLOY_PLAN` | `starter` | Used when creating services |
| `RENDER_API_URL` | `https://api.render.com` | Advanced override only |
| `RENDER_USE_LOCAL_DEV` | unset | Set `true` with CLI `render workflows dev` |
| `RENDER_LOCAL_DEV_URL` | `http://localhost:8120` | Local workflow dev URL |
| `GITHUB_HTTP_TIMEOUT_MS` | `15000` | HTTP timeouts for GitHub adapters |
| `LOG_LEVEL` | info | Pino verbosity |

---

## Operations

- **Logs:** Render Dashboard → service → **Logs** (web and workflow separately).
- **Health:** Blueprint uses **`GET /health`** on the web service.
- **HIPAA workspaces:** creating **new** Workflow services may be blocked; see [Workflow beta limitations](https://render.com/docs/workflows#beta-limitations).

---

## Troubleshooting

**Manual publish returns 403 or 404**

GitHub often returns **404** when the token cannot write **`owner/repo`**. Fine-grained PATs need **Contents: Read and write** on the right resource owner; avoid **Public repositories**-only mode for pushes. Third-party repos need collaborator access to your token user.

**Fork & deploy never appears or stays skipped**

Inspect **`GET /api/runs/:id`** → **`provision.skipReason`**. Common values: **`existing_blueprint`**, **`no_render_owner`**, **`no_github_token`**, **`auto_deploy_disabled`**. **`GET /api/meta`** exposes **`autoDeployConfigured`** when owner id, token, API key, and auto-deploy align.

**Workflow API shows `paused` briefly**

The UI keeps polling until the task reaches a terminal status with results. Compare with the Workflow run in the Render Dashboard if status stalls.

---

## Developing locally

Requires **`DATABASE_URL`** (local Postgres is enough). The Render SDK still expects a **non-empty `RENDER_API_KEY` string** at startup even when pointing workflows at a local CLI server.

```bash
npm ci
npm run build
DATABASE_URL=postgres://user:pass@localhost:5432/db \
  RENDER_API_KEY=your-api-key \
  WORKFLOW_SLUG=your-workflow-slug \
  npm start
```

Workflow task development:

```bash
npm run build
render workflows dev -- node dist/workflow/entry.js
```

Then in another shell:

```bash
export RENDER_USE_LOCAL_DEV=true
export RENDER_LOCAL_DEV_URL=http://localhost:8120
npm start
```

Iterative TypeScript: **`npm run workflow:dev`** or **`npm run dev`** for the web server.

**Quality checks before a PR:**

```bash
npm run lint
npm test
```

---

## Project structure

| Path | Role |
|------|------|
| `src/app/` | Express routes, error middleware, **`provision/`** fork + deploy orchestration |
| `src/workflow/` | Workflow entry and tasks (`analyze_repository` chain) |
| `src/infra/` | Adapters: GitHub read / publish / fork, Render workflows + REST deploy, Postgres |
| `src/ports/` | Interfaces for adapters |
| `src/domain/` | Pure logic, API envelope, URL parsing |
| `public/` | Static UI, **`api.js`** fetch client |

---

## Contributing

Change workflow behavior in **`src/workflow/tasks/`**. Change HTTP contracts in **`src/app/routes/`**. Open issues or PRs on [GitHub](https://github.com/ojusave/repo-blueprint-assistant/issues).

---

## License

Add a `LICENSE` file when publishing this repository publicly.
