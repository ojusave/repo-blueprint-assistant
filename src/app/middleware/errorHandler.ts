import type { NextFunction, Request, Response } from "express";
import { fail } from "../../domain/apiEnvelope.js";
import { isAppError } from "../../domain/errors.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isAppError(err)) {
    res.status(err.status).json(fail(err.code, err.message));
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);
  res.status(500).json(fail("INTERNAL", msg));
}
