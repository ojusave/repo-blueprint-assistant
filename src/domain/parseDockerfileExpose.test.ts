import { describe, expect, it } from "vitest";
import { parseDockerfileExpose } from "./parseDockerfileExpose.js";

describe("parseDockerfileExpose", () => {
  it("reads first EXPOSE port", () => {
    expect(
      parseDockerfileExpose(`FROM node:20
EXPOSE 3000
CMD ["node","app.js"]
`)
    ).toBe(3000);
  });

  it("handles EXPOSE with protocol suffix", () => {
    expect(parseDockerfileExpose("EXPOSE 8080/tcp")).toBe(8080);
  });

  it("ignores comments on line", () => {
    expect(parseDockerfileExpose("EXPOSE 4000 # comment")).toBe(4000);
  });

  it("returns undefined when absent", () => {
    expect(parseDockerfileExpose("FROM alpine\nRUN echo hi")).toBeUndefined();
  });
});
