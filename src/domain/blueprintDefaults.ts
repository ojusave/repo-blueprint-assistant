import type { MergedInventory } from "../contracts/analyze-repository-types.js";

/**
 * Full Render buildCommand: install devDependencies first, then package.json build or fallback.
 * Without this, `vite build` etc. often fail with "command not found" on Render because
 * production installs skip devDependencies.
 */
export function composeRenderBuildCommand(inv: MergedInventory): string {
  const install =
    inv.nodeDepsInstall ??
    (inv.runtime === "node" || inv.hasPackageJson
      ? "npm install --include=dev"
      : "");

  const scriptBuild = inv.scripts?.build;
  if (scriptBuild) {
    return install ? `${install} && ${scriptBuild}` : scriptBuild;
  }

  const fallback = defaultBuildCommand(inv);
  if (fallback === "npm install") {
    return install.length > 0 ? install : fallback;
  }
  return install ? `${install} && ${fallback}` : fallback;
}

/** Reasonable Render defaults when package.json omits scripts (native Node buildpack). */
export function defaultBuildCommand(inv: MergedInventory): string {
  if (inv.scripts?.build) return inv.scripts.build;
  if (inv.runtime === "node" || inv.hasPackageJson) return "npm install";
  return 'echo "Set buildCommand for this runtime"';
}

export function defaultStartCommand(inv: MergedInventory): string {
  if (inv.scripts?.start) return inv.scripts.start;
  if (inv.main) return `node ${inv.main}`;
  if (inv.runtime === "node" || inv.hasPackageJson) return "node index.js";
  return 'echo "Set startCommand for this runtime"';
}
