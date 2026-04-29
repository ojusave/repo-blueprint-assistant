import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";
import { parseRepoInput } from "./parseRepoUrl.js";

describe("parseRepoInput", () => {
  it("parses owner/repo", () => {
    expect(parseRepoInput("foo/bar")).toEqual({ owner: "foo", repo: "bar" });
  });

  it("parses https github url", () => {
    expect(parseRepoInput("https://github.com/acme/widget")).toEqual({
      owner: "acme",
      repo: "widget",
    });
  });

  it("throws AppError on garbage", () => {
    expect(() => parseRepoInput("not-a-repo")).toThrow(AppError);
  });
});
