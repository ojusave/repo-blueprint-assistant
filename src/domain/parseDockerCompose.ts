import YAML from "yaml";

export type DockerComposeInsights = {
  /** Host-side ports from compose port mappings (best-effort). */
  publishedPorts: number[];
  /** Env variable names from service `environment` maps/lists. */
  environmentKeys: string[];
  /** True when any service image/build looks like PostgreSQL. */
  suggestsPostgres: boolean;
};

function parseHostPortFromMapping(entry: unknown): number | undefined {
  if (typeof entry === "number" && entry >= 1 && entry <= 65535) {
    return entry;
  }
  if (typeof entry !== "string") return undefined;
  const parts = entry.split(":").map((s) => s.trim());
  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= 65535) return n;
    }
  }
  return undefined;
}

function collectPorts(raw: unknown): number[] {
  const out: number[] = [];
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (typeof item === "string" || typeof item === "number") {
      const n = parseHostPortFromMapping(item);
      if (n !== undefined) out.push(n);
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const pub = o.published;
      if (typeof pub === "string" || typeof pub === "number") {
        const n = parseHostPortFromMapping(pub);
        if (n !== undefined) out.push(n);
      }
      const target = o.target;
      if (typeof target === "number") {
        // long syntax sometimes omits host; skip pure container port
      }
    }
  }
  return out;
}

function collectEnvKeys(raw: unknown): string[] {
  const keys: string[] = [];
  if (!raw) return keys;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (typeof row === "string" && row.includes("=")) {
        const name = row.split("=")[0]?.trim();
        if (name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) keys.push(name);
      }
    }
    return keys;
  }
  if (typeof raw === "object") {
    for (const k of Object.keys(raw as object)) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) keys.push(k);
    }
  }
  return keys;
}

function serviceMentionsPostgres(svc: Record<string, unknown>): boolean {
  const img = svc.image;
  if (typeof img === "string" && /postgres/i.test(img)) return true;
  const build = svc.build;
  if (typeof build === "string" && /postgres/i.test(build)) return true;
  if (build && typeof build === "object" && !Array.isArray(build)) {
    const ctx = (build as { context?: unknown }).context;
    if (typeof ctx === "string" && /postgres/i.test(ctx)) return true;
  }
  return false;
}

const MAX_COMPOSE_BYTES = 96 * 1024;

/** Best-effort parse of Compose v2/v3 `services` (ports, env names, postgres image). */
export function parseDockerComposeYaml(content: string): DockerComposeInsights {
  const empty: DockerComposeInsights = {
    publishedPorts: [],
    environmentKeys: [],
    suggestsPostgres: false,
  };
  let doc: unknown;
  try {
    doc = YAML.parse(content.slice(0, MAX_COMPOSE_BYTES));
  } catch {
    return empty;
  }
  if (doc === null || typeof doc !== "object") return empty;
  const services = (doc as { services?: unknown }).services;
  if (services === null || typeof services !== "object" || Array.isArray(services)) {
    return empty;
  }

  const portSet = new Set<number>();
  const keySet = new Set<string>();
  let suggestsPostgres = false;

  for (const def of Object.values(services as Record<string, unknown>)) {
    if (def === null || typeof def !== "object" || Array.isArray(def)) continue;
    const svc = def as Record<string, unknown>;
    if (serviceMentionsPostgres(svc)) suggestsPostgres = true;
    for (const p of collectPorts(svc.ports)) {
      if (p >= 1 && p <= 65535) portSet.add(p);
    }
    for (const k of collectEnvKeys(svc.environment)) {
      keySet.add(k);
    }
  }

  return {
    publishedPorts: Array.from(portSet).sort((a, b) => a - b),
    environmentKeys: Array.from(keySet).sort((a, b) => a.localeCompare(b)),
    suggestsPostgres,
  };
}
