import { AppError } from "../domain/errors.js";
import type {
  GitHubPublisher,
  PublishFileInput,
  PublishFileResult,
} from "../ports/github.publisher.js";

const BASE = "https://api.github.com";

type Opts = { token: string; timeoutMs: number };

function encodeContentPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * GitHub REST: create branch from base, then create or update file on that branch.
 */
export class GitHubPublishRestAdapter implements GitHubPublisher {
  constructor(private readonly opts: Opts) {}

  private headers(): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${this.opts.token}`,
    };
  }

  private async request(
    method: "GET" | "POST" | "PUT",
    url: string,
    body?: unknown
  ): Promise<unknown> {
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
      if (!res.ok) {
        throw new AppError(
          "GITHUB_PUBLISH",
          `GitHub ${res.status}: ${text.slice(0, 360)}`,
          res.status === 403 ? 403 : res.status === 404 ? 404 : 502
        );
      }
      return text.length ? (JSON.parse(text) as unknown) : {};
    } catch (e) {
      if (e instanceof AppError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError("GITHUB_PUBLISH", msg, 502);
    } finally {
      clearTimeout(t);
    }
  }

  private async getBranchTipSha(
    owner: string,
    repo: string,
    branch: string
  ): Promise<string> {
    const url = `${BASE}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`;
    const data = (await this.request("GET", url)) as {
      object?: { sha?: string };
    };
    const sha = data.object?.sha;
    if (!sha) {
      throw new AppError(
        "GITHUB_PUBLISH",
        `Could not resolve branch ${branch}`,
        502
      );
    }
    return sha;
  }

  private async createBranch(
    owner: string,
    repo: string,
    branch: string,
    sha: string
  ): Promise<void> {
    const url = `${BASE}/repos/${owner}/${repo}/git/refs`;
    await this.request("POST", url, {
      ref: `refs/heads/${branch}`,
      sha,
    });
  }

  /** Returns blob sha if file exists on ref, else undefined. */
  private async getBlobShaIfExists(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<string | undefined> {
    const encoded = encodeContentPath(path);
    const url = `${BASE}/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: this.headers(),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (res.status === 404) return undefined;
      if (!res.ok) {
        throw new AppError(
          "GITHUB_PUBLISH",
          `GitHub ${res.status}: ${text.slice(0, 360)}`,
          502
        );
      }
      const data = JSON.parse(text) as { sha?: string };
      return typeof data.sha === "string" ? data.sha : undefined;
    } catch (e) {
      if (e instanceof AppError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError("GITHUB_PUBLISH", msg, 502);
    } finally {
      clearTimeout(t);
    }
  }

  async publishFileOnNewBranch(
    input: PublishFileInput
  ): Promise<PublishFileResult> {
    const { owner, repo, path, content, branch, baseBranch } = input;
    const baseSha = await this.getBranchTipSha(owner, repo, baseBranch);
    await this.createBranch(owner, repo, branch, baseSha);

    const existingSha = await this.getBlobShaIfExists(
      owner,
      repo,
      path,
      branch
    );

    const encoded = encodeContentPath(path);
    const putUrl = `${BASE}/repos/${owner}/${repo}/contents/${encoded}`;
    const body: Record<string, string> = {
      message: "Add or update Render Blueprint (repo-blueprint-assistant)",
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
    };
    if (existingSha) body.sha = existingSha;

    const put = (await this.request("PUT", putUrl, body)) as {
      content?: { html_url?: string };
    };
    const htmlUrl = put.content?.html_url;
    if (!htmlUrl) {
      throw new AppError(
        "GITHUB_PUBLISH",
        "GitHub did not return content.html_url",
        502
      );
    }
    return { branch, htmlUrl };
  }
}
