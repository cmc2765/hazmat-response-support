import { describe, expect, it } from "vitest";
import {
  buildRequestEnvelope,
  decryptResponseJson,
  importAesKey,
  signRequest,
  registerSignRequestFn,
} from "@/integrations/rae/safety-suite/crypto";
import { createCipheriv, randomBytes } from "node:crypto";

async function makeKeys() {
  const secretKey = randomBytes(16);
  const ivBytes = randomBytes(16);
  const secretKeyBase64 = secretKey.toString("base64");
  return {
    appId: "98bcdc21-68c1-4216-84a4-d99d30cb61db",
    secretKeyBase64,
    iv: ivBytes.toString("binary"),
    ivBytes,
  };
}

function encryptString(plain: string, key: Buffer, iv: Buffer): string {
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
  return enc.toString("base64");
}

describe("safety-suite crypto", () => {
  it("buildRequestEnvelope produces the documented shape", () => {
    const env = buildRequestEnvelope({
      appId: "abc",
      uri: "/third/gas/v1/getSiteList",
      data: { x: 1 },
      random: 42,
      sign: "SIG",
    });
    expect(env).toEqual({
      appid: "abc",
      data: { x: 1 },
      random: 42,
      sign: "SIG",
      uri: "/third/gas/v1/getSiteList",
    });
  });

  it("signRequest throws unless a custom signer is registered", async () => {
    registerSignRequestFn(null);
    await expect(
      signRequest({ appId: "a", uri: "/x", data: {}, random: 1, secretKeyBase64: "x", iv: "y" }),
    ).rejects.toThrow(/signing is not configured/);
  });

  it("decryptResponseJson round-trips AES/CBC PKCS5 ciphertext", async () => {
    const keys = await makeKeys();
    const keyBuf = Buffer.from(keys.secretKeyBase64, "base64");
    const ivBuf = keys.ivBytes;
    const plain = JSON.stringify({ rtData: { siteList: [{ siteId: 76, name: "Austin" }] } });
    const cipher = encryptString(plain, keyBuf, ivBuf);
    const decoded = await decryptResponseJson<{ rtData: { siteList: Array<{ siteId: number; name: string }> } }>(
      cipher,
      keys,
    );
    expect(decoded.rtData.siteList[0].name).toBe("Austin");
  });

  it("importAesKey returns a usable CryptoKey", async () => {
    const keys = await makeKeys();
    const k = await importAesKey(keys.secretKeyBase64);
    expect(k.algorithm.name).toBe("AES-CBC");
    expect(k.usages).toContain("decrypt");
  });
});
