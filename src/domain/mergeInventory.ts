import type { MergedInventory, PackageSlice } from "../contracts/analyze-repository-types.js";

/** Prefer root when it has scripts; otherwise best-effort monorepo slice with build/start. */
export function pickPrimarySlice(active: PackageSlice[]): PackageSlice | undefined {
  if (active.length === 0) return undefined;
  const root = active.find((s) => s.rootPath === ".");
  if (root && (root.scripts?.build || root.scripts?.start)) {
    return root;
  }
  const withBoth = active.find(
    (s) => s.scripts?.build && s.scripts?.start
  );
  if (withBoth) return withBoth;
  const withStart = active.find((s) => s.scripts?.start);
  if (withStart) return withStart;
  const withBuild = active.find((s) => s.scripts?.build);
  if (withBuild) return withBuild;
  return root ?? active[0];
}

/** Pick install command from repo root lockfiles (paths from GitHub snapshot). */
export function inferNodeDepsInstall(paths: string[]): string {
  const hasFile = (name: string) =>
    paths.some((p) => p === name || p.endsWith(`/${name}`));

  if (hasFile("pnpm-lock.yaml") || hasFile("pnpm-lock.yml")) {
    return "corepack enable && pnpm install --frozen-lockfile";
  }
  if (hasFile("yarn.lock")) {
    return "yarn install --frozen-lockfile";
  }
  if (hasFile("package-lock.json") || hasFile("npm-shrinkwrap.json")) {
    return "npm ci --include=dev";
  }
  return "npm install --include=dev";
}

/** Fan-in: combine per-root slices into one inventory for blueprint generation. */
export function mergeSlices(
  slices: PackageSlice[],
  paths: string[]
): MergedInventory {
  const warnings: string[] = [];
  const active = slices.filter((s) => !s.skipped);
  for (const s of slices) {
    if (s.warning) warnings.push(s.warning);
  }

  const guessRuntime = (): MergedInventory["runtime"] => {
    if (paths.some((p) => p.endsWith("package.json"))) return "node";
    if (
      paths.some(
        (p) =>
          p.endsWith("requirements.txt") ||
          p.endsWith("pyproject.toml") ||
          p.endsWith("Pipfile")
      )
    ) {
      return "python";
    }
    return "unknown";
  };

  const primary = pickPrimarySlice(active);
  const scripts = primary?.scripts;
  const main = primary?.main;
  const primarySliceRootPath = primary?.rootPath ?? ".";

  const depKeySet = new Set<string>();
  for (const s of active) {
    for (const k of s.dependencyKeys ?? []) depKeySet.add(k);
  }
  const dependencyKeys = Array.from(depKeySet).sort();

  const runtime = guessRuntime();
  const hasPkg = paths.some((p) => p.endsWith("package.json"));
  const nodeDepsInstall =
    runtime === "node" || hasPkg ? inferNodeDepsInstall(paths) : undefined;

  return {
    runtime,
    hasPackageJson: hasPkg,
    hasDockerfile:
      paths.some(
        (p) => p.endsWith("Dockerfile") || p.endsWith("dockerfile")
      ) || active.some((s) => s.hasDockerfile),
    scripts,
    main,
    nodeDepsInstall,
    primarySliceRootPath,
    dependencyKeys,
    warnings,
    slices: active,
  };
}

export function snapshotHints(
  _paths: string[],
  inventory: MergedInventory
): void {
  if (!inventory.hasDockerfile) {
    inventory.warnings.push(
      "No Dockerfile found in tree; blueprint may rely on native buildpacks."
    );
  }
  if (inventory.runtime === "unknown") {
    inventory.warnings.push("Could not infer runtime from tree.");
  }
}
