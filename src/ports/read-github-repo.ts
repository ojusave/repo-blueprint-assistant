/** Port: read-only GitHub repository metadata (REST API behind adapter). */

export type GitHubRepository = {
  fetchTree(
    owner: string,
    repo: string,
    ref: string
  ): Promise<{ sha: string; paths: string[] }>;

  fetchFile(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<string>;

  getDefaultBranch(owner: string, repo: string): Promise<string>;
};
