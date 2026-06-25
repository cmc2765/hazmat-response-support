#!/usr/bin/env node
// HoneyWell Safety Suite (LAN) mock server.
// Implements the SDK surface documented in docs/honeywell-safety-suite-sdk.md:
//
//   - HTTPS-ready Node HTTP server (run behind a reverse proxy / add TLS at the edge)
//   - POST /third/gas/v1/{getSiteList,getWorkerList,getDeviceList,getHisDeviceData,getHisEventData}
//     Request: { appid, data, random, sign, uri? }  (sign is currently a stub token)
//     Response: AES/CBC PKCS5Padding-encrypted JSON (base64). Key + IV come from env.
//   - WS /third/ws/v1 with subscribeRtData (re-subscribe every 60s, ping every 75s).
//     Server publishes synthetic readings every ~2s with the documented shape.
//
// Sign is verified against a shared secret using a simple SHA-256 of the canonical
// request bytes. The PWA's signing-stub helper is replaced by registerSignRequestFn
// pointing at the same algorithm; for production the real Honeywell formula goes there.
//
// Run:
//   node sample/mock-server/server.js
// Env:
//   PORT (default 8443), APP_ID, SIGN_SECRET, AES_KEY_B64, AES_IV (16 raw bytes),
//   TLS (set to 1 and provide KEY_FILE/CERT_FILE to enable HTTPS).

import http from "node:http";
import { createHash, createCipheriv } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8443);
const APP_ID = process.env.APP_ID ?? "98bcdc21-68c1-4216-84a4-d99d30cb61db";
const SIGN_SECRET = process.env.SIGN_SECRET ?? "dev-sign-secret";
const AES_KEY_B64 = process.env.AES_KEY_B64 ?? Buffer.alloc(16, 1).toString("base64");
const AES_IV = process.env.AES_IV ?? String.fromCharCode(...new Array(16).fill(0));
const PRINT_KEYS = process.env.PRINT_KEYS !== "0";

if (PRINT_KEYS) {
  console.log("[mock] APP_ID       =", APP_ID);
  console.log("[mock] SIGN_SECRET  =", SIGN_SECRET);
  console.log("[mock] AES_KEY_B64  =", AES_KEY_B64);
  console.log("[mock] AES_IV (str) =", JSON.stringify(AES_IV));
}

const aesKey = Buffer.from(AES_KEY_B64, "base64");
const aesIv = Buffer.from(AES_IV, "binary");

function encryptResponse(plain) {
  const cipher = createCipheriv("aes-128-cbc", aesKey, aesIv);
  return Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]).toString("base64");
}

function verifySign(envelope) {
  if (!envelope || envelope.appid !== APP_ID) return false;
  if (!envelope.sign || typeof envelope.sign !== "string") return false;
  const canonical = canonicalize(envelope);
  const expected = createHash("sha256").update(SIGN_SECRET).update("\n").update(canonical).digest("hex");
  return expected === envelope.sign;
}

function canonicalize(env) {
  const { appid, uri, data, random } = env;
  const dataStr = data === undefined ? "" : JSON.stringify(data);
  return [appid ?? "", uri ?? "", dataStr, random ?? ""].join("|");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 1_000_000) req.destroy(); });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const sites = [
  { siteId: 76, name: "Austin Fire Depart", city: "Austin", country: "United States",
    countryName: "United States", province: "TX", center: "-97.7431,30.2672",
    zip: "78701", address1: "1001 W Oak St" },
  { siteId: 77, name: "Refinery North", city: "Houston", country: "United States",
    countryName: "United States", province: "TX", center: "-95.3698,29.7604",
    zip: "77002", address1: "200 Bayou Dr" },
];

const workers = [
  { workerId: 198, userName: "Troy Walsh", firstName: "Troy", middleName: "", lastName: "Walsh",
    email: "troy@example.gov", phone: "", sites: [{ id: 76, name: "Austin Fire Depart" }],
    status: 1, nationCode: "1" },
];

