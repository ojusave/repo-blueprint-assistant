import { describe, expect, it } from "vitest";
import { fail, ok } from "./apiEnvelope.js";

describe("apiEnvelope", () => {
  it("builds success", () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, data: { a: 1 } });
  });

  it("builds failure", () => {
    expect(fail("X", "msg")).toEqual({
      ok: false,
      error: { code: "X", message: "msg" },
    });
  });
});
