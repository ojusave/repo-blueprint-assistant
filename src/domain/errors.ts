/** Typed application errors mapped to HTTP by middleware. */

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
