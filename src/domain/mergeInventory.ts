import type { MergedInventory, PackageSlice } from "../contracts/analyze-repository-types.js";

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

  const root =
    active.find((s) => s.rootPath === ".") ?? active[0];
  const scripts = root?.scripts;
  const main = root?.main;

  return {
    runtime: guessRuntime(),
    hasPackageJson: paths.some((p) => p.endsWith("package.json")),
    hasDockerfile:
      paths.some(
        (p) => p.endsWith("Dockerfile") || p.endsWith("dockerfile")
      ) || active.some((s) => s.hasDockerfile),
    scripts,
    main,
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
