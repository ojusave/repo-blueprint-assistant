import { fetchMeta, getRun, postPublish, postRun } from "./api.js";

/** Set after POST /api/runs so publish can target the same repo + base branch. */
let lastRunMeta = null;
let metaPublishAvailable = false;

function renderYaml(text) {
  const y = document.getElementById("yaml-out");
  const h = document.getElementById("yaml-heading");
  if (y) {
    y.textContent = text;
    y.classList.remove("hidden");
  }
  if (h) h.classList.remove("hidden");
}

function renderWorkflowPayload(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return "(no results yet)";
  }
  const payload = results[0];
  if (payload && typeof payload === "object") {
    if (payload.status === "existing_blueprint") {
      if (payload.rawYaml) renderYaml(payload.rawYaml);
      return JSON.stringify(
        {
          status: payload.status,
          blueprintPath: payload.blueprintPath,
          note: "This repo already has that file; we skip generation. Paste a repo without render.yaml to run fan-out and get a starter blueprint.",
        },
        null,
        2
      );
    }
    if (payload.status === "generated") {
      if (payload.yaml) renderYaml(payload.yaml);
      return JSON.stringify(
        {
          status: payload.status,
          validation: payload.validation,
          notes: payload.notes,
          inventorySummary: payload.inventory
            ? {
                runtime: payload.inventory.runtime,
                warnings: payload.inventory.warnings,
                sliceCount: payload.inventory.slices?.length,
              }
            : undefined,
        },
        null,
        2
      );
    }
    if (payload.status === "error") {
      return JSON.stringify(
        { status: payload.status, message: payload.message },
        null,
        2
      );
    }
  }
  return JSON.stringify(results, null, 2);
}

/** Pull trace array from workflow result payload (set by analyze_repository). */
function extractTrace(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const p = results[0];
  if (p && typeof p === "object" && Array.isArray(p.trace)) {
    return p.trace;
  }
  return null;
}

function hidePipelineTrace() {
  const el = document.getElementById("pipeline-trace");
  if (!el) return;
  el.classList.add("hidden");
  el.replaceChildren();
}

/** Render backend step timings (waterfall-style bars). */
function renderPipelineTrace(trace) {
  const root = document.getElementById("pipeline-trace");
  if (!root) return;

  if (!Array.isArray(trace) || trace.length === 0) {
    hidePipelineTrace();
    return;
  }

  const totalMs = trace.reduce((s, step) => s + (Number(step.ms) || 0), 0);
  const totalSec = totalMs > 0 ? (totalMs / 1000).toFixed(1) : "0";

  root.replaceChildren();
  root.classList.remove("hidden");

  const head = document.createElement("div");
  head.className = "pipeline-head";
  const title = document.createElement("h3");
  title.className = "pipeline-title";
  title.textContent = "Pipeline";
  const totalEl = document.createElement("span");
  totalEl.className = "pipeline-total";
  totalEl.textContent = `${totalSec}s total`;
  head.append(title, totalEl);
  root.append(head);

  const rows = document.createElement("div");
  rows.className = "trace-rows";

  for (const step of trace) {
    const ms = Number(step.ms) || 0;
    const pct = totalMs > 0 ? Math.min(100, (ms / totalMs) * 100) : 0;
    const label = typeof step.label === "string" ? step.label : String(step.id ?? "step");
    const sec = (ms / 1000).toFixed(1);

    const row = document.createElement("div");
    row.className = "trace-row";

    const name = document.createElement("div");
    name.className = "trace-name";
    name.textContent = label;
    name.title = label;

    const msEl = document.createElement("div");
    msEl.className = "trace-ms";
    msEl.textContent = `${sec}s`;

    const bar = document.createElement("div");
    bar.className = "trace-bar";
    const fill = document.createElement("div");
    fill.className = "trace-bar-fill";
    fill.style.width = `${pct}%`;
    bar.append(fill);

    row.append(name, msEl, bar);
    rows.append(row);
  }

  root.append(rows);
}

