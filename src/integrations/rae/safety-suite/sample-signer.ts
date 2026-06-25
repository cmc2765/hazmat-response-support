// Default signRequestFn compatible with sample/mock-server. SHA-256 over
// "secretKeyBase64\n" + canonicalized envelope fields.
// Browser-compatible via SubtleCrypto. In production, register a Honeywell-
// provided algorithm instead.

import type { SignRequestFn } from "./crypto";

function canonicalize(env: { appid?: string; uri?: string; data?: unknown; random?: number }): string {
  return [
    env.appid ?? "",
    env.uri ?? "",
    env.data === undefined ? "" : JSON.stringify(env.data),
    env.random ?? "",
  ].join("|");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

export const sha256SignRequest: SignRequestFn = async ({ appId, uri, data, random, secretKeyBase64 }) => {
  const canonical = canonicalize({ appid: appId, uri, data, random });
  return sha256Hex(`${secretKeyBase64}\n${canonical}`);
};
