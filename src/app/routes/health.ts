import { Router } from "express";
import { ok } from "../../domain/apiEnvelope.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json(ok({ status: "ok" }));
});
