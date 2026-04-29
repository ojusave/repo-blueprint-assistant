/**
 * Extract build/start/runtime from generated YAML text for POST /v1/services (fork pipeline).
 * Generator writes a minimal services[0] block; this stays strict enough to fail fast.
 */
import YAML from "yaml";
import { AppError } from "./errors.js";

const RUNTIMES = new Set([
  "node",
  "python",
  "docker",
  "ruby",
  "go",
  "rust",
  "elixir",
]);

export type BlueprintWebExtract = {
  name: string;
  runtime: string;
  buildCommand: string;
  startCommand: string;
};

/** Reads first `services[].buildCommand` / `startCommand` from generated render.yaml text. */
export function extractWebServiceFromBlueprintYaml(
  yamlStr: string
): BlueprintWebExtract {
  let doc: unknown;
  try {
    doc = YAML.parse(yamlStr);
  } catch {
    throw new AppError("VALIDATION", "Blueprint YAML could not be parsed", 400);
  }
  const services = (doc as { services?: unknown })?.services;
  if (!Array.isArray(services) || services.length === 0) {
    throw new AppError("VALIDATION", "Blueprint has no services", 400);
  }
  const svc = services[0] as Record<string, unknown>;
  const buildCommand =
    typeof svc.buildCommand === "string" ? svc.buildCommand : "";
  const startCommand =
    typeof svc.startCommand === "string" ? svc.startCommand : "";
  const name =
    typeof svc.name === "string" && svc.name.length > 0 ? svc.name : "app";
  const rtRaw =
    typeof svc.runtime === "string" ? svc.runtime.toLowerCase() : "node";
  const runtime = RUNTIMES.has(rtRaw) ? rtRaw : "node";
  if (!buildCommand || !startCommand) {
    throw new AppError(
      "VALIDATION",
      "Blueprint must include buildCommand and startCommand",
      400
    );
  }
  return { name, runtime, buildCommand, startCommand };
}
