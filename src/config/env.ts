import { z } from "zod";

const webSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  RENDER_API_KEY: z.string().min(1),
  WORKFLOW_SLUG: z.string().min(1),
  RENDER_API_URL: z.string().url().optional(),
  PUBLIC_GITHUB_REPO: z.string().url().default("https://github.com/render-examples"),
  ANALYSIS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
});

export type WebEnv = z.infer<typeof webSchema>;

export function loadWebEnv(): WebEnv {
  const parsed = webSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
}
