import { task } from "@renderinc/sdk/workflows";
import type { MergedInventory } from "../../contracts/analysis.js";

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
    const buildCmd =
      inventory.scripts?.build ?? 'echo "Set buildCommand to your build step"';
    const startCmd =
      inventory.scripts?.start ?? 'echo "Set startCommand to your start step"';
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
