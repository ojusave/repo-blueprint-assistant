import { task } from "@renderinc/sdk/workflows";
import type {
  RepoFileInsights,
  RepoInput,
  RepoSnapshot,
} from "../../contracts/analyze-repository-types.js";
import { extractLikelyDevPortFromConfig } from "../../domain/extractLikelyDevPortFromConfig.js";
import { inferFrameworkFromPaths } from "../../domain/inferFrameworkFromPaths.js";
import { parseDockerfileExpose } from "../../domain/parseDockerfileExpose.js";
import { parseDockerComposeYaml } from "../../domain/parseDockerCompose.js";
import { parseEnvExampleKeys } from "../../domain/parseEnvExampleKeys.js";
import {
  pickComposeFilePath,
  pickDockerfilePath,
  pickEnvExamplePath,
  pickFrameworkConfigPath,
  pickRenderBlueprintSamplePath,
} from "../../domain/repoPathPick.js";
import { getGithubRepository } from "../../infra/workflow-github-registry.js";

type FetchRepoFileInsightsInput = RepoInput &
  RepoSnapshot & { primarySliceRootPath: string };

async function safeFetchFile(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | undefined> {
  const gh = getGithubRepository();
  try {
    return await gh.fetchFile(owner, repo, path, ref);
  } catch {
    return undefined;
  }
}

/** Fetch Dockerfile, compose, env example, framework config; infer framework from paths. */
export const fetchRepoFileInsights = task(
  {
    name: "fetch_repo_file_insights",
    plan: "starter",
    timeoutSeconds: 120,
    retry: {
      maxRetries: 1,
      waitDurationMs: 2000,
      backoffScaling: 2,
    },
  },
  async function fetchRepoFileInsightsTask(
    input: FetchRepoFileInsightsInput
  ): Promise<RepoFileInsights> {
    const { paths, primarySliceRootPath, owner, repo, ref } = input;

    const frameworkPack = inferFrameworkFromPaths(
      paths,
      primarySliceRootPath
    );

    const dockerPath = pickDockerfilePath(paths, primarySliceRootPath);
    const envPath = pickEnvExamplePath(paths, primarySliceRootPath);
    const composePath = pickComposeFilePath(paths, primarySliceRootPath);
    const frameworkConfigPath = pickFrameworkConfigPath(
      paths,
      primarySliceRootPath,
      frameworkPack
    );
    const renderBlueprintSamplePath = pickRenderBlueprintSamplePath(
      paths,
      primarySliceRootPath
    );

    const [dockerRaw, envRaw, composeRaw, configRaw] = await Promise.all([
      dockerPath
        ? safeFetchFile(owner, repo, dockerPath, ref)
        : Promise.resolve(undefined),
      envPath
        ? safeFetchFile(owner, repo, envPath, ref)
        : Promise.resolve(undefined),
      composePath
        ? safeFetchFile(owner, repo, composePath, ref)
        : Promise.resolve(undefined),
      frameworkConfigPath
        ? safeFetchFile(owner, repo, frameworkConfigPath, ref)
        : Promise.resolve(undefined),
    ]);

    let dockerExposePort: number | undefined;
    if (dockerRaw) {
      dockerExposePort = parseDockerfileExpose(dockerRaw);
    }

    const documentedEnvKeys = envRaw ? parseEnvExampleKeys(envRaw) : [];

    let composePublishedPorts: number[] | undefined;
    let composeEnvironmentKeys: string[] | undefined;
    let composeSuggestsPostgres: boolean | undefined;
    if (composeRaw) {
      const c = parseDockerComposeYaml(composeRaw);
      if (c.publishedPorts.length > 0) {
        composePublishedPorts = c.publishedPorts;
      }
      if (c.environmentKeys.length > 0) {
        composeEnvironmentKeys = c.environmentKeys;
      }
      if (c.suggestsPostgres) {
        composeSuggestsPostgres = true;
      }
    }

    let frameworkConfigDevPort: number | undefined;
    if (configRaw && frameworkPack) {
      frameworkConfigDevPort = extractLikelyDevPortFromConfig(
        configRaw,
        frameworkPack
      );
    }

    return {
      frameworkPack,
      dockerExposePort,
      documentedEnvKeys,
      composePublishedPorts,
      composeEnvironmentKeys,
      composeSuggestsPostgres,
      frameworkConfigDevPort,
      renderBlueprintSamplePath,
    };
  }
);
