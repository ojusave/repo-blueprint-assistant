import { AppError } from "./errors.js";

/** Parses owner and repo from a GitHub HTTPS URL or `owner/repo`. */

export function parseRepoInput(raw: string): { owner: string; repo: string } {
  const s = raw.trim().replace(/\.git$/i, "");
  const short = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;
  const mShort = s.match(short);
  if (mShort) {
    return { owner: mShort[1], repo: mShort[2] };
  }
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    if (!u.hostname.endsWith("github.com")) {
      throw new Error();
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
    }
  } catch {
    /* fall through */
  }
  throw new AppError(
    "VALIDATION",
    'Invalid repo: use "owner/repo" or "https://github.com/owner/repo"',
    400
  );
}
