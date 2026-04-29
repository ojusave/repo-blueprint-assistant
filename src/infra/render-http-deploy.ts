import { AppError } from "../domain/errors.js";

type Opts = {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
};

function normalizeBase(base: string): string {
  const b = base.replace(/\/$/, "");
  return b.endsWith("/v1") ? b.slice(0, -3) : b;
}

/**
 * Minimal Render REST client for POST /services and deploy polling (not exposed by Render SDK workflows facade).
 */
export class RenderDeployRestAdapter {
  constructor(private readonly opts: Opts) {}

  private async req<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<T> {
    const root = normalizeBase(this.opts.baseUrl);
    const url = `${root}/v1${path}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          Accept: "application/json",
          ...(body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text.length ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      if (!res.ok) {
        const msg =
          typeof parsed === "object" &&
          parsed !== null &&
          "message" in parsed &&
          typeof (parsed as { message?: string }).message === "string"
            ? (parsed as { message: string }).message
            : text.slice(0, 400);
        throw new AppError(
          "RENDER_DEPLOY",
          `Render API ${res.status}: ${msg}`,
          res.status >= 400 && res.status < 600 ? res.status : 502
        );
      }
      return parsed as T;
    } catch (e) {
      if (e instanceof AppError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError("RENDER_DEPLOY", msg, 502);
    } finally {
      clearTimeout(t);
    }
  }

  async createWebService(body: Record<string, unknown>): Promise<{
    service?: { id?: string; serviceDetails?: { url?: string } };
    deployId?: string;
  }> {
    return this.req("POST", "/services", body);
  }

  async getDeploy(serviceId: string, deployId: string): Promise<{
    status?: string;
  }> {
    return this.req(
      "GET",
      `/services/${encodeURIComponent(serviceId)}/deploys/${encodeURIComponent(deployId)}`
    );
  }

  async getService(serviceId: string): Promise<{
    serviceDetails?: { url?: string };
  }> {
    return this.req(
      "GET",
      `/services/${encodeURIComponent(serviceId)}`
    );
  }
}