const devices = [
  { id: 926, isOnline: 1, onlineTime: "2025-01-01 07:54:58", offlineTime: "",
    nickName: "", assetType: "GasDetector", assignSites: ["Austin"],
    serialNumber: "001F001231", status: 2, name: "MultiRAE", brand: "RAE", model: "PGM-6220",
    location: "Energy Point", gps: { lat: 30.2672, lng: -97.7431 },
    assignedTo: ["Troy Walsh"], battery: 92,
    alarmInfo: { alarms: [], sensorAlarms: [] }, type: 1,
    sensorList: [
      { idx: 0, alarm: [0], special: 0, detectionMode: 0, val: 0.0, decimalPoint: 0, name: "CO", unit: "ppm" },
      { idx: 1, alarm: [0], special: 0, detectionMode: 0, val: 0.0, decimalPoint: 1, name: "H2S", unit: "ppm" },
      { idx: 2, alarm: [0], special: 0, detectionMode: 0, val: 0.0, decimalPoint: 1, name: "LEL", unit: "%LEL" },
      { idx: 3, alarm: [0], special: 0, detectionMode: 0, val: 20.9, decimalPoint: 1, name: "O2", unit: "%" },
    ] },
  { id: 927, isOnline: 1, onlineTime: "2025-01-01 07:55:00", offlineTime: "",
    nickName: "", assetType: "GasDetector", assignSites: ["Austin"],
    serialNumber: "001F001232", status: 2, name: "AreaRAE", brand: "RAE", model: "PGM-6225",
    location: "Bay 3", gps: { lat: 30.2680, lng: -97.7440 },
    assignedTo: ["Troy Walsh"], battery: 87,
    alarmInfo: { alarms: [], sensorAlarms: [] }, type: 0,
    sensorList: [
      { idx: 0, alarm: [0], special: 0, detectionMode: 0, val: 0.0, decimalPoint: 0, name: "CO", unit: "ppm" },
      { idx: 1, alarm: [0], special: 0, detectionMode: 0, val: 0.0, decimalPoint: 1, name: "NO2", unit: "ppm" },
    ] },
];

const historicalReading = (serialNo, time) => ({
  serialNo,
  deviceId: devices.find((d) => d.serialNumber === serialNo)?.id ?? 0,
  time,
  data: [
    { detectionMode: 0, val: Math.floor(Math.random() * 5), decimalPoint: 0, name: "CO", unit: "ppm" },
    { detectionMode: 0, val: Math.floor(Math.random() * 100) / 10, decimalPoint: 1, name: "H2S", unit: "ppm" },
    { detectionMode: 0, val: Math.floor(Math.random() * 50) / 10, decimalPoint: 1, name: "LEL", unit: "%LEL" },
  ],
  gps: { lat: 30.2672, lng: -97.7431 },
});

const events = [
  { id: 1, event: "GAS_ALARM_HIGH", eventCode: 11, eventCategory: 1, reported: Date.now(),
    serialNo: "001F001231", doneBy: "", type: 1, sensorName: ["CO"],
    gps: { lat: 30.2672, lng: -97.7431 },
    sensorList: [{ idx: 0, alarm: [10], detectionMode: 0, val: 0.0, decimalPoint: 0, name: "CO", unit: "ppm" }],
    equipmentType: "GasDetector", modelName: "MultiRAE", zoneName: "Demo",
    timeElapsed: 4200, siteName: "Austin Fire Depart", workerId: 198,
    workerName: "Troy Walsh", equipmentId: 926, modelId: "PGM-6220", equipmentTypeId: 2 },
];

