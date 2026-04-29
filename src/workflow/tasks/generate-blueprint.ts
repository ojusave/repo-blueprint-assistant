import { task } from "@renderinc/sdk/workflows";
import type { MergedInventory } from "../../contracts/analyze-repository-types.js";
import {
  defaultBuildCommand,
  defaultStartCommand,
} from "../../domain/blueprintDefaults.js";

export const generateBlueprint = task(
  {
    name: "generate_render_blueprint",
    plan: "standard",
    timeoutSeconds: 120,
    retry: {
      maxRetries: 1,
      waitDurationMs: 3000,
      backoffScaling: 2,
    },
  },
  async function generateBlueprintTask(inventory: MergedInventory): Promise<{
    yaml: string;
    notes: string[];
  }> {
    const notes = [
      "Generated scaffold only: review service names, regions, and env groups before deploy.",
    ];
    if (inventory.slices.length > 1) {
      notes.push(
        `Inventory used ${inventory.slices.length} parallel package roots (workspaces).`
      );
    }
    if (inventory.runtime === "unknown") {
      notes.push("Runtime not inferred; using node web placeholder.");
    }
    const buildCmd = defaultBuildCommand(inventory);
    const startCmd = defaultStartCommand(inventory);
    if (!inventory.scripts?.build && inventory.hasPackageJson) {
      notes.push(
        'No npm "build" script: using `npm install` as buildCommand (install deps before start).'
      );
    }
    if (!inventory.scripts?.start) {
      if (inventory.main) {
        notes.push(
          `No npm "start" script: using package.json "main" as entry → ${startCmd}`
        );
      } else if (inventory.runtime === "node" || inventory.hasPackageJson) {
        notes.push(
          'No npm "start" or "main": using `node index.js` (change if your entry file differs).'
        );
      }
    }
    const runtime =
      inventory.runtime === "python"
        ? "python"
        : inventory.runtime === "node"
          ? "node"
          : "node";
    const yaml = `services:
  - type: web
    name: app
    runtime: ${runtime}
    buildCommand: ${JSON.stringify(buildCmd)}
    startCommand: ${JSON.stringify(startCmd)}
    envVars:
      - key: NODE_ENV
        value: production
`;
    return { yaml, notes };
  }
);
