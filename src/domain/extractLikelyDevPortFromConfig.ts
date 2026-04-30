import type { FrameworkPack } from "../contracts/analyze-repository-types.js";

const MAX_SCAN = 48 * 1024;

/**
 * Very shallow port hints from framework config source (not evaluated as JS).
 * Prefer vite/next-specific shapes before a loose fallback.
 */
export function extractLikelyDevPortFromConfig(
  content: string,
  framework?: FrameworkPack
): number | undefined {
  const slice = content.slice(0, MAX_SCAN);
  if (!framework || framework === "vite" || framework === "next") {
    const prioritized = [
      /\bserver\s*:\s*\{[\s\S]{0,4000}?\bport\s*:\s*(\d{2,5})\b/,
      /\bdevServer\s*:\s*\{[\s\S]{0,4000}?\bport\s*:\s*(\d{2,5})\b/,
      /\bdev\s*:\s*\{[\s\S]{0,4000}?\bport\s*:\s*(\d{2,5})\b/,
    ];
    for (const re of prioritized) {
      const m = re.exec(slice);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 65535) return n;
      }
    }
  }
  if (
    framework &&
    ["astro", "nuxt", "sveltekit", "remix"].includes(framework)
  ) {
    const m = /\bport\s*:\s*(\d{2,5})\b/.exec(slice);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 65535) return n;
    }
  }
  return undefined;
}
