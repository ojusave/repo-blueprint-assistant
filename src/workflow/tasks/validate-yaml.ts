import { task } from "@renderinc/sdk/workflows";
import YAML from "yaml";

export const validateBlueprintYaml = task(
  {
    name: "validate_render_yaml",
    plan: "starter",
    timeoutSeconds: 60,
    retry: {
      maxRetries: 1,
      waitDurationMs: 2000,
      backoffScaling: 2,
    },
  },
  async function validateBlueprintYamlTask(yamlString: string): Promise<{
    ok: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    try {
      const doc = YAML.parse(yamlString) as unknown;
      if (doc === null || typeof doc !== "object") {
        errors.push("Document must parse to an object.");
        return { ok: false, errors };
      }
      const o = doc as Record<string, unknown>;
      if (!Array.isArray(o.services)) {
        errors.push('Expected top-level "services" array.');
      }
    } catch (e) {
      errors.push(`YAML parse error: ${e instanceof Error ? e.message : String(e)}`);
    }
    return { ok: errors.length === 0, errors };
  }
);
