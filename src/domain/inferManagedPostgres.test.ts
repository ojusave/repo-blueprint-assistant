import { describe, expect, it } from "vitest";
import { inferManagedPostgres } from "./inferManagedPostgres.js";

describe("inferManagedPostgres", () => {
  it("includes when prisma schema path exists", () => {
    const r = inferManagedPostgres(["apps/web/prisma/schema.prisma"], []);
    expect(r.include).toBe(true);
    expect(r.reasons.some((x) => x.includes("prisma/schema.prisma"))).toBe(
      true
    );
  });

  it("includes when dependency list has pg", () => {
    const r = inferManagedPostgres(["package.json"], ["express", "pg"]);
    expect(r.include).toBe(true);
    expect(r.reasons.some((x) => x.includes('"pg"'))).toBe(true);
  });

  it("excludes when no markers or deps", () => {
    expect(
      inferManagedPostgres(["package.json", "src/index.ts"], ["lodash"]).include
    ).toBe(false);
  });

  it("includes when compose suggests postgres", () => {
    const r = inferManagedPostgres(["package.json"], ["lodash"], {
      composeSuggestsPostgres: true,
    });
    expect(r.include).toBe(true);
    expect(
      r.reasons.some((x) => x.includes("docker-compose"))
    ).toBe(true);
  });
});
