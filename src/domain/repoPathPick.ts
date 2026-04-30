import type { FrameworkPack } from "../contracts/analyze-repository-types.js";

/**
 * Pick a repo file path preferring the primary package directory, then repo root, then deeper paths.
 */

export function pathScore(fullPath: string, primarySliceRoot: string): number {
  if (primarySliceRoot === ".") {
    return fullPath.split("/").length;
  }
  const prefix = `${primarySliceRoot}/`;
  if (fullPath === primarySliceRoot || fullPath.startsWith(prefix)) {
    const rel =
      fullPath === primarySliceRoot ? "" : fullPath.slice(prefix.length);
    return rel.split("/").filter(Boolean).length;
  }
  return 1000 + fullPath.split("/").length;
}

/** Lowest score wins; ties broken lexicographically for stability. */
export function pickScoredPath(
  paths: string[],
  primarySliceRoot: string,
  basenameOk: (basename: string, fullPath: string) => boolean
): string | undefined {
  let best: { path: string; score: number } | undefined;
  for (const full of paths) {
    const slash = full.lastIndexOf("/");
    const base = slash === -1 ? full : full.slice(slash + 1);
    if (!basenameOk(base, full)) continue;
    const score = pathScore(full, primarySliceRoot);
    if (
      !best ||
      score < best.score ||
      (score === best.score && full.localeCompare(best.path) < 0)
    ) {
      best = { path: full, score };
    }
  }
  return best?.path;
}

export function pickDockerfilePath(
  paths: string[],
  primarySliceRoot: string
): string | undefined {
  return pickScoredPath(
    paths,
    primarySliceRoot,
    (base) => base === "Dockerfile" || base === "dockerfile"
  );
}

export function pickEnvExamplePath(
  paths: string[],
  primarySliceRoot: string
): string | undefined {
  return pickScoredPath(paths, primarySliceRoot, (base) =>
    /^\.env\.(example|sample|template)$/i.test(base)
  );
}

export function pickComposeFilePath(
  paths: string[],
  primarySliceRoot: string
): string | undefined {
  return pickScoredPath(
    paths,
    primarySliceRoot,
    (base) =>
      base === "docker-compose.yml" ||
      base === "docker-compose.yaml" ||
      base === "compose.yml" ||
      base === "compose.yaml"
  );
}

/** Sample / example blueprints to compare with generated output (not live `render.yaml`). */
export function pickRenderBlueprintSamplePath(
  paths: string[],
  primarySliceRoot: string
): string | undefined {
  return pickScoredPath(paths, primarySliceRoot, (base) =>
    /^(render\.ya?ml\.example|render\.example\.ya?ml|render-sample\.ya?ml|render\.ya?ml\.sample)$/i.test(
      base
    )
  );
}

const FRAMEWORK_CONFIG_BASENAME: Record<
  FrameworkPack,
  (base: string) => boolean
> = {
  next: (b) => /^next\.config\.(mjs|cjs|js|ts|mts|cts|json)$/.test(b),
  vite: (b) => /^vite\.config\.(mjs|cjs|js|ts|mts|cts)$/.test(b),
  remix: (b) => /^remix\.config\.(js|ts)$/.test(b),
  astro: (b) => /^astro\.config\.(mjs|cjs|js|ts)$/.test(b),
  nuxt: (b) => /^nuxt\.config\.(js|ts|mjs|cjs)$/.test(b),
  sveltekit: (b) => /^svelte\.config\.(js|ts)$/.test(b),
};

export function pickFrameworkConfigPath(
  paths: string[],
  primarySliceRoot: string,
  framework?: FrameworkPack
): string | undefined {
  if (!framework) return undefined;
  const match = FRAMEWORK_CONFIG_BASENAME[framework];
  return pickScoredPath(paths, primarySliceRoot, (base) => match(base));
}
