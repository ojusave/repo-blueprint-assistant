import { Router } from "express";
import type { WebEnv } from "../../config/env.js";
import { ok } from "../../domain/apiEnvelope.js";
import { renderSignupUrlWithUtms } from "../renderSignup.js";

export function createMetaRouter(env: WebEnv): Router {
  const r = Router();
  r.get("/api/meta", (_req, res) => {
    const repo = env.PUBLIC_GITHUB_REPO;
    const wfSlug = env.WORKFLOW_SLUG?.trim().replace(/\/$/, "") ?? "";
    res.json(
      ok({
        publicGithubRepo: repo,
        /** Full task path used for repo analysis (for UI labels when polling). */
        analyzeRepositoryTask: wfSlug.length > 0 ? `${wfSlug}/analyze_repository` : null,
        /** Blueprint one-click deploy for this repository. */
        deployBlueprintUrl: `https://render.com/deploy?repo=${encodeURIComponent(repo)}`,
        signupNavbar: renderSignupUrlWithUtms("navbar_button"),
        signupHero: renderSignupUrlWithUtms("hero_cta"),
        signupFooter: renderSignupUrlWithUtms("footer_link"),
        publishAvailable:
          env.BLUEPRINT_PUBLISH_ENABLED &&
          Boolean(process.env.GITHUB_TOKEN?.trim()),
        autoDeployConfigured:
          Boolean(env.RENDER_OWNER_ID?.trim()) &&
          Boolean(process.env.GITHUB_TOKEN?.trim()) &&
          Boolean(env.RENDER_API_KEY?.trim()) &&
          env.AUTO_DEPLOY_ENABLED === true,
      })
    );
  });
  return r;
}
