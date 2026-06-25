# Safety Suite mock server

A minimal Node server that speaks the documented Honeywell Safety Suite SDK
protocol so the PWA (or any other client) can be exercised end-to-end without
real Safety Suite hardware.

Implements:

- **Plain HTTP** server (no TLS). Reverse-proxy for HTTPS in production.
- `POST /third/gas/v1/{getSiteList, getWorkerList, getDeviceList, getHisDeviceData, getHisEventData}`
  with the documented `{ appid, data, random, sign, uri }` envelope.
- Response body is AES/CBC PKCS5Padding-encrypted base64 (matches the SDK's
  Java decryption sample).
- WebSocket at `/third/ws/v1` that emits the documented `subscribeRtData`
  reading frames every 2 seconds.

> The `$SIGN` formula is verified against `SHA-256(SIGN_SECRET || "\n" || canonical)`.
> The PWA's `sha256SignRequest` matches this exactly. When Honeywell provides
> the real signing formula, register it via `registerSignRequestFn(fn)`.

## Run

```bash
npm run sample:mock
```

Output:

```
[mock] APP_ID       = 98bcdc21-68c1-4216-84a4-d99d30cb61db
[mock] SIGN_SECRET  = dev-sign-secret
[mock] AES_KEY_B64  = AQEBAQEBAQEBAQEBAQEBAQ==
[mock] AES_IV (str) = "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000"
[mock] HTTP + WS listening on http://localhost:8443
```

> **Plain HTTP, port 8443.** No SSL/TLS. If you see an SSL error in the
> browser, you are pointing the PWA at `https://localhost:8443` (wrong) or
> the PWA is being served from an HTTPS origin and the browser is blocking
> the mixed-content fetch. Use the proxy path described below — it makes
> everything same-origin plain HTTP.

## End-to-end (verified)

### Option A — direct (PWA from localhost, mock on plain HTTP)

```bash
# Terminal 1
npm run sample:mock

# Terminal 2
npm run dev
# open http://localhost:5173 → Sensors → check "Use mock server"
# The form auto-fills /safety-suite as base URL — keep it.
# Save → Connect → readings appear within ~2s.
```

The PWA points at `/safety-suite/...` (same-origin) and the Vite dev proxy
forwards to `http://localhost:8443/...`. No SSL anywhere.

### Option B — standalone Node sample (no PWA)

```bash
npm run sample:mock    # terminal 1
npm run sample:client  # terminal 2
# [sample] devices: [ '001F001231', '001F001232' ]
# [sample] sites:   [ 'Austin Fire Depart', 'Refinery North' ]
# [sample] rt device=926 t=… CO=15ppm, H2S=7ppm, LEL=34%LEL, O2=36%
```

## Environment variables

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `8443` | TCP port. Plain HTTP. |
| `APP_ID` | `98bcdc21-…` | Must match the value sent in the request envelope. |
| `SIGN_SECRET` | `dev-sign-secret` | Used in the SHA-256 sign formula. |
| `AES_KEY_B64` | 16 bytes of `0x01` (`AQEBAQ…`) | Must match the PWA's secretKey field. |
| `AES_IV` | 16 zero bytes | Must match the PWA's AES IV field. 16 ASCII chars or 16 raw bytes. |
| `PRINT_KEYS` | `1` | Set to `0` to silence the credential echo on startup. |

## Why a Vite proxy?

When you serve the PWA from `http://localhost:5173` and the mock from
`http://localhost:8443`, two things can break:

1. **CORS** — browsers block cross-origin POST + WebSocket unless the mock
   returns the right `Access-Control-Allow-*` headers. The mock doesn't.
2. **Mixed content** — if you ever serve the PWA over HTTPS (or load it from a
   non-`localhost` host), the browser refuses to fetch plain HTTP at all.

The Vite dev proxy in `vite.config.ts` mounts the mock under the same origin
(`/safety-suite/...`) so the browser never sees a cross-origin or
mixed-content fetch. In production, deploy the mock behind a reverse proxy
on the same host as the PWA.

## Tests

The PWA's `test/safety-suite-crypto.test.ts` independently proves the AES/CBC
PKCS5Padding path is byte-compatible with this mock's encrypted responses.
