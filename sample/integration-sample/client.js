#!/usr/bin/env node
// Integration sample: talks to sample/mock-server using the same wire protocol
// the PWA's SafetySuiteAdapter uses.
//
//   - Builds the documented { appid, data, random, sign, uri } envelope
//   - Signs each request with SHA-256(secret || canonical) (matches the mock)
//   - Decrypts AES/CBC PKCS5Padding responses with the same key/iv
//   - Connects the WebSocket and prints realtime readings for ~10s
//
// Run:
//   node sample/integration-sample/client.js
//
// Env (optional):
//   BASE_URL (default http://localhost:8443)
//   APP_ID, SIGN_SECRET, AES_KEY_B64, AES_IV  (default values match the mock)

import http from "node:http";
import { createHash, createDecipheriv } from "node:crypto";
import WebSocket from "ws";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8443";
const APP_ID = process.env.APP_ID ?? "98bcdc21-68c1-4216-84a4-d99d30cb61db";
const SIGN_SECRET = process.env.SIGN_SECRET ?? "dev-sign-secret";
const AES_KEY_B64 = process.env.AES_KEY_B64 ?? Buffer.alloc(16, 1).toString("base64");
const AES_IV = process.env.AES_IV ?? String.fromCharCode(...new Array(16).fill(0));

function postJson(path, data, uri) {
  const random = Math.floor(Math.random() * 0xfffffff);
  const envelope = {
    appid: APP_ID,
    uri,
    data,
    random,
    sign: signEnvelope({ appid: APP_ID, uri, data, random }),
  };
  const body = JSON.stringify(envelope);
  const url = new URL(BASE_URL + path);
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: "POST",
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let chunks = "";
      res.on("data", (c) => { chunks += c; });
      res.on("end", () => resolve({ status: res.statusCode, text: chunks }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function canonicalize(env) {
  return [env.appid ?? "", env.uri ?? "", env.data === undefined ? "" : JSON.stringify(env.data), env.random ?? ""].join("|");
}

function signEnvelope(env) {
  const canonical = canonicalize(env);
  return createHash("sha256").update(SIGN_SECRET).update("\n").update(canonical).digest("hex");
}

function decryptAesCbc(cipherTextB64, keyB64, ivStr) {
  if (!keyB64) throw new Error("AES_KEY_B64 is required");
  const key = Buffer.from(keyB64, "base64");
  const iv = Buffer.from(ivStr ?? "", "binary");
  const enc = Buffer.from(cipherTextB64, "base64");
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf-8");
}

async function fetchDecrypted(path, data, uri) {
  const { status, text } = await postJson(path, data, uri);
  if (status !== 200) throw new Error(`HTTP ${status}: ${text}`);
  if (!AES_KEY_B64 || !AES_IV) throw new Error("AES_KEY_B64 and AES_IV required to decrypt responses");
  return JSON.parse(decryptAesCbc(text, AES_KEY_B64, AES_IV));
}

async function main() {
  console.log(`[sample] connecting to ${BASE_URL}`);
  const devices = await fetchDecrypted("/third/gas/v1/getDeviceList", { isOnline: null }, "/third/gas/v1/getDeviceList");
  console.log(`[sample] devices:`, devices.rtData.deviceList.map((d) => d.serialNumber));

  const sites = await fetchDecrypted("/third/gas/v1/getSiteList", {}, "/third/gas/v1/getSiteList");
  console.log(`[sample] sites:`, sites.rtData.siteList.map((s) => s.name));

  const wsUrl = BASE_URL.replace(/^http/i, "ws") + "/third/ws/v1";
  console.log(`[sample] opening websocket ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  let count = 0;

  ws.on("open", () => {
    ws.send(JSON.stringify({
      data: [{ type: 1, id: null, subDataType: [1, 2, 3] }],
      flag: 1,
      msgId: "subscribe-1",
      msgType: "subscribeRtData",
      sign: signEnvelope({ appid: APP_ID, uri: "subscribeRtData", data: {} }),
      sndTime: Date.now(),
    }));
    setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ msgType: "ping", sndTime: Date.now() }));
    }, 75_000);
  });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.msgType === "subscribeRtData" && msg.data?.reading) {
      for (const r of msg.data.reading) {
        console.log(`[sample] rt device=${r.deviceId} t=${new Date(r.time).toISOString()}`,
          r.data.map((s) => `${s.name}=${s.val}${s.unit}`).join(", "));
        count++;
      }
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 10_000));
  ws.close();
  console.log(`[sample] received ${count} realtime reading frames in 10s`);
}

main().catch((err) => {
  console.error("[sample] error:", err);
  process.exit(1);
});
