import { task } from "@renderinc/sdk/workflows";
import {
  mergeSlices,
  snapshotHints,
} from "../../domain/mergeInventory.js";
import type { AnalyzeResult, RepoInput } from "../../contracts/analysis.js";
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
    try {
      const snapshot = await fetchRepoSnapshot(input);
      const detection = await detectBlueprint({
        ...input,
        ...snapshot,
      });
      if (detection.found && detection.path && detection.rawYaml) {
        return {
          status: "existing_blueprint",
          blueprintPath: detection.path,
          rawYaml: detection.rawYaml,
        };
      }

      const plan = await planTargets({
        ...input,
        ...snapshot,
      });

      const slices = await Promise.all(
        plan.targets.map((rootPath) =>
          analyzePackageSlice({
            ...input,
            ...snapshot,
            rootPath,
          })
        )
      );

      const merged = mergeSlices(slices, snapshot.paths);
      snapshotHints(snapshot.paths, merged);

      const gen = await generateBlueprint(merged);
      const validation = await validateBlueprintYaml(gen.yaml);

      return {
        status: "generated",
        inventory: merged,
        yaml: gen.yaml,
        validation,
        notes: gen.notes,
      };
    } catch (e) {
      return {
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }
);
