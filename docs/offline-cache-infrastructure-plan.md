# Offline and cache infrastructure plan

## Status

Planning only. This document authorizes no download, API, scrape, or proprietary-data
use. Every source requires license/permission review before caching.

## Dataset matrix

| Dataset | Candidate source / permission status | Cache method and scope | Refresh / stale indicator | Offline behavior and storage | User warning |
|---|---|---|---|---|---|
| Regional map data | OpenStreetMap-derived provider; ODbL/provider terms review required | Region-selected vector/raster package | Release-based; stale after configured regional update window | Server-managed regional cache | “Offline map may not show recent roads, closures, or structures.” |
| Facility data | Agency Tier II/E-Plan authorized export; permission required | Organization/region-scoped encrypted snapshot | Agency reporting cycle; show source year | Local SQLite, access controlled | “Facility inventory is cached and must be verified with current facility records.” |
| Weather snapshots | NWS public data / Open-Meteo terms review | Last observations for active region, not forecast substitution | Current ≤10 min; recent ≤30 min; stale >30 min; expired by policy | Short-lived SQLite/cache entries | “Cached weather is stale and may significantly change plume output.” |
| Demographic data | U.S. Census public datasets | Versioned regional extracts | Census/ACS release based | Server regional dataset | “Population values are planning estimates from a cached release.” |
| Critical infrastructure | Authorized public/agency datasets; OSM terms where applicable | Region and layer-specific package | Source-specific | Server regional dataset with access policy | “Infrastructure data may be incomplete or outdated; verify through dispatch.” |
| Transportation routes | Public DOT/agency source; license review | Region-selected route layer | Source release based | Server map dataset | “Cached routes do not include current closures or responder restrictions.” |
| Receptor data | Census/OSM/authorized agency sources | Region-selected points/polygons | Source release based | Server regional dataset | “Mapped receptors are incomplete; confirm by reconnaissance and dispatch.” |
| ERG data | PHMSA public-domain edition | Full versioned structured dataset | Edition/revision based | Bundled SQLite | “Confirm the displayed ERG edition and current agency guidance.” |
| Chemical Companion authorized data | Repository-authorized database only; redistribution permission must remain documented | Authorized local database snapshot | Explicit revision/checksum | Read-only local database | “Chemical data revision must be verified before operational use.” |
| Incident records | Agency-owned | Local transactional records plus approved sync | Event/revision based; never silently expire | Local SQLite and approved durable store | “Unsynced incident changes remain on this device.” |
| Plume validation fixtures | Published/authorized sources only | Repository fixtures with citation/checksum | On reviewed source change | Bundled test fixtures | “A fixture without a published expected value is skipped, not validated.” |

## Common freshness states

- **Current:** within the source-specific operational window.
- **Recent:** outside the current window but still within the approved fallback window.
- **Stale:** usable only with an explicit warning and verification.
- **Expired:** must not drive calculations or operational recommendations.
- **Unknown:** observation/revision time is unavailable; treat as needing verification.

Every cached record needs source ID, source revision, retrieved time, observation or
publication time, cache scope, checksum where practical, and freshness state.

## Storage and security guardrails

- Prefer server-managed regional packages and SQLite records over an unbounded browser cache.
- Encrypt restricted facility and incident data at rest where required.
- Scope caches by organization, station, region, and permission.
- Use atomic package replacement and retain rollback metadata.
- Never treat cache presence as proof that a dataset is current or complete.
- Do not cache credentials inside dataset packages.

## Decisions still required

Regional selection workflow, storage quotas, package signing, encryption/key custody,
source-specific refresh windows, deletion/retention, and hosted-sync architecture must
be approved before implementation.
