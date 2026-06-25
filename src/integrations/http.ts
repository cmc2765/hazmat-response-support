import type { IntegrationConfig } from "@/lib/schema";

export interface SafeHttpOptions extends RequestInit {
  url: string;
  integrationId: string;
  auth?: { username?: string; password?: string; apiKey?: string };
}

export class IntegrationHttpError extends Error {
  status: number;
  integrationId: string;
  url: string;
  constructor(opts: { message: string; status: number; integrationId: string; url: string }) {
    super(opts.message);
    this.name = "IntegrationHttpError";
    this.status = opts.status;
    this.integrationId = opts.integrationId;
    this.url = opts.url;
  }
}

function buildHeaders(opts: SafeHttpOptions, nwsUserAgent?: string): Headers {
  const headers = new Headers(opts.headers);
  if (opts.auth?.apiKey) {
    headers.set("Authorization", `Bearer ${opts.auth.apiKey}`);
  } else if (opts.auth?.username && opts.auth.password) {
    const token = btoa(`${opts.auth.username}:${opts.auth.password}`);
    headers.set("Authorization", `Basic ${token}`);
  }
  if (nwsUserAgent) {
    headers.set("User-Agent", nwsUserAgent);
    headers.set("Accept", "application/geo+json");
  }
  return headers;
}

export async function safeFetchJson<T>(opts: SafeHttpOptions, nwsUserAgent?: string): Promise<T> {
  const headers = buildHeaders(opts, nwsUserAgent);
  const res = await fetch(opts.url, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new IntegrationHttpError({
      message: `HTTP ${res.status}: ${text.slice(0, 120).replace(/[\r\n]+/g, " ")}`,
      status: res.status,
      integrationId: opts.integrationId,
      url: opts.url,
    });
  }
  return (await res.json()) as T;
}

export async function safeFetchText(opts: SafeHttpOptions, nwsUserAgent?: string): Promise<string> {
  const headers = buildHeaders(opts, nwsUserAgent);
  const res = await fetch(opts.url, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new IntegrationHttpError({
      message: `HTTP ${res.status}: ${text.slice(0, 120).replace(/[\r\n]+/g, " ")}`,
      status: res.status,
      integrationId: opts.integrationId,
      url: opts.url,
    });
  }
  return res.text();
}

export function logIntegrationError(cfg: IntegrationConfig, err: unknown): void {
  const status = err instanceof IntegrationHttpError ? err.status : "n/a";
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[integration:${cfg.kind}:${cfg.id}] status=${status} ${message}`);
}
