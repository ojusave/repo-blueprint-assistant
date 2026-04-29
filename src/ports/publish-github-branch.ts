/** Push blueprint YAML to a new branch via GitHub Contents + Git API. */

export type PublishFileInput = {
  owner: string;
  repo: string;
  /** Repo-relative path (e.g. render.yaml). */
  path: string;
  content: string;
  /** New branch name (refs/heads/...). */
  branch: string;
  /** Existing branch to branch from (usually default branch). */
  baseBranch: string;
};

export type PublishFileResult = {
  branch: string;
  /** Browser URL for the file on GitHub. */
  htmlUrl: string;
};

export interface GitHubPublisher {
  publishFileOnNewBranch(input: PublishFileInput): Promise<PublishFileResult>;
}