function prettifyStatus(raw) {
  const s = String(raw || "").replace(/_/g, " ");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
}

/** Map Render workflow status string to badge class + short label. */
function badgeForStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["succeeded", "completed", "success"].includes(s)) {
    return { cls: "badge-done", label: "Succeeded" };
  }
  if (["failed", "failure"].includes(s)) {
    return { cls: "badge-bad", label: "Failed" };
  }
  if (["canceled", "cancelled"].includes(s)) {
    return { cls: "badge-idle", label: "Canceled" };
  }
  if (s === "paused") {
    return { cls: "badge-paused", label: "Paused" };
  }
  if (["running", "in_progress", "pending", "queued"].includes(s)) {
    return { cls: "badge-running", label: prettifyStatus(raw) };
  }
  return { cls: "badge-idle", label: prettifyStatus(raw) };
}

function hintForStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "paused") {
    return "This run is paused in Render. Open the workflow run in the Dashboard to see whether it can be resumed or why it stopped.";
  }
  if (["running", "in_progress", "pending", "queued"].includes(s)) {
    return "Workflow is executing. Fan-out over package roots can take several minutes.";
  }
  if (["succeeded", "completed", "success"].includes(s)) {
    return "Finished. Details below.";
  }
  if (["failed", "failure"].includes(s)) {
    return "The workflow reported failure. See error details below.";
  }
  return "";
}

function setWorkflowChrome(statusRaw, errLine, jsonBlock, opts) {
  const { showSpinner } = opts;
  const badgeEl = document.getElementById("status-badge");
  const hintEl = document.getElementById("status-hint");
  const spinEl = document.getElementById("status-spinner");

  const { cls, label } = badgeForStatus(statusRaw);
  if (badgeEl) {
    badgeEl.hidden = false;
    badgeEl.className = `badge ${cls}`;
    badgeEl.textContent = label;
  }
  if (hintEl) {
    const extra = hintForStatus(statusRaw);
    hintEl.textContent = errLine ? `${extra} ${errLine}`.trim() : extra;
  }
  if (spinEl) {
    if (showSpinner) {
      spinEl.classList.remove("hidden");
    } else {
      spinEl.classList.add("hidden");
    }
  }

  const statusPre = document.getElementById("status");
  if (statusPre) {
    statusPre.textContent = jsonBlock;
  }
}

function maybeShowPublishPanel() {
  const yamlOut = document.getElementById("yaml-out");
  const pub = document.getElementById("publish-panel");
  if (!yamlOut || !pub || yamlOut.classList.contains("hidden")) return;
  if (!metaPublishAvailable || !lastRunMeta) return;
  pub.classList.remove("hidden");
}

function isTerminalWorkflowStatus(wf) {
  const s = String(wf.status || "").toLowerCase();
  return (
    s === "paused" ||
    s === "succeeded" ||
    s === "completed" ||
    s === "failed" ||
    s === "canceled" ||
    s === "cancelled"
  );
}

function shouldShowSpinner(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  return ["running", "in_progress", "pending", "queued"].includes(s);
}

async function pollRun(runId) {
  const panel = document.getElementById("panel");
  if (panel) {
    panel.classList.remove("hidden");
    panel.setAttribute("aria-busy", "true");
  }

  for (let i = 0; i < 120; i++) {
    const data = await getRun(runId);
    const wf = data.workflow;
    const errLine =
      wf.error == null
        ? ""
        : `(error: ${typeof wf.error === "object" ? JSON.stringify(wf.error) : wf.error})`;
    const jsonBlock = renderWorkflowPayload(wf.results);
    renderPipelineTrace(extractTrace(wf.results));

    setWorkflowChrome(wf.status, errLine, `${wf.status}\n${jsonBlock}`, {
      showSpinner: shouldShowSpinner(wf.status),
    });

    const done = isTerminalWorkflowStatus(wf);
    if (done) {
      maybeShowPublishPanel();
      break;
    }
    await new Promise((res) => setTimeout(res, 2000));
  }

  if (panel) panel.setAttribute("aria-busy", "false");
}

