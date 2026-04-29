/**
 * GitHub REST fork adapter: POST /repos/{owner}/{repo}/forks, or reuse existing repo under
 * the token user when the name already exists. Used only by the automatic deploy path.
 */
import { AppError } from "../domain/errors.js";
import type { ForkResult, GitHubFork } from "../ports/github-fork.js";
import { GITHUB_REST_API_VERSION } from "./github-api-version.js";

const BASE = "https://api.github.com";

type Opts = { token: string; timeoutMs: number };

/**
 * GitHub REST: resolve token login, fork repo or reuse existing fork with same name.
 */
export class GitHubForkRestAdapter implements GitHubFork {
  constructor(private readonly opts: Opts) {}

  private headers(): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_REST_API_VERSION,
      Authorization: `Bearer ${this.opts.token}`,
    };
  }

  private async json(
    method: "GET" | "POST",
    url: string,
    body?: unknown
  ): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...this.headers(),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text.length ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      return { ok: res.ok, status: res.status, json: parsed, text };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError("GITHUB_FORK", msg, 502);
    } finally {
      clearTimeout(t);
    }
  }

  async getLogin(): Promise<string> {
    const r = await this.json("GET", `${BASE}/user`);
    if (!r.ok) {
      throw new AppError(
        "GITHUB_FORK",
        `GitHub user ${r.status}: ${r.text.slice(0, 280)}`,
        r.status === 401 ? 401 : 502
      );
    }
    const login = (r.json as { login?: string })?.login;
    if (!login) {
      throw new AppError("GITHUB_FORK", "GitHub user has no login", 502);
    }
    return login;
  }

  private async getRepo(
    owner: string,
    repo: string
  ): Promise<{
    html_url?: string;
    default_branch?: string;
  } | null> {
    const r = await this.json("GET", `${BASE}/repos/${owner}/${repo}`);
    if (r.status === 404) return null;
    if (!r.ok) {
      throw new AppError(
        "GITHUB_FORK",
        `GitHub repos/${owner}/${repo} ${r.status}: ${r.text.slice(0, 240)}`,
        502
      );
    }
    return r.json as { html_url?: string; default_branch?: string };
  }

  /**
   * Poll until default_branch is present (fork may initialize asynchronously).
   */
  private async waitForRepoReady(
    owner: string,
    repo: string,
    maxAttempts: number
  ): Promise<ForkResult> {
    for (let i = 0; i < maxAttempts; i++) {
      const data = await this.getRepo(owner, repo);
      if (data?.default_branch && data.html_url) {
        return {
          owner,
          repo,
          htmlUrl: data.html_url,
          defaultBranch: data.default_branch,
        };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new AppError(
      "GITHUB_FORK",
      "Fork did not become ready in time (no default_branch)",
      504
    );
  }

  async ensureFork(input: {
    upstreamOwner: string;
    upstreamRepo: string;
  }): Promise<ForkResult> {
    const login = await this.getLogin();
    const existing = await this.getRepo(login, input.upstreamRepo);
    if (existing?.default_branch && existing.html_url) {
      return {
        owner: login,
        repo: input.upstreamRepo,
        htmlUrl: existing.html_url,
        defaultBranch: existing.default_branch,
      };
    }

    const r = await this.json(
      "POST",
      `${BASE}/repos/${input.upstreamOwner}/${input.upstreamRepo}/forks`,
      {}
    );

    if (r.ok || r.status === 202) {
      const j = r.json as {
        html_url?: string;
        default_branch?: string;
        name?: string;
      };
      if (j.html_url && j.default_branch) {
        return {
          owner: login,
          repo: j.name ?? input.upstreamRepo,
          htmlUrl: j.html_url,
          defaultBranch: j.default_branch,
        };
      }
      return this.waitForRepoReady(login, input.upstreamRepo, 45);
    }

    if (r.status === 422) {
      const retry = await this.waitForRepoReady(
        login,
        input.upstreamRepo,
        45
      );
      return retry;
    }

    throw new AppError(
      "GITHUB_FORK",
      `GitHub fork ${r.status}: ${r.text.slice(0, 320)}`,
      r.status === 403 ? 403 : 502
    );
  }
}
