/** Ordered steps inside `analyze_repository` for UI waterfall / timing. */

export type PipelineTraceStep = {
  id: string;
  label: string;
  ms: number;
};

/**
 * Runs `fn` and appends one `{ id, label, ms }` row using wall-clock time.
 * Use for sequential phases. For `Promise.all` fan-out, wrap the whole batch in one call.
 */
export async function runTraced<T>(
  trace: PipelineTraceStep[],
  id: string,
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    trace.push({ id, label, ms: Math.max(0, Date.now() - t0) });
  }
}
