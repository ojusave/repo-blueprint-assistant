/** Port: persist analysis run metadata (Postgres behind adapter). */

export type RunRecord = {
  id: string;
  taskRunId: string;
  owner: string;
  repo: string;
  ref: string;
  createdAt: string;
};

export type RunStore = {
  create(data: {
    taskRunId: string;
    owner: string;
    repo: string;
    ref: string;
  }): Promise<RunRecord>;

  getById(id: string): Promise<RunRecord | null>;
};
