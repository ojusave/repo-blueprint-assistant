#!/usr/bin/env bash
# Creates this repo's Workflow service on Render (CLI 2.16+).
# Prerequisites: render login && render workspace set
# Docs: https://render.com/docs/cli
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ojusave/repo-blueprint-assistant}"
WORKFLOW_NAME="${WORKFLOW_NAME:-repo-blueprint-assistant-wf}"
RENDER_REGION="${RENDER_REGION:-oregon}"

if ! command -v render >/dev/null 2>&1; then
  echo "render CLI not found. Install from https://render.com/docs/cli (need 2.16+ for workflows create)."
  exit 1
fi

render workflows create \
  --name "$WORKFLOW_NAME" \
  --repo "$REPO_URL" \
  --branch main \
  --runtime node \
  --build-command "npm run workflow:build" \
  --run-command "npm run workflow:start" \
  --region "$RENDER_REGION" \
  --confirm \
  -o json

echo ""
echo "Set WORKFLOW_SLUG on the web service to this workflow's slug (see output above or: render workflows list -o json)."
