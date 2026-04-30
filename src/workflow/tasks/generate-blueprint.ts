import { task } from "@renderinc/sdk/workflows";
import type { MergedInventory } from "../../contracts/analyze-repository-types.js";
import {
  composeRenderBuildCommand,
  composeStartCommand,
} from "../../domain/blueprintDefaults.js";
import { inferManagedPostgres } from "../../domain/inferManagedPostgres.js";

export type GenerateBlueprintInput = {
  inventory: MergedInventory;
  paths: string[];
};

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
  async function generateBlueprintTask(input: GenerateBlueprintInput): Promise<{
    yaml: string;
    notes: string[];
  }> {
    const { inventory, paths } = input;
    const notes = [
      "Review generated YAML before deploy: service names, regions, plans, and env groups.",
    ];
    if (inventory.slices.length > 1) {
      notes.push(
        `Inventory used ${inventory.slices.length} parallel package roots (workspaces).`
      );
    }
    if (inventory.primarySliceRootPath && inventory.primarySliceRootPath !== ".") {
      notes.push(
        `Build/start run in package directory \`${inventory.primarySliceRootPath}\` after root install.`
      );
    }
    if (inventory.runtime === "unknown") {
      notes.push("Runtime not inferred; using node web placeholder.");
    }

    const fi = inventory.fileInsights;
    const pg = inferManagedPostgres(paths, inventory.dependencyKeys, {
      composeSuggestsPostgres: fi?.composeSuggestsPostgres,
    });
    if (pg.include) {
      notes.push(
        `Inferred Render Postgres from: ${pg.reasons.join("; ")}. Remove the databases block if you use another datastore.`
      );
    }

    const MAX_DOC_ENV = 48;
    if (fi?.frameworkPack) {
      notes.push(
        `Framework hint from config filenames near the primary package: ${fi.frameworkPack}.`
      );
    }
    if (fi?.dockerExposePort !== undefined) {
      notes.push(
        `Dockerfile EXPOSE ${fi.dockerExposePort}: on Render the app must listen on process.env.PORT (injected by the platform).`
      );
    }
    const composePorts = fi?.composePublishedPorts;
    if (composePorts && composePorts.length > 0) {
      notes.push(
        `docker-compose publishes host port(s): ${composePorts.join(", ")}. Render uses process.env.PORT at runtime, not these local mappings.`
      );
    }
    if (fi?.frameworkConfigDevPort !== undefined) {
      notes.push(
        `Framework config text suggests dev port ${fi.frameworkConfigDevPort}; production on Render still uses process.env.PORT.`
      );
    }
    if (fi?.renderBlueprintSamplePath) {
      notes.push(
        `Sample blueprint in repo: \`${fi.renderBlueprintSamplePath}\`. Compare with generated YAML (names, plans, env).`
      );
    }

    let docEnvKeys = Array.from(
      new Set([
        ...(fi?.documentedEnvKeys ?? []),
        ...(fi?.composeEnvironmentKeys ?? []),
      ])
    ).sort((a, b) => a.localeCompare(b));
    const skipEnv = new Set<string>(["PORT"]);
    if (pg.include) skipEnv.add("DATABASE_URL");
    docEnvKeys = docEnvKeys.filter((k) => !skipEnv.has(k));
    if (docEnvKeys.length > MAX_DOC_ENV) {
      notes.push(
        `Only the first ${MAX_DOC_ENV} merged env keys are listed in YAML; add the rest in the Render dashboard.`
      );
      docEnvKeys = docEnvKeys.slice(0, MAX_DOC_ENV);
    }
    const hadExampleKeys = (fi?.documentedEnvKeys?.length ?? 0) > 0;
    const hadComposeKeys = (fi?.composeEnvironmentKeys?.length ?? 0) > 0;
    if ((hadExampleKeys || hadComposeKeys) && docEnvKeys.length > 0) {
      notes.push(
        "Env keys from .env.example and/or docker-compose are emitted as sync: false placeholders; set values (or secrets) in the dashboard."
      );
    }
    const buildCmd = composeRenderBuildCommand(inventory);
    const startCmd = composeStartCommand(inventory);
    notes.push(
      "buildCommand starts with a package-manager install that includes devDependencies (vite, TypeScript, etc.) so Render builds do not fail with command not found."
    );
    if (!inventory.scripts?.build && inventory.hasPackageJson) {
      notes.push(
        'No npm "build" script: using install-only step as buildCommand (deps before start).'
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
    const dbBlock = pg.include
      ? `databases:
  - name: app-db
    plan: basic-256mb

`
      : "";
    const dbEnv = pg.include
      ? `      - key: DATABASE_URL
        fromDatabase:
          name: app-db
          property: connectionString
`
      : "";
    const docEnvYaml =
      docEnvKeys.length > 0
        ? docEnvKeys
            .map(
              (k) => `      - key: ${k}
        sync: false`
            )
            .join("\n") + "\n"
        : "";
    const yaml = `${dbBlock}services:
  - type: web
    name: app
    runtime: ${runtime}
    buildCommand: ${JSON.stringify(buildCmd)}
    startCommand: ${JSON.stringify(startCmd)}
    envVars:
${dbEnv}${docEnvYaml}      - key: NODE_ENV
        value: production
`;
    return { yaml, notes };
  }
);
