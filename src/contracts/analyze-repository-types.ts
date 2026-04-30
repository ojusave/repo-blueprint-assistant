/** Shared contracts for workflow results and inventory (no IO). */

import type { PipelineTraceStep } from "../domain/pipeline-step-timer.js";

export type { PipelineTraceStep };

export type RepoInput = {
  owner: string;
  repo: string;
  ref: string;
};

export type RepoSnapshot = {
  sha: string;
  paths: string[];
};

/** Detected from framework config filenames (see inferFrameworkFromPaths). */
export type FrameworkPack =
  | "next"
  | "vite"
  | "remix"
  | "astro"
  | "nuxt"
  | "sveltekit";

/** Optional repo files fetched after tree + package.json analysis (names only for env keys). */
export type RepoFileInsights = {
  frameworkPack?: FrameworkPack;
  dockerExposePort?: number;
  documentedEnvKeys: string[];
  /** Host ports from docker-compose / compose.yaml `ports` (best-effort). */
  composePublishedPorts?: number[];
  /** Env names from compose `environment` blocks. */
  composeEnvironmentKeys?: string[];
  /** Any service image/build looks like PostgreSQL. */
  composeSuggestsPostgres?: boolean;
  /** First plausible dev `port` from next/vite config text (not executed). */
  frameworkConfigDevPort?: number;
  /** Example / sample Render blueprint in tree (path only; for comparison). */
  renderBlueprintSamplePath?: string;
};

export type PackageSlice = {
  rootPath: string;
  name?: string;
  /** package.json "main" (entry file), e.g. index.js */
  main?: string;
  scripts?: { build?: string; start?: string };
  /** dependency + devDependency names from this slice's package.json */
  dependencyKeys?: string[];
  hasDockerfile: boolean;
  skipped?: boolean;
  warning?: string;
};

export type MergedInventory = {
  runtime: "node" | "python" | "unknown";
  hasPackageJson: boolean;
  hasDockerfile: boolean;
  scripts?: { build?: string; start?: string };
  /** Root package.json `main` when present */
  main?: string;
  /**
   * Install step prepended to buildCommand on Render so devDependencies (e.g. vite, tsc)
   * exist when NODE_ENV=production would otherwise omit them.
   */
  nodeDepsInstall?: string;
  /** Workspace slice whose scripts/main drive the generated web service (often "."). */
  primarySliceRootPath: string;
  /** Union of dependency keys across analyzed slices (for Postgres inference). */
  dependencyKeys: string[];
  /** Dockerfile / .env.example / framework configs when fetched successfully. */
  fileInsights?: RepoFileInsights;
  warnings: string[];
  slices: PackageSlice[];
};

export type AnalyzeResult =
  | {
      status: "existing_blueprint";
      blueprintPath: string;
      rawYaml: string;
      /** Wall-clock steps inside this run (for UI waterfall). */
      trace: PipelineTraceStep[];
    }
  | {
      status: "generated";
      inventory: MergedInventory;
      yaml: string;
      validation: { ok: boolean; errors: string[] };
      notes?: string[];
      trace: PipelineTraceStep[];
    }
  | {
      status: "error";
      message: string;
      trace: PipelineTraceStep[];
    };
