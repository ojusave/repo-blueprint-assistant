/**
 * Workflow process composition root: singleton GitHub port for task handlers.
 * Reset only in tests via resetGithubRepositoryForTests().
 */
import type { GitHubRepository } from "../ports/read-github-repo.js";
import { GitHubRestAdapter } from "./github-http-read.js";

let githubSingleton: GitHubRepository | null = null;

export function getGithubRepository(): GitHubRepository {
  if (!githubSingleton) {
    githubSingleton = new GitHubRestAdapter({
      token: process.env.GITHUB_TOKEN,
      timeoutMs: Number(process.env.GITHUB_HTTP_TIMEOUT_MS ?? 15000),
    });
  }
  return githubSingleton;
}

export function resetGithubRepositoryForTests(mock?: GitHubRepository): void {
  githubSingleton = mock ?? null;
}
