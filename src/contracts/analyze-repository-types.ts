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

export type PackageSlice = {
  rootPath: string;
  name?: string;
  /** package.json "main" (entry file), e.g. index.js */
  main?: string;
  scripts?: { build?: string; start?: string };
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
