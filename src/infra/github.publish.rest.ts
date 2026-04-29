import { AppError } from "../domain/errors.js";
import type {
  GitHubPublisher,
  PublishFileInput,
  PublishFileResult,
} from "../ports/github.publisher.js";

const BASE = "https://api.github.com";

type Opts = { token: string; timeoutMs: number };

function mapGithubStatusToAppStatus(resStatus: number): number {
  if (resStatus === 403) return 403;
  if (resStatus === 404) return 404;
  return 502;
}

/** Turn GitHub error bodies into a short message plus fix hints for common 403s. */
function githubPublishFailureMessage(status: number, bodyText: string): string {
  const snippet = bodyText.slice(0, 320).replace(/\s+/g, " ").trim();
  if (status !== 403) {
    return `GitHub ${status}: ${snippet}`;
  }
  let apiMessage = "";
  try {
    const j = JSON.parse(bodyText) as { message?: string };
    apiMessage = j.message ?? "";
  } catch {
    /* ignore */
  }
  const notAccessible = apiMessage.includes(
    "Resource not accessible by personal access token"
  );
  const hint = notAccessible
    ? " Your token cannot write this repository. If you use a fine-grained PAT: add this repository under Repository access and set Permission: Contents to Read and write. If you use a classic PAT: enable the repo scope. For organization-owned repos, open the token on GitHub and click Authorize for SSO if your org requires it."
    : " Confirm the token has push access (contents: write) to owner/repo and is not limited to other repositories only.";
  return `GitHub 403: ${snippet}.${hint}`;
}

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
          githubPublishFailureMessage(res.status, text),
          mapGithubStatusToAppStatus(res.status)
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
          githubPublishFailureMessage(res.status, text),
          mapGithubStatusToAppStatus(res.status)
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
