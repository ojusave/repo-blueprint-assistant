<div align="center">

# Repo Blueprint Assistant

Paste a **public GitHub repo URL** and get **`render.yaml`** (or a starter blueprint) back: **Render Workflows** inspects the tree via the GitHub API, validates YAML, and optionally **forks**, pushes, and creates a **Render web service** when you wire credentials.

<p>
  <a href="https://render.com/deploy?repo=https://github.com/ojusave/repo-blueprint-assistant">
    <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" />
  </a>
</p>

<p>
  <a href="https://render.com/docs/workflows">
    <img src="https://img.shields.io/badge/Render-Workflows-6c63ff?logo=render&logoColor=white" alt="Render Workflows" />
  </a>
  <a href="https://github.com/ojusave/repo-blueprint-assistant">
    <img src="https://img.shields.io/badge/GitHub-repo--blueprint--assistant-181717?logo=github&logoColor=white" alt="GitHub repository" />
  </a>
  <a href="https://discord.gg/gvC7ceS9YS">
    <img src="https://img.shields.io/badge/Discord-Render%20Developers-5865F2?logo=discord&logoColor=white" alt="Discord" />
  </a>
</p>

</div>

## What This Demo Shows

| Platform | Role |
| --- | --- |
| **[Render Workflows](https://render.com/docs/workflows)** | Runs **`analyze_repository`**: snapshot repo tree, detect existing blueprint, or generate + validate YAML |
| **[Render Postgres](https://render.com/docs/databases)** | Persists analysis runs (`task_run_id`, repo coords, optional fork/deploy metadata) |
| **[Render Web Services](https://render.com/docs/web-services)** | Express API, static UI (DDS assets), health check |
| **GitHub REST** | Read tree and `package.json`; optional fork + branch push (`GITHUB_TOKEN`) |
| **Render REST (`POST /v1/services`)** | Optional automatic web service after generation (`RENDER_API_KEY`, `RENDER_OWNER_ID`) |

## Architecture

There is no diagram checked into this repo yet. Flow in plain language:

### How It Works

1. **Browser** submits **`POST /api/runs`** with a repo URL; **Express** creates a row in Postgres and starts **`{WORKFLOW_SLUG}/analyze_repository`** via the Render API.
2. **Render Workflows** walks tasks (snapshot → detect blueprint → plan targets → parallel package slices → generate or skip YAML → validate).
3. **Express** serves **`GET /api/runs/:id`** for polling: workflow status, pipeline timings (`trace`), generated YAML, and **`provision`** when fork/deploy ran or skipped.
4. If generation succeeds and env allows, the web service may **fork** under your PAT, push **`render.yaml`**, create a service, and poll deploy until live.

## Quick Start

### Prerequisites

- [Render account](https://render.com/register?utm_source=github&utm_medium=referral&utm_campaign=ojus_demos&utm_content=readme_link) (free tier works)
- GitHub repository with this code

### Deploy

1. Click **Deploy to Render** above (Blueprint provisions **Postgres** + **web** from [`render.yaml`](render.yaml)).
2. Create the **Workflow** service separately ([Blueprint cannot define Workflow yet](https://render.com/docs/workflows)):
   - **Dashboard:** [New → Workflow](https://dashboard.render.com/new), same repo, build **`npm run workflow:build`**, start **`npm run workflow:start`**, entry **`dist/workflow/entry.js`**.
   - Or **CLI:** see [`scripts/create-workflow-on-render.sh`](scripts/create-workflow-on-render.sh) and **`npm run workflow:render:create`** after `render login`.
3. On the **web** service, set **`RENDER_API_KEY`**, **`WORKFLOW_SLUG`** (must prefix **`analyze_repository`**), and **`GITHUB_TOKEN`** for sane GitHub rate limits and fork/publish paths. Add **`RENDER_OWNER_ID`** if you use automatic fork + deploy.
4. Open the web URL, paste **`https://github.com/owner/repo`** (or **`owner/repo`**), run **Analyze**.

## Features

| Feature | Description |
| --- | --- |
| **Existing blueprint** | If **`render.yaml`** (or similar) exists in the tree, the UI surfaces it and skips generation |
| **Generated scaffold** | Infers **`buildCommand` / `startCommand`** from **`package.json`**; prepends lockfile-aware install so **devDependencies** (e.g. Vite) exist on Render |
| **Pipeline timings** | Workflow result **`trace`** renders as a simple waterfall in the UI |
| **Fork & deploy** | Optional: fork → push YAML branch → **`POST /v1/services`** → poll deploy |
| **Manual publish** | **`POST /api/publish`** pushes YAML to a **new branch** on the repo you analyzed (needs token access) |
| **Kill switches** | **`ANALYSIS_ENABLED`**, **`BLUEPRINT_PUBLISH_ENABLED`**, **`AUTO_DEPLOY_ENABLED`** |

## Configuration

| Variable | Where | Description |
| --- | --- | --- |
| `DATABASE_URL` | Web | From Blueprint **`fromDatabase`**; required for runs |
| `RENDER_API_KEY` | Web | [Render API key](https://render.com/docs/api#1-create-an-api-key); workflow dispatch + optional REST deploy |
| `WORKFLOW_SLUG` | Web | Must match your Workflow service slug prefix for **`analyze_repository`** |
| `GITHUB_TOKEN` | Web (and workflow for heavy GitHub use) | Higher rate limits; fork / publish need appropriate scopes |
| `PUBLIC_GITHUB_REPO` | Web | Header/footer repo link; defaults to this demo repo |
| `RENDER_OWNER_ID` | Web | Workspace id **`tea-…`** for **`POST /v1/services`** |
| `AUTO_DEPLOY_ENABLED` | Web | When false, no automatic fork/deploy |
| `BLUEPRINT_PUBLISH_ENABLED` | Web | When false, **`POST /api/publish`** returns disabled |
| `ANALYSIS_ENABLED` | Web | When false, **`POST /api/runs`** returns 503 |
| `RENDER_DEPLOY_REGION` / `RENDER_DEPLOY_PLAN` | Web | Defaults for created services |
| `RENDER_API_URL` | Web | Override Render API base (advanced) |
| `GITHUB_HTTP_TIMEOUT_MS` | Web | GitHub adapter timeout (default **15000**) |
| `RENDER_USE_LOCAL_DEV` / `RENDER_LOCAL_DEV_URL` | Web | Point SDK at **`render workflows dev`** |

## Generated builds on Render

Generated **`buildCommand`** starts with an install that includes **devDependencies** (for example **`npm ci --include=dev`** or **`pnpm install --frozen-lockfile`** after **`corepack enable`**) so tools like **Vite** are on **`PATH`**. If an older fork still fails with **`vite: command not found`**, add that install prefix manually in the service **Build Command** or re-run analysis after upgrading this repo.

## Project Structure

```
render.yaml                  Blueprint: web + Postgres (+ preview opts)
src/app/                     Express server, routes, provision pipeline
src/workflow/                Workflow entry + tasks (analyze_repository chain)
src/infra/                   GitHub + Render adapters, Postgres store
src/ports/                   Interfaces (composition uses these)
src/domain/                  Pure helpers (envelope, URL parse, blueprint defaults)
public/                      Static UI + api.js client
```

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Load balancer / Blueprint health |
| `GET` | `/api/meta` | Repo URL, signup links (UTMs), **`deployBlueprintUrl`**, publish/auto-deploy flags |
| `POST` | `/api/runs` | Body **`{ "repoUrl": "..." }`** → starts workflow, returns **`runId`** |
| `GET` | `/api/runs/:runId` | Poll workflow + **`provision`** envelope |
| `POST` | `/api/publish` | Push **`render.yaml`** to a new branch (manual path) |

Responses use **`{ ok: true, data }`** or **`{ ok: false, error: { code, message } }`**.

## Troubleshooting

| Problem | Solution |
| --- | --- |
| Workflow tasks fail or wrong task runs | **`WORKFLOW_SLUG`** must match the Workflow service name prefix exactly |
| **`vite: command not found`** (or exit **127**) on forked deploy | Ensure **Build Command** installs **devDependencies**; see [Generated builds on Render](#generated-builds-on-render) |
| Fork & deploy skipped | **`GET /api/runs/:id`** → **`provision.skipReason`** (**`existing_blueprint`**, **`no_github_token`**, **`no_render_owner`**, **`no_render_deploy`**, **`auto_deploy_disabled`**, etc.) |
| Manual publish **403** / **404** | Token cannot push that **`owner/repo`**; fine-grained PAT needs **Contents** write on the right owner |
| **`paused`** status while polling | Normal briefly; UI keeps polling until terminal state and results |
| Database errors | Use Postgres **internal** URL from Render |
| HIPAA workspace | New Workflow services may be blocked; see [Workflow limitations](https://render.com/docs/workflows#beta-limitations) |

## Developing Locally

```bash
npm ci
npm run build
DATABASE_URL=postgres://user:pass@localhost:5432/db \
  RENDER_API_KEY=your-render-api-key \
  WORKFLOW_SLUG=your-workflow-slug \
  npm start
```

Workflow tasks against local dev:

```bash
npm run build
render workflows dev -- node dist/workflow/entry.js
```

Then **`RENDER_USE_LOCAL_DEV=true`** and **`RENDER_LOCAL_DEV_URL=http://localhost:8120`** on the web process.

```bash
npm run lint && npm test
```

## Learn More

**Render:**

- [Render Workflows](https://render.com/docs/workflows)
- [Deploy to Render button](https://render.com/docs/deploy-to-render-button)
- [Render Developers Discord](https://discord.gg/gvC7ceS9YS)

## License

Add a **`LICENSE`** file when you publish a fork publicly.
