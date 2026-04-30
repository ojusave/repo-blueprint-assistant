/**
 * Conservative hints that an app expects a SQL-capable database (often via DATABASE_URL).
 * False negatives are OK; false positives waste a small Postgres instance until the user edits YAML.
 */

/** Drivers and ORMs commonly wired to Postgres via DATABASE_URL on Render. */
const PG_RELATED_DEPS = new Set([
  "prisma",
  "@prisma/client",
  "pg",
  "postgres",
  "drizzle-orm",
  "drizzle-kit",
  "typeorm",
  "sequelize",
]);

const PG_PATH_MARKERS = [
  "prisma/schema.prisma",
  "drizzle.config.ts",
  "drizzle.config.js",
  "drizzle.config.mjs",
  "drizzle.config.cjs",
];

function pathMatches(paths: string[], suffix: string): boolean {
  return paths.some((p) => p === suffix || p.endsWith(`/${suffix}`));
}

export type ManagedPostgresInference = {
  include: boolean;
  reasons: string[];
};

export type ManagedPostgresOpts = {
  /** Set when docker-compose lists a postgres image. */
  composeSuggestsPostgres?: boolean;
};

/** Whether to add a Render Postgres resource and DATABASE_URL to generated Blueprint YAML. */
export function inferManagedPostgres(
  paths: string[],
  dependencyKeys: string[],
  opts?: ManagedPostgresOpts
): ManagedPostgresInference {
  const reasons: string[] = [];

  for (const m of PG_PATH_MARKERS) {
    if (pathMatches(paths, m)) {
      reasons.push(`found ${m}`);
    }
  }

  const seen = new Set(reasons);
  for (const key of dependencyKeys) {
    if (PG_RELATED_DEPS.has(key) && !seen.has(`dep:${key}`)) {
      reasons.push(`package.json depends on "${key}"`);
      seen.add(`dep:${key}`);
    }
  }

  if (opts?.composeSuggestsPostgres) {
    reasons.push("docker-compose references a PostgreSQL image");
  }

  return { include: reasons.length > 0, reasons };
}
