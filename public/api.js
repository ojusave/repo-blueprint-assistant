/**
 * Single browser API client (Coding Agent Template).
 * All JSON responses use { ok, data } | { ok: false, error }.
 */

export async function fetchMeta() {
  const r = await fetch("/api/meta");
  const j = await r.json();
  if (!j.ok) throw new Error(j.error?.message ?? "meta failed");
  return j.data;
}

export async function postRun(repoUrl) {
  const r = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error?.message ?? "start failed");
  return j.data;
}

export async function getRun(runId) {
  const r = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error?.message ?? "poll failed");
  return j.data;
}
