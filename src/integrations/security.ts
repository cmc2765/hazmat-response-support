import type { IntegrationConfig } from "@/lib/schema";

export interface StoredSecret {
  integrationId: string;
  kind: IntegrationConfig["kind"];
  apiKey?: string;
  username?: string;
  password?: string;
  appId?: string;
  secretKey?: string;
  iv?: string;
  createdAt: string;
}

// In-memory for now — these adapters aren't wired into a live caller yet (see Future phases:
// live integrations). Once they are, this should become a real server-side store (e.g. a
// SQLite table alongside the rest of the data) rather than the old browser-IndexedDB approach.
const secrets = new Map<string, StoredSecret>();

export async function putSecret(s: StoredSecret): Promise<void> {
  secrets.set(s.integrationId, s);
}

export async function getSecret(integrationId: string): Promise<StoredSecret | undefined> {
  return secrets.get(integrationId);
}

export async function deleteSecret(integrationId: string): Promise<void> {
  secrets.delete(integrationId);
}

export async function listSecrets(): Promise<StoredSecret[]> {
  return Array.from(secrets.values());
}

export function maskSecret(secret?: string): string {
  if (!secret) return "";
  if (secret.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, secret.length - 4))}${secret.slice(-4)}`;
}
