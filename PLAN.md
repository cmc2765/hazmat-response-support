# Hazmat Response Support — v1 Plan

> **Status: partially superseded.** The product goals (§1-3) and most of §5-13 still hold.
> §4 (Stack) is out of date — the PWA/React/Vite/Tailwind/Dexie/Workbox/Playwright stack
> described below was replaced with a single Hono server serving a plain HTML/CSS/JS UI
> (`server/public/`) and SQLite, packaged as one Docker container. See [README.md](./README.md)
> for current architecture and [CONTRIBUTING.md](./CONTRIBUTING.md) for current workflow.
> Kept here for the original design rationale and the integrations/risks sections, which
> are still accurate.

## 1. Product overview
Single-user, offline-first PWA for fire-department hazmat. Replaces CAMEO Chemicals + ERG with fast chemical lookup, on-scene plume modeling, NIOSH health data, Tier II facility awareness, incident logging, and live integrations for RAE monitors, online weather, and Columbia Weather Systems microServer.

## 2. Scope (v1, locked)

**Always-on, fully offline:**
- Chemical data: ERG 2024 + CAMEO Chemicals.
- NIOSH Pocket Guide.
- Threat-zone distances (ERG Table 1/3).
- Plume math (Gaussian puff + plume, in-house TS).
- Facilities: Tier II (EPA / state portals / erplan.net).
- Incident log + PDF/JSON export.
- Service worker caches everything; app works on a phone in airplane mode.

**Opt-in, online required:**
- Honeywell RAE monitor readings via Safety Suite local (LAN-only, no cloud).
- Online weather: NWS primary, Open-Meteo fallback.
- Columbia Weather Systems microServer (LAN).

## 3. Out of scope (v1)
Heavy/light gas dispersion, particle deposition, photochemistry, multi-user sync, auth, CAD/ICS, native builds, true multi-physics ALOHA-grade modeling, ProRAE Cloud (deferred), Web Bluetooth single-monitor (deferred).

## 4. Stack
Vite + React + TypeScript, Tailwind + shadcn/ui, Workbox, Dexie, MapLibre GL JS + OpenFreeMap, Zod, Vitest + Playwright, GitHub Actions → static host. No cloud relay, no backend service — all integrations are direct LAN/HTTPS to the source.

## 5. Integrations — concrete paths

### 5a. Honeywell Safety Suite (local, LAN)
- Topology: RAE mesh monitors → Safety Suite running on a dept PC → consumed by the PWA over LAN.
- Data plane: Safety Suite local exposes a data/API surface (typically a REST API on a configurable port, plus CSV/log exports). The API surface varies by Safety Suite version, so:
  1. Adapter pattern (`/src/integrations/rae/safety-suite/adapter.ts`) so version-specific quirks live behind one boundary.
  2. Ship CSV/log replay import as the v1 floor (Safety Suite can export events; user uploads the file).
  3. Add the live REST path once a sample URL + packet capture or API doc page from the install is provided.
- Auth: if Safety Suite local requires a token or basic auth, store in IndexedDB; never logged.
- Readings stream into the incident log timeline and drop markers on the plume map; readings older than N minutes flagged stale.
- No ProRAE Cloud in v1.

### 5b. Online weather
- NWS (api.weather.gov) primary for US.
- Open-Meteo fallback outside NWS coverage and as failover.
- Both keyless and free.
- Required `User-Agent` per NWS ToS set in the client.
- Pulls wind (sustained + gust), direction, temp, RH, cloud cover → auto-fills plume form stability class.
- 30-min cache; manual refresh.

### 5c. Columbia Weather Systems microServer
- Direct LAN HTTPS to the device's documented JSON/CSV endpoint.
- Settings → "Weather stations" → add CWS by URL + optional auth; pick from a list if multiple added.
- Polls every N seconds (default 10s); emits `Observation` events on the same bus as online weather.
- Live adapter wired once endpoint sample + JSON response are provided.

## 6. Plume model (locked)
- In-house TS Gaussian puff + plume; Briggs dispersion; Pasquill–Gifford A–F.
- Bands: AEGL-1/2/3 + ERPG-1/2/3 + TEEL-1/2/3.
- Validation: ~6 published ALOHA example cases, ±20% tolerance, `/docs/model-validation.md`.
- UI honesty: "Modeling estimate. Confirm with ALOHA for legal/operational decisions." on every plume screen, ALOHA download link, model version stamped on every export.

## 7. Data pipeline
```
scripts/
  erg/    cameo/    niosh/    tier2/
  shared/  # Zod schemas, CAS resolver, normalizers
```
Cross-source joins by CAS/UN. Schema drift fails the build.

## 8. Schema highlights
- Chemical, NPGRecord, Facility, PlumeRun as defined in `/src/lib/schema/`.
- Observation (new): source tag (`weather:nws` | `weather:open-meteo` | `cws:<stationId>`), ts, lat, lng, wind, temp, rh, cloudCover, providerMetadata.
- Reading (new): source tag (`rae:safety-suite:<instanceId>`), ts, lat?, lng?, sensors[], battery, runTime, model.
- IntegrationConfig (Dexie): id, kind, label, enabled, url?, apiKey?, pollIntervalSec, lastSeenTs, lastError.

## 9. Repo layout
```
/src
  /app
  /components
  /features
    /chemicals /facilities /threat-zone /plume /incidents /niosh /sensors
  /integrations
    /rae/safety-suite
    /weather
    registry.ts security.ts sync.ts types.ts
  /lib
    /model   # dispersion math
    /db      # Dexie
    /calc    # ERG distances, units
    /schema  # Zod
  /workers
/scripts
/public/data
/docs
```

## 10. Security
- LAN-only integrations; no traffic leaves the site except NWS/Open-Meteo fetches.
- All secrets in IndexedDB via Dexie; never logged; never included in exports by default.
- Single outbound HTTP client strips auth headers from error logs.

## 11. Phasing
1. **M0** Vite/React/TS, Tailwind/shadcn, PWA shell, Dexie, dark mode, routing.
2. **M1** Chemical core (ERG + CAMEO).
3. **M2a** Threat-zone distances + simple map.
4. **M2b** NIOSH NPG.
5. **M3** Plume: math + validation tests → inputs UI → MapLibre polygon + chart + AEGL/ERPG/TEEL bands.
6. **M4** Tier II facilities.
7. **M5** Incident log + PDF/JSON export.
8. **M6** Polish.
9. **M7** Integrations: 7a Weather online, 7b CWS microServer, 7c Safety Suite CSV import, 7d Safety Suite live REST, 7e Sensor map overlay + "compare to isopleth" UI.

## 12. Risks
- Safety Suite API surface is not standardized → adapter pattern + CSV fallback so v1 ships something useful regardless of installed version.
- NWS ToS → proper User-Agent, aggressive caching.
- CWS firmware variance → easy to test once endpoint sample provided.
- Stale readings / wrong re-entry decisions → every plume screen timestamps the driving observation; sensor data is advisory, never authoritative for re-entry; UI copy enforces this.
- Liability on dispersion model → disclaimers, validation suite, version stamping, no claims beyond math.

## 13. What pauses for user-provided artifacts
- Safety Suite local API sample URL (or packet capture of one poll).
- CWS microServer endpoint sample URL + a JSON response.

No live adapters ship guesses. The CSV import path works day-one regardless.
