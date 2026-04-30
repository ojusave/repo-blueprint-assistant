import { describe, expect, it } from "vitest";
import { parseEnvExampleKeys } from "./parseEnvExampleKeys.js";

describe("parseEnvExampleKeys", () => {
  it("collects keys and sorts", () => {
    expect(
      parseEnvExampleKeys(`# hi
API_URL=https://x
export OTHER=1
ZZZ=a
AAA=
`)
    ).toEqual(["AAA", "API_URL", "OTHER", "ZZZ"]);
  });

  it("skips invalid lines", () => {
    expect(parseEnvExampleKeys("not_key_value\n=broken")).toEqual([]);
  });
});
