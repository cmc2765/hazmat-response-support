# Safety Suite mock server

A minimal Node server that speaks the documented Honeywell Safety Suite SDK
protocol so a client can be exercised end-to-end without real Safety Suite
hardware. The app doesn't call this yet — live RAE monitor integration is
still future work (see `CONTRIBUTING.md`) — but the adapter code in
`src/integrations/rae/safety-suite/` is real and tested against this mock.

Implements:

- **Plain HTTP** server (no TLS). Reverse-proxy for HTTPS in production.
- `POST /third/gas/v1/{getSiteList, getWorkerList, getDeviceList, getHisDeviceData, getHisEventData}`
  with the documented `{ appid, data, random, sign, uri }` envelope.
- Response body is AES/CBC PKCS5Padding-encrypted base64 (matches the SDK's
  Java decryption sample).
- WebSocket at `/third/ws/v1` that emits the documented `subscribeRtData`
  reading frames every 2 seconds.

> The `$SIGN` formula is verified against `SHA-256(SIGN_SECRET || "\n" || canonical)`.
> The adapter's `sha256SignRequest` matches this exactly. When Honeywell provides
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

> **Plain HTTP, port 8443.** No SSL/TLS. A future live-integration UI would need to either
> call this through a same-origin proxy on the Hono server, or accept the mixed-content
> restrictions of calling plain HTTP directly from an HTTPS page.

## End-to-end (verified)

Standalone Node sample — exercises the adapter directly, no UI involved:

```bash
npm run sample:mock    # terminal 1
npm run sample:client  # terminal 2
# [sample] devices: [ '001F001231', '001F001232' ]
# [sample] sites:   [ 'Austin Fire Depart', 'Refinery North' ]
# [sample] rt device=926 t=… CO=15ppm, H2S=7ppm, LEL=34%LEL, O2=36%
```

There is no UI wiring for this yet (no "Sensors" page in `server/public/`). Once live RAE
integration is built, it'll likely proxy through the Hono server rather than the old Vite
dev-server proxy this doc used to describe.

## Environment variables

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `8443` | TCP port. Plain HTTP. |
| `APP_ID` | `98bcdc21-…` | Must match the value sent in the request envelope. |
| `SIGN_SECRET` | `dev-sign-secret` | Used in the SHA-256 sign formula. |
| `AES_KEY_B64` | 16 bytes of `0x01` (`AQEBAQ…`) | Must match the adapter's secretKey field. |
| `AES_IV` | 16 zero bytes | Must match the adapter's AES IV field. 16 ASCII chars or 16 raw bytes. |
| `PRINT_KEYS` | `1` | Set to `0` to silence the credential echo on startup. |

## Tests

`test/safety-suite-crypto.test.ts` independently proves the AES/CBC PKCS5Padding path is
byte-compatible with this mock's encrypted responses.
