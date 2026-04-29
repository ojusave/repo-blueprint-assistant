import { task } from "@renderinc/sdk/workflows";
import {
  mergeSlices,
  snapshotHints,
} from "../../domain/mergeInventory.js";
import type { AnalyzeResult, RepoInput } from "../../contracts/analyze-repository-types.js";
import {
  runTraced,
  type PipelineTraceStep,
} from "../../domain/pipeline-step-timer.js";
import { analyzePackageSlice } from "./analyze-package-slice.js";
import { detectBlueprint } from "./detect-blueprint.js";
import { fetchRepoSnapshot } from "./fetch-repo-snapshot.js";
import { generateBlueprint } from "./generate-blueprint.js";
import { planTargets } from "./plan-targets.js";
import { validateBlueprintYaml } from "./validate-yaml.js";

export const analyzeRepository = task(
  {
    name: "analyze_repository",
    plan: "standard",
    timeoutSeconds: 900,
    retry: {
      maxRetries: 1,
      waitDurationMs: 5000,
      backoffScaling: 2,
    },
  },
  async function analyzeRepositoryTask(input: RepoInput): Promise<AnalyzeResult> {
    const trace: PipelineTraceStep[] = [];

    try {
      const snapshot = await runTraced(
        trace,
        "fetch_repo_snapshot",
        "fetch_repo_snapshot",
        async () => fetchRepoSnapshot(input)
      );

      const detection = await runTraced(
        trace,
        "detect_render_blueprint",
        "detect_render_blueprint",
        async () =>
          detectBlueprint({
            ...input,
            ...snapshot,
          })
      );

      if (detection.found && detection.path && detection.rawYaml) {
        return {
          status: "existing_blueprint",
          blueprintPath: detection.path,
          rawYaml: detection.rawYaml,
          trace,
        };
      }

      const plan = await runTraced(
        trace,
        "plan_analysis_targets",
        "plan_analysis_targets",
        async () =>
          planTargets({
            ...input,
            ...snapshot,
          })
      );

      const slices = await runTraced(
        trace,
        "analyze_package_slice",
        "analyze_package_slice (parallel)",
        async () =>
          Promise.all(
            plan.targets.map((rootPath) =>
              analyzePackageSlice({
                ...input,
                ...snapshot,
                rootPath,
              })
            )
          )
      );

      const merged = mergeSlices(slices, snapshot.paths);
      snapshotHints(snapshot.paths, merged);

      const gen = await runTraced(
        trace,
        "generate_render_blueprint",
        "generate_render_blueprint",
        async () => generateBlueprint(merged)
      );

      const validation = await runTraced(
        trace,
        "validate_render_yaml",
        "validate_render_yaml",
        async () => validateBlueprintYaml(gen.yaml)
      );

      return {
        status: "generated",
        inventory: merged,
        yaml: gen.yaml,
        validation,
        notes: gen.notes,
        trace,
      };
    } catch (e) {
      return {
        status: "error",
        message: e instanceof Error ? e.message : String(e),
        trace,
      };
    }
  }
);
