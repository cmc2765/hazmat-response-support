# Honeywell Safety Suite SDK — API notes

Source: `docs/honeywell-safety-suite-sdk.pdf` (Honeywell International Inc., 2023).
Inclusion does not imply endorsement; quoted structure and field names come from
the SDK user guide for the purpose of building an integration adapter.

> The Safety Suite server exposes a third-party HTTP API and a WebSocket feed.
> Requests are AES/CBC encrypted and signed with an `appid` + `random` pair. The
> SDK guide defers the exact `sign` formula and a complete Java/Python sample to
> "support team contact" — see [Signing & encryption](#signing--encryption) below.

## Endpoints (HTTP, POST `application/json`)

Base URL: department-local Safety Suite server (e.g., `https://safety-suite.lan:8443`).
All paths are prefixed `/third/gas/v1/`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/third/gas/v1/getSiteList` | Full site list (id, name, city, country, lat/lng center, zip, address). |
| POST | `/third/gas/v1/getWorkerList` | Worker list, optionally filtered by `workerId`. |
| POST | `/third/gas/v1/getDeviceList` | Device list filtered by `sensorName`, `serialNo`, `isOnline`, `siteId`. |
| POST | `/third/gas/v1/getHisDeviceData` | Historical device readings with paging. |
| POST | `/third/gas/v1/getHisEventData` | Historical alarm/alert events with paging. |

`content-type=application/text` is used for **responses**, not requests — responses
are AES/CBC encrypted base64 strings (the SDK sample Java decrypts the response).

## WebSocket

- URI: `/third/ws/v1`.
- Client must send a `ping` every 60–90 seconds.
- A `subscribeRtData` message must be re-sent every 60 seconds to keep the
  subscription alive (avoid pushing waste from missed unsubscribes).

### Subscribe request shape
```json
{
  "data": [{
    "type": 1,                  // 1=tenant, 2=site, 4=device, 5=worker
    "id": [1, 2],               // ids matching the type
    "subDataType": [1]          // 1=event, 2=reading(contains location), 3=online/offline (only for type≠site)
  }],
  "flag": 1,
  "msgId": "GKJoh3WZb873Vx4DBW",
  "msgType": "subscribeRtData",
  "sign": "$SIGN",
  "sndTime": 1593919901000
}
```

### Server-published reading shape (subscribed realtime)
```json
{
  "data": {
    "events": [{
      "deviceId": 1,
      "eventCode": 11,
      "time": 1571030843000,
      "startFlag": 1,            // 1=start, 2=stop
      "type": 1                   // 1=alarm, 2=alert
    }],
    "workerId": 123,
    "gps": { "lat": 11, "lng": 222 },
    "time": 1593919910376,
    "online": 1,
    "reading": [{
      "data": [{
        "decimalPoint": 0,
        "detectionMode": 0,        // see SDK §6.3
        "name": "CO",
        "unit": "ppm",
        "val": 0.0
      }],
      "online": 1,
      "deviceId": 1234,
      "time": 1593919910376,
      "gps": { "lng": 123, "lat": 345 }
    }]
  },
  "flag": 1,
  "msgId": "GKJoh3WZb873Vx4DBW",
  "msgType": "subscribeRtData",
  "sign": "$SIGN",
  "sndTime": 1593919913766
}
```

### Device record (from `getDeviceList`)
```json
{
  "id": 926,
  "isOnline": 0,
  "onlineTime": "2020-04-13 07:54:58",
  "offlineTime": "2020-04-13 08:15:43",
  "nickName": "",
  "assetType": "GasDetector",
  "assignSites": ["site"],
  "serialNumber": "001F001231",
  "status": 2,                    // 1=stock, 2=active, 3=maintenance, 4=archived
  "name": "MultiRAE",
  "brand": "RAE",
  "model": "PGM-6220",
  "location": "Energy Point",
  "gps": { "lat": 31.4038, "lng": 121.2113 },
  "assignedTo": ["user2"],
  "battery": 100,
  "alarmInfo": {
    "alarms": [41],
    "sensorAlarms": [{ "name": "CO", "alarm": 2 }]
  },
  "type": 1,                      // 0=fixed, 1=portable, 2=transportable
  "sensorList": [{
    "idx": 0,
    "alarm": [0],
    "special": 0,
    "detectionMode": 0,
    "val": 0.1,
    "decimalPoint": 1,
    "name": "h2s",
    "unit": "ppm"
  }]
}
```

### Detection mode constants (§6.3)
- `0` Normal
- `1` TubeSampling
- `2` WarmingUp
- `3` DisabledTemporary
- `255` AlarmOccurring

## Signing & encryption

The SDK guide shows a Java sample for AES/CBC decryption (`AES/CBC/PKCS5Padding`,
Bouncy Castle provider). The exact `$SIGN` formula and the full request-encryption
flow are referenced as "sample code on request from support." Until we obtain
those samples, the adapter:

1. Stores `appid`, `secretKey`, and AES IV in IndexedDB secrets.
2. Wraps requests in the documented JSON envelope (`appid`, `data`, `random`,
   `sign`, `uri`).
3. Treats `sign` and request-payload encryption as a documented stub (`signRequest`).
4. Treats response decryption (`decryptResponse`, AES/CBC, base64 → JSON) as a
   real AES/CBC path so the wire format round-trips once `secretKey`/`iv` are
   populated.

## Adapter status

The adapter implements the documented envelope, normalization of the documented
reading shape, and the historical REST queries. The signing and request-encryption
functions are documented stubs (clearly marked) until Honeywell's full sample is
available.
