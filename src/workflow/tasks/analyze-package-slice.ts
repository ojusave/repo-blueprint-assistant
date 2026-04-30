import { task } from "@renderinc/sdk/workflows";
import { getGithubRepository } from "../../infra/workflow-github-registry.js";
import type { PackageSlice, RepoInput, RepoSnapshot } from "../../contracts/analyze-repository-types.js";

type SliceInput = RepoInput &
  RepoSnapshot & {
    rootPath: string;
  };

export const analyzePackageSlice = task(
  {
    name: "analyze_package_slice",
    plan: "standard",
    timeoutSeconds: 120,
    retry: {
      maxRetries: 2,
      waitDurationMs: 3000,
      backoffScaling: 2,
    },
  },
  async function analyzePackageSliceTask(input: SliceInput): Promise<PackageSlice> {
    const pkgPath =
      input.rootPath === "." ? "package.json" : `${input.rootPath}/package.json`;
    if (!input.paths.includes(pkgPath)) {
      return {
        rootPath: input.rootPath,
        hasDockerfile: false,
        skipped: true,
        warning: `No ${pkgPath} in tree`,
      };
    }
    const gh = getGithubRepository();
    let name: string | undefined;
    let main: string | undefined;
    let scripts: { build?: string; start?: string } | undefined;
    let dependencyKeys: string[] | undefined;
    try {
      const raw = await gh.fetchFile(
        input.owner,
        input.repo,
        pkgPath,
        input.ref
      );
      const pkg = JSON.parse(raw) as {
        name?: string;
        main?: string;
        scripts?: { build?: string; start?: string };
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      name = pkg.name;
      main =
        typeof pkg.main === "string" && pkg.main.trim().length > 0
          ? pkg.main.trim()
          : undefined;
      scripts = {
        build: pkg.scripts?.build,
        start: pkg.scripts?.start,
      };
      const keys = new Set<string>();
      for (const k of Object.keys(pkg.dependencies ?? {})) keys.add(k);
      for (const k of Object.keys(pkg.devDependencies ?? {})) keys.add(k);
      dependencyKeys = Array.from(keys).sort();
    } catch (e) {
      return {
        rootPath: input.rootPath,
        hasDockerfile: false,
        skipped: true,
        warning: `Parse error for ${pkgPath}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      };
    }

    const dockerFilePath =
      input.rootPath === "."
        ? "Dockerfile"
        : `${input.rootPath}/Dockerfile`;
    const hasDockerfile = input.paths.includes(dockerFilePath);

    return {
      rootPath: input.rootPath,
      name,
      main,
      scripts,
      dependencyKeys,
      hasDockerfile,
    };
  }
);
