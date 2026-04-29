import { z } from "zod";

const webSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  /** Optional at boot so Blueprint deploy can pass health before Dashboard secrets (`sync: false`) are filled. */
  RENDER_API_KEY: z.string().optional().default(""),
  WORKFLOW_SLUG: z.string().optional().default(""),
  RENDER_API_URL: z.string().url().optional(),
  PUBLIC_GITHUB_REPO: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim() ?? "";
      return t.length > 0 ? t : "https://github.com/ojusave/repo-blueprint-assistant";
    })
    .pipe(z.string().url()),
  ANALYSIS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  /** When false, POST /api/publish returns FEATURE_DISABLED. */
  BLUEPRINT_PUBLISH_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  /** Render workspace / team ID (`tea-...`) for POST /v1/services (fork → deploy flow). */
  RENDER_OWNER_ID: z.string().optional().default(""),
  /** Defaults for created web services (fork pipeline). */
  RENDER_DEPLOY_REGION: z
    .enum(["oregon", "frankfurt", "ohio", "singapore", "virginia"])
    .optional()
    .default("oregon"),
  /** Render API accepts multiple plan slugs; keep a string default. */
  RENDER_DEPLOY_PLAN: z.string().optional().default("starter"),
  /** When false, generated blueprints are not forked / deployed automatically. */
  AUTO_DEPLOY_ENABLED: z
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
