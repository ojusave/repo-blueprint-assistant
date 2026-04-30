import { describe, expect, it } from "vitest";
import { parseDockerComposeYaml } from "./parseDockerCompose.js";

describe("parseDockerComposeYaml", () => {
  it("collects host ports and env keys", () => {
    const r = parseDockerComposeYaml(`services:
  web:
    ports:
      - "3000:3000"
    environment:
      API_KEY: x
  other:
    ports:
      - "127.0.0.1:4000:4000"
`);
    expect(r.publishedPorts).toEqual([3000, 4000]);
    expect(r.environmentKeys).toContain("API_KEY");
  });

  it("detects postgres image", () => {
    const r = parseDockerComposeYaml(`services:
  db:
    image: postgres:16
`);
    expect(r.suggestsPostgres).toBe(true);
  });

  it("returns empty on invalid yaml", () => {
    const r = parseDockerComposeYaml("services: [");
    expect(r.publishedPorts).toEqual([]);
    expect(r.suggestsPostgres).toBe(false);
  });
});
