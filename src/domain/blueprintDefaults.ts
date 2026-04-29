import type { MergedInventory } from "../contracts/analyze-repository-types.js";

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