const handlers = {
  "/third/gas/v1/getSiteList": (_data) => ({ rtData: { siteList: sites, total: sites.length } }),
  "/third/gas/v1/getWorkerList": (_data) => ({ rtData: { workerList: workers, total: workers.length } }),
  "/third/gas/v1/getDeviceList": (_data) => ({ rtData: { deviceList: devices, total: devices.length } }),
  "/third/gas/v1/getHisDeviceData": (_data) => {
    const now = Date.now();
    const rows = devices.map((d) => historicalReading(d.serialNumber, now));
    return { rtData: { total: rows.length, currentPageSize: rows.length, currentPageNo: 1, deviceData: rows } };
  },
  "/third/gas/v1/getHisEventData": (_data) => ({
    rtData: { total: events.length, currentPageSize: events.length, currentPageNo: 1, events },
  }),
};

function reply(res, status, body, contentType) {
  res.writeHead(status, { "Content-Type": contentType ?? "application/text", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

const httpServer = http.createServer(async (req, res) => {
  try {
    if (!req.url) return reply(res, 400, "");
    const path = req.url.split("?")[0];
    if (!path.startsWith("/third/gas/v1/")) return reply(res, 404, "Not Found");
    const handler = handlers[path];
    if (!handler) return reply(res, 404, "Not Found");
    const envelope = await readJson(req);
    if (!verifySign(envelope)) {
      console.warn(`[mock] rejected request to ${path}: bad sign or appid`);
      return reply(res, 403, JSON.stringify({ error: "bad sign or appid" }), "application/json");
    }
    const payload = handler(envelope.data ?? {});
    const cipherText = encryptResponse(JSON.stringify(payload));
    reply(res, 200, cipherText);
  } catch (err) {
    console.error("[mock] http error:", err);
    reply(res, 500, "Internal Server Error");
  }
});

const wss = new WebSocketServer({ server: httpServer, path: "/third/ws/v1" });

wss.on("connection", (ws, req) => {
  console.log("[mock] ws connected:", req.socket.remoteAddress);
  ws.subscribed = false;
  let interval = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.msgType === "ping") {
      ws.send(JSON.stringify({ msgType: "pong", sndTime: Date.now() }));
      return;
    }
    if (msg.msgType === "subscribeRtData") {
      ws.subscribed = true;
      ws.send(JSON.stringify({ data: {}, errCode: 0, flag: 2, msgId: msg.msgId, msgType: "subscribeRtData", sndTime: Date.now() }));
    }
  });

  ws.on("close", () => {
    console.log("[mock] ws closed");
    if (interval) clearInterval(interval);
  });

  interval = setInterval(() => {
    if (!ws.subscribed || ws.readyState !== ws.OPEN) return;
    const now = Date.now();
    const reading = {
      data: [{
        data: devices[0].sensorList.map((s) => ({
          decimalPoint: s.decimalPoint,
          detectionMode: s.detectionMode,
          name: s.name,
          unit: s.unit,
          val: Math.floor(Math.random() * 50),
        })),
        online: 1,
        deviceId: devices[0].id,
        time: now,
        gps: devices[0].gps,
      }],
      workerId: workers[0].workerId,
      gps: devices[0].gps,
      time: now,
      online: 1,
      reading: undefined,
    };
    ws.send(JSON.stringify({
      data: {
        events: [],
        workerId: workers[0].workerId,
        gps: devices[0].gps,
        time: now,
        online: 1,
        reading: [{
          data: devices[0].sensorList.map((s) => ({
            decimalPoint: s.decimalPoint,
            detectionMode: Math.random() < 0.02 ? 255 : 0,
            name: s.name,
            unit: s.unit,
            val: Math.floor(Math.random() * 50),
          })),
          online: 1,
          deviceId: devices[0].id,
          time: now,
          gps: devices[0].gps,
        }],
      },
      flag: 1,
      msgId: "rt-" + now,
      msgType: "subscribeRtData",
      sndTime: now,
    }));
    void reading;
  }, 2000);
});

httpServer.listen(PORT, () => {
  console.log(`[mock] HTTP + WS listening on http://localhost:${PORT}`);
  console.log(`[mock] REST endpoints: /third/gas/v1/{getSiteList,getWorkerList,getDeviceList,getHisDeviceData,getHisEventData}`);
  console.log(`[mock] WebSocket: /third/ws/v1`);
});
