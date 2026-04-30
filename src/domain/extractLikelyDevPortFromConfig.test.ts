import { describe, expect, it } from "vitest";
import { extractLikelyDevPortFromConfig } from "./extractLikelyDevPortFromConfig.js";

describe("extractLikelyDevPortFromConfig", () => {
  it("reads vite server.port shape", () => {
    expect(
      extractLikelyDevPortFromConfig(
        `export default defineConfig({
  server: { port: 5174 },
})`,
        "vite"
      )
    ).toBe(5174);
  });

  it("reads nested server block for next-ish config", () => {
    expect(
      extractLikelyDevPortFromConfig(
        `module.exports = {
  devIndicators: false,
  server: { port: 3100 },
}`,
        "next"
      )
    ).toBe(3100);
  });

  it("returns undefined when absent", () => {
    expect(
      extractLikelyDevPortFromConfig("export default {}", "vite")
    ).toBeUndefined();
  });
});
