/**
 * Single browser API client (Coding Agent Template).
 * All JSON responses use { ok, data } | { ok: false, error }.
 */

function envelopeErrorMessage(j, fallback) {
  const err = j?.error;
  if (err && typeof err === "object" && typeof err.message === "string") {
    return err.message;
  }
  if (typeof err === "string") return err;
  if (err != null) return JSON.stringify(err);
  return fallback;
}

export async function fetchMeta() {
  const r = await fetch("/api/meta");
  const j = await r.json();
  if (!j.ok) throw new Error(envelopeErrorMessage(j, "meta failed"));
  return j.data;
}

export async function postRun(repoUrl) {
  const r = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(envelopeErrorMessage(j, "start failed"));
  return j.data;
}

export async function getRun(runId) {
  const r = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
  const j = await r.json();
  if (!j.ok) throw new Error(envelopeErrorMessage(j, "poll failed"));
  return j.data;
}

/** Push YAML to a new branch (requires server GITHUB_TOKEN with repo contents write). */
export async function postPublish(body) {
  const r = await fetch("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(envelopeErrorMessage(j, "publish failed"));
  return j.data;
}
