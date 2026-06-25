// Safety Suite cryptographic helpers.
// Source: docs/honeywell-safety-suite-sdk.md and the SDK's Java sample for AES/CBC.
//
// The SDK guide references Java/Python sample code "available from support" for
// the full request signing and request-payload encryption. Until that sample is
// obtained, we ship:
//
//   - decryptResponse: full AES/CBC PKCS5Padding implementation that matches
//     the documented Java sample (Cipher.getInstance("AES/CBC/PKCS5Padding")).
//   - signRequest: a documented stub that throws unless the user supplies a
//     custom sign function. The stub still produces a deterministic envelope so
//     integration tests can validate request shape.

export interface SafetySuiteCryptoKeys {
  appId: string;
  secretKeyBase64: string;
  iv: string;
}

export interface SafetySuiteRequest {
  appid: string;
  data: unknown;
  random: number;
  sign: string;
  uri?: string;
}

export interface SignRequestFn {
  (args: {
    appId: string;
    uri: string;
    data: unknown;
    random: number;
    secretKeyBase64: string;
    iv: string;
  }): Promise<string>;
}

let customSigner: SignRequestFn | null = null;

export function registerSignRequestFn(fn: SignRequestFn | null): void {
  customSigner = fn;
}

export async function signRequest(args: {
  appId: string;
  uri: string;
  data: unknown;
  random: number;
  secretKeyBase64: string;
  iv: string;
}): Promise<string> {
  if (customSigner) return customSigner(args);
  throw new Error(
    "Safety Suite request signing is not configured. " +
      "Provide signRequestFn via registerSignRequestFn() or contact Honeywell support for the SDK sample.",
  );
}

function b64ToBytes(b64: string): Uint8Array {
  const raw = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToString(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  return Buffer.from(bytes).toString("utf-8");
}

function normalizeIv(iv: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(iv, "binary");
    if (buf.length === 16) return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    if (buf.length > 16) return new Uint8Array(buf.buffer, buf.byteOffset, 16);
    const padded = new Uint8Array(16);
    padded.set(buf);
    return padded;
  }
  const bytes = new TextEncoder().encode(iv);
  if (bytes.length === 16) return bytes;
  if (bytes.length < 16) {
    const padded = new Uint8Array(16);
    padded.set(bytes);
    return padded;
  }
  return bytes.slice(0, 16);
}

export async function importAesKey(secretKeyBase64: string): Promise<CryptoKey> {
  const keyBytes = b64ToBytes(secretKeyBase64);
  return crypto.subtle.importKey("raw", keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer, { name: "AES-CBC" }, false, ["decrypt"]);
}

export async function decryptResponse(cipherText: string, keys: SafetySuiteCryptoKeys): Promise<string> {
  const key = await importAesKey(keys.secretKeyBase64);
  const iv = normalizeIv(keys.iv);
  const cipherBytes = b64ToBytes(cipherText);
  const cipherBuf = cipherBytes.buffer.slice(
    cipherBytes.byteOffset,
    cipherBytes.byteOffset + cipherBytes.byteLength,
  ) as ArrayBuffer;
  const ivBuf = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-CBC", iv: ivBuf }, key, cipherBuf);
  return bytesToString(new Uint8Array(plainBuf));
}

export async function decryptResponseJson<T>(cipherText: string, keys: SafetySuiteCryptoKeys): Promise<T> {
  const text = await decryptResponse(cipherText, keys);
  return JSON.parse(text) as T;
}

export function buildRequestEnvelope(args: {
  appId: string;
  uri?: string;
  data: unknown;
  random?: number;
  sign: string;
}): SafetySuiteRequest {
  const random = args.random ?? Math.floor(Math.random() * 0xfffffff);
  const req: SafetySuiteRequest = {
    appid: args.appId,
    data: args.data,
    random,
    sign: args.sign,
  };
  if (args.uri) req.uri = args.uri;
  return req;
}

export const ENDPOINTS = {
  siteList: "/third/gas/v1/getSiteList",
  workerList: "/third/gas/v1/getWorkerList",
  deviceList: "/third/gas/v1/getDeviceList",
  hisDeviceData: "/third/gas/v1/getHisDeviceData",
  hisEventData: "/third/gas/v1/getHisEventData",
  ws: "/third/ws/v1",
} as const;
