# Live integration unification plan

## Current state

Tested adapters exist for NWS, Open-Meteo, Columbia Weather Systems (CWS), and Honeywell
Safety Suite under `src/integrations/`. The running app separately fetches NWS and
Open-Meteo through `server/public/script.js` and the server weather proxy. This duplicates
normalization, freshness, error, and source-label behavior.

The Plume Model also supports manual weather and CWS CSV import. Those paths should
remain available as explicit fallbacks.

## Target routing

1. Define one server-side `Observation` service using the tested weather adapters.
2. Return a versioned observation contract with source, observation time, retrieval
   time, units, freshness, location, and provider metadata.
3. Route command and plume weather UI through that contract.
4. Preserve manual entry and CSV import as separately labeled sources.
5. Add adapter contract tests before removing duplicate frontend normalization.
6. Keep secrets server-side and redact them from logs/exports.

No existing weather calculation or frontend path is changed by this plan.

## Blockers

- **Live CWS integration blocked pending approved endpoint artifacts.** Required:
  authorized endpoint URL shape, sample payload, units, authentication method, firmware
  version, and polling limits.
- **Safety Suite integration blocked pending approved endpoint artifacts.** Required:
  approved local endpoint documentation/sample, version, authorization, credentials
  provisioning method, and representative payloads.

Do not infer endpoints, scrape login pages, add hidden APIs, or add credentials to the
repository.

## Approval gates

- approved endpoint artifacts are stored or referenced securely;
- mock fixtures contain no credentials or sensitive operational data;
- stale/offline behavior is tested;
- adapter output matches the shared schema; and
- the running UI has a reversible feature flag during migration.
