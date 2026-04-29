import { describe, expect, it } from "vitest";
import { extractWebServiceFromBlueprintYaml } from "./parseGeneratedBlueprint.js";

describe("extractWebServiceFromBlueprintYaml", () => {
  it("parses first web service commands", () => {
    const yaml = `services:
  - type: web
    name: app
    runtime: node
    buildCommand: "npm install"
    startCommand: "node app.js"
`;
    const x = extractWebServiceFromBlueprintYaml(yaml);
    expect(x.runtime).toBe("node");
    expect(x.buildCommand).toBe("npm install");
    expect(x.startCommand).toBe("node app.js");
  });
});
