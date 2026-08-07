# TODO / Roadmap

A backlog either of you can edit directly (check items off, add new ones, reorder). Ask
Claude to update this file too — "add X to the TODO" or "mark Y done" both work.

## Up next

- [ ] **Published-case plume validation gate.** The offline harness and four required
  placeholder categories exist, but there are no published expected-distance fixtures.
  Obtain and independently review authorized ammonia railcar, chlorine cylinder,
  continuous-release, and puff-release cases before adding model complexity. See
  `docs/model-validation.md`.
- [ ] **ERG database rework.** Redesign the ERG schema using a normalized,
  lookup-table-plus-join-table pattern (inspired by reviewing the ERDSS/Chemical Companion
  app's schema — see "Schema design direction" below) instead of flat string fields.
  Expand data fidelity (Table 1 + Table 3, water-reactives, TIH flags already partially
  there — review what's missing).
- [ ] **Terrain in the plume model.** The plume map (MapLibre/OSM, now live) doesn't
  account for terrain — elevation, valleys/ridges, urban vs. open terrain roughness —
  when calculating dispersion. Real terrain (especially elevation changes) measurably
  changes how a plume actually travels; right now the model assumes flat ground. Needs
  a terrain/elevation data source (e.g. open elevation API or a vendored dataset) feeding
  into `src/lib/model/plume.ts` and `briggs.ts`.
  **Blocked until the published flat-ground validation gate passes.** See
  `docs/terrain-modeling-readiness.md`.

## Stabilization guardrails added 2026-07-29

- Normalized ERG tables are staged alongside, not instead of, `erg_table_1`; production
  cutover is blocked by ingestion and regression gates in `docs/erg-normalization-plan.md`.
- Chemical Companion linkage totals are tracked without force-linking uncertain UN/NA
  rows; the individual review inventory is still required. See
  `docs/chemical-companion-linkage-gaps.md`.
- General apparatus/PPE, ePCR, NERIS, and broad agency storage are blocked until ADR
  0001 is decided.
- Live CWS and Safety Suite connections are blocked pending approved endpoint artifacts.
- Regional offline/cache behavior is planning-only; no datasets have been downloaded.

## Schema design direction (decided 2026-06-28)

ERDSS (aka Chemical Companion, by MEPSS/Hazard3) has a well-built schema worth modeling
ours after — not copying their data, just the structural approach:

- **Normalize repeated attributes into lookup tables + join tables**, instead of flat
  string/array fields on the chemical row. E.g. their `nfpahealthhazards`,
  `decontaminationprotocols`, `chemicalclasses` are standalone tables, joined via
  `chemicals_nfpahazards`, `chemicals_decontaminationprotocols`, etc. We currently embed
  most of this as `string[]` directly on `Chemical`/`NPGRecord` — works fine for the
  current scale, but normalizing makes attributes searchable/reusable/consistent across
  chemicals and scales better as the dataset grows toward thousands of records.
- **Structured numeric fields over prose strings** where the data is actually numeric
  (their `chemicals_respirators` has real `BreakthroughTimeLow/High`,
  `PermeationRateLow/High` columns; ours currently has free-text PPE strings).
- **A `revision_id`-style column on every table** for sync/change-tracking — directly
  relevant to the multi-platform cloud sync goal below.
- Apply this pattern going forward starting with the ERG rework, then revisit
  chemicals/NPG/facilities schemas the same way once the pattern is proven out.

## Bigger picture / project direction (as of 2026-06-28)

This is growing beyond "hazmat response tool" into a broader platform for the fire
service. Chris's stated direction:

- **Equipment/apparatus inventory tracking** — persist what equipment/PPE is carried on
  each specific apparatus, without making the end user re-enter it constantly. Needs to
  work across multiple platforms/PCs, not be tied to one device the way ERDSS is
  (ERDSS's big limitation: per-device only, no cloud storage, no sync, no persistence
  across machines).
- **ePCR** (electronic patient care reporting) — future module, not started.
- **NERIS reporting** (the new national incident reporting system replacing NFIRS) —
  future module, not started.
- **Multi-platform cloud sync** — open architecture question, not yet decided: does this
  stay local-SQLite-per-install with a sync layer, or move toward a centralized/hosted
  database the apparatus-tracking and ePCR/NERIS pieces write to directly? This decision
  affects how the equipment/apparatus schema should be shaped (e.g. whether it needs
  org/station/apparatus-id scoping built in from day one). Worth deciding deliberately
  before building the equipment-tracking schema, not backing into it.
- **Top priority across all of this:** correctness and completeness of the safety-critical
  data (chemical hazards, exposure limits, isolation distances, PPE/decon guidance) — this
  is the information a responder relies on in a real emergency, so getting the schema right
  early (extensible, fast, accurate, easy to add/correct data in) matters more than moving
  fast.

## Future phases carried over from earlier planning (not yet started)

- **External data ingestion** — NIOSH bulk import is done (669 records). ERG/CAMEO/Tier II
  are still hand-curated only; same kind of real public-data pipeline work could expand
  those too.
- **Real mapping** — done: OpenStreetMap/MapLibre is live in `server/public` (replaced the
  old Google Maps iframe), with GPS auto-locate and click-to-set incident location both
  working. Still open: layered data (an "infrastructure" layer was specifically requested)
  and terrain-aware plume modeling (see "Up next" above).
- **Hybrid online/offline mode** — prefer live data when online, fall back to cached data
  scoped to a user-selected region when offline (not a full-country cache). Server-side
  design problem, not a browser-caching one.
- **Live integrations** — Honeywell Safety Suite (RAE monitors) and live weather (NWS/
  Open-Meteo/CWS microServer) adapters exist in `src/integrations/` with passing tests, but
  nothing calls them yet from the running app.
