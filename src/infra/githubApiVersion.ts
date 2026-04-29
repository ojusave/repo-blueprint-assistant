/**
 * GitHub REST API calendar version (see
 * https://docs.github.com/rest/about-the-rest-api/api-versions ).
 * Override with GITHUB_REST_API_VERSION if you need to pin an older supported version.
 */
export const GITHUB_REST_API_VERSION =
  typeof process.env.GITHUB_REST_API_VERSION === "string" &&
  process.env.GITHUB_REST_API_VERSION.trim().length > 0
    ? process.env.GITHUB_REST_API_VERSION.trim()
    : "2026-03-10";