async function loadMeta() {
  try {
    const m = await fetchMeta();
    metaPublishAvailable = m.publishAvailable === true;
    const gh = document.getElementById("link-github");
    if (gh && m.publicGithubRepo) gh.href = m.publicGithubRepo;
    const sn = document.getElementById("link-signup-nav");
    const sh = document.getElementById("link-signup-hero");
    const sf = document.getElementById("link-signup-footer");
    if (sn && m.signupNavbar) sn.href = m.signupNavbar;
    if (sh && m.signupHero) sh.href = m.signupHero;
    if (sf && m.signupFooter) sf.href = m.signupFooter;
    const gfx = document.getElementById("link-github-footer");
    if (gfx && m.publicGithubRepo) gfx.href = m.publicGithubRepo;
  } catch {
    /* non-fatal */
  }
}

document.getElementById("form")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = document.getElementById("repoUrl");
  const repoUrl = input?.value?.trim();
  if (!repoUrl) return;
  const analyzeBtn = document.getElementById("analyze-btn");
  lastRunMeta = null;
  document.getElementById("yaml-out")?.classList.add("hidden");
  document.getElementById("yaml-heading")?.classList.add("hidden");
  document.getElementById("publish-panel")?.classList.add("hidden");
  hidePipelineTrace();
  const pubResult = document.getElementById("publish-result");
  if (pubResult) {
    pubResult.textContent = "";
    pubResult.classList.add("hidden");
  }
  const badgeEl = document.getElementById("status-badge");
  if (badgeEl) badgeEl.hidden = true;
  const hintClear = document.getElementById("status-hint");
  if (hintClear) hintClear.textContent = "";
  document.getElementById("status-spinner")?.classList.add("hidden");

  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = "";
  document.getElementById("panel")?.classList.remove("hidden");

  if (analyzeBtn) analyzeBtn.disabled = true;

  try {
    setWorkflowChrome("queued", "", "Starting…", { showSpinner: true });
    const data = await postRun(repoUrl);
    lastRunMeta = {
      owner: data.owner,
      repo: data.repo,
      ref: data.ref,
    };
    setWorkflowChrome("running", "", `Run ${data.runId}\nPolling…`, {
      showSpinner: true,
    });
    await pollRun(data.runId);
  } catch (e) {
    if (badgeEl) {
      badgeEl.hidden = false;
      badgeEl.className = "badge badge-bad";
      badgeEl.textContent = "Error";
    }
    const hintErr = document.getElementById("status-hint");
    if (hintErr) {
      hintErr.textContent = "Could not start or poll the workflow.";
    }
    if (statusEl) {
      statusEl.textContent = e instanceof Error ? e.message : String(e);
    }
  } finally {
    if (analyzeBtn) analyzeBtn.disabled = false;
  }
});

document.getElementById("publish-btn")?.addEventListener("click", async () => {
  const yaml =
    document.getElementById("yaml-out")?.textContent?.trim() ?? "";
  const out = document.getElementById("publish-result");
  if (!yaml || !lastRunMeta) {
    if (out) {
      out.textContent = "Nothing to publish yet.";
      out.classList.remove("hidden");
    }
    return;
  }
  if (out) {
    out.textContent = "Publishing…";
    out.classList.remove("hidden");
  }
  try {
    const data = await postPublish({
      owner: lastRunMeta.owner,
      repo: lastRunMeta.repo,
      yaml,
      baseBranch: lastRunMeta.ref,
      path: "render.yaml",
    });
    if (out) {
      out.textContent = `Branch ${data.branch}\n${data.htmlUrl}`;
    }
  } catch (e) {
    if (out) {
      out.textContent = e instanceof Error ? e.message : String(e);
    }
  }
});

loadMeta();
