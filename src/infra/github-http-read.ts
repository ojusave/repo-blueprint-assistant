import { AppError } from "../domain/errors.js";
import type { GitHubRepository } from "../ports/read-github-repo.js";
import { GITHUB_REST_API_VERSION } from "./github-api-version.js";

const BASE = "https://api.github.com";

type Opts = { token?: string; timeoutMs: number };

/**
 * GitHub REST adapter: timeouts on every request; no vendor types exported upward.
 */
export class GitHubRestAdapter implements GitHubRepository {
  constructor(private readonly opts: Opts) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_REST_API_VERSION,
    };
    if (this.opts.token) {
      h.Authorization = `Bearer ${this.opts.token}`;
    }
    return h;
  }

  private async json(url: string): Promise<unknown> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: this.headers(),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new AppError(
          "GITHUB_UPSTREAM",
          `GitHub ${res.status}: ${text.slice(0, 240)}`,
          res.status === 404 ? 404 : 502
        );
      }
      return JSON.parse(text) as unknown;
    } catch (e) {
      if (e instanceof AppError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError("GITHUB_UPSTREAM", msg, 502);
    } finally {
      clearTimeout(t);
    }
  }

  async fetchTree(
    owner: string,
    repo: string,
    ref: string
  ): Promise<{ sha: string; paths: string[] }> {
    const url = `${BASE}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
    const data = (await this.json(url)) as {
      sha: string;
      tree?: Array<{ type?: string; path?: string }>;
    };
    const paths =
      data.tree
        ?.filter((t) => t.type === "blob" && t.path)
        .map((t) => t.path as string) ?? [];
    return { sha: data.sha, paths };
  }

  async fetchFile(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<string> {
    const encodedPath = path
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const url = `${BASE}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
    const data = (await this.json(url)) as {
      content?: string;
      encoding?: string;
    };
    if (!data.content || data.encoding !== "base64") {
      throw new AppError("GITHUB_UPSTREAM", "Unexpected contents payload", 502);
    }
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
  }

  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const url = `${BASE}/repos/${owner}/${repo}`;
    const data = (await this.json(url)) as { default_branch?: string };
    if (!data.default_branch) {
      throw new AppError("GITHUB_UPSTREAM", "No default_branch", 502);
    }
    return data.default_branch;
  }
}
