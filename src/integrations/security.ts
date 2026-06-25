import Dexie, { type Table } from "dexie";
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

export class SecretsDB extends Dexie {
  secrets!: Table<StoredSecret, string>;

  constructor() {
    super("hazmat-secrets");
    this.version(1).stores({
      secrets: "integrationId,kind",
    });
  }
}

export const secretsDb = new SecretsDB();

export async function putSecret(s: StoredSecret): Promise<void> {
  await secretsDb.secrets.put(s);
}

export async function getSecret(integrationId: string): Promise<StoredSecret | undefined> {
  return secretsDb.secrets.get(integrationId);
}

export async function deleteSecret(integrationId: string): Promise<void> {
  await secretsDb.secrets.delete(integrationId);
}

export async function listSecrets(): Promise<StoredSecret[]> {
  return secretsDb.secrets.toArray();
}

export function maskSecret(secret?: string): string {
  if (!secret) return "";
  if (secret.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, secret.length - 4))}${secret.slice(-4)}`;
}
