import type { FrameworkPack } from "../contracts/analyze-repository-types.js";
import { pickScoredPath } from "./repoPathPick.js";

const ORDER: {
  pack: FrameworkPack;
  match: (basename: string) => boolean;
}[] = [
  {
    pack: "next",
    match: (b) =>
      /^next\.config\.(mjs|cjs|js|ts|mts|cts|json)$/.test(b),
  },
  { pack: "remix", match: (b) => /^remix\.config\.(js|ts)$/.test(b) },
  {
    pack: "nuxt",
    match: (b) => /^nuxt\.config\.(js|ts|mjs|cjs)$/.test(b),
  },
  {
    pack: "astro",
    match: (b) => /^astro\.config\.(mjs|cjs|js|ts)$/.test(b),
  },
  {
    pack: "sveltekit",
    match: (b) => /^svelte\.config\.(js|ts)$/.test(b),
  },
  {
    pack: "vite",
    match: (b) => /^vite\.config\.(mjs|cjs|js|ts|mts|cts)$/.test(b),
  },
];

/** Framework hint from config filenames (priority order; first match wins). */
export function inferFrameworkFromPaths(
  paths: string[],
  primarySliceRoot: string
): FrameworkPack | undefined {
  for (const { pack, match } of ORDER) {
    const hit = pickScoredPath(paths, primarySliceRoot, (base) => match(base));
    if (hit) return pack;
  }
  return undefined;
}
