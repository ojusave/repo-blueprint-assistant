/**
 * Port: fork upstream repo into the authenticated user’s namespace (GitHub REST).
 * Implementation: GitHubForkRestAdapter in infra/github-http-fork.ts.
 */

export type ForkResult = {
  owner: string;
  repo: string;
  htmlUrl: string;
  defaultBranch: string;
};

export type GitHubFork = {
  ensureFork(input: {
    upstreamOwner: string;
    upstreamRepo: string;
  }): Promise<ForkResult>;
};
