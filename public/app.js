import { fetchMeta, getRun, postRun } from "./api.js";

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
      return JSON.stringify(payload, null, 2);
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
      return JSON.stringify(payload, null, 2);
    }
  }
  return JSON.stringify(results, null, 2);
}

async function pollRun(runId) {
  const statusEl = document.getElementById("status");
  const panel = document.getElementById("panel");
  if (panel) panel.classList.remove("hidden");

  for (let i = 0; i < 120; i++) {
    const data = await getRun(runId);
    const wf = data.workflow;
    const line = `${wf.status}\n${wf.error ? `error: ${wf.error}\n` : ""}`;
    if (statusEl) {
      statusEl.textContent =
        line + "\n" + renderWorkflowPayload(wf.results);
    }

    const done =
      wf.status === "succeeded" ||
      wf.status === "completed" ||
      wf.status === "failed" ||
      wf.status === "canceled";
    if (done) break;
    await new Promise((res) => setTimeout(res, 2000));
  }
}

async function loadMeta() {
  try {
    const m = await fetchMeta();
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
  document.getElementById("yaml-out")?.classList.add("hidden");
  document.getElementById("yaml-heading")?.classList.add("hidden");
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = "Starting…";
  document.getElementById("panel")?.classList.remove("hidden");

  try {
    const data = await postRun(repoUrl);
    if (statusEl) {
      statusEl.textContent = `Started run ${data.runId}\nPolling…`;
    }
    await pollRun(data.runId);
  } catch (e) {
    if (statusEl) statusEl.textContent = e instanceof Error ? e.message : String(e);
  }
});

loadMeta();
