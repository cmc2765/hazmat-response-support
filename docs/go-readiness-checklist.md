# HazMatIQ GO-readiness checklist

Audit date: 2026-08-07  
Scope: the prerequisite areas named in the GO-readiness request; this is not a whole-project certification.

## A. GO / NO-GO Summary

**Overall status: NO-GO — Blocked Pending Validation.**

HazMatIQ is **prototype/planning-only** and is not ready for public or operational reliance. The repository contains useful imported reference data, internal calculation tests, a structured plume-validation harness, and local incident capture, but those do not establish operational validation.

Top blockers are: no model-compatible published plume comparison suite; 1,980 transportation identifiers awaiting evidence review against the Chemical Companion master; incomplete record-level provenance and revision controls; unverified PPE/suit provenance and incomplete compatibility coverage; no medical content validation against CHEMM or another approved clinical authority; incomplete ERG source reconciliation; no approved offline/synchronization architecture; unconfigured CWS, Safety Suite, and FirstDue production integrations; missing authentication/authorization/audit controls for sensitive incident data; and no documented device/browser accessibility and responsive acceptance run.

The required source-status vocabulary is available in `src/lib/readiness/status.ts`. User-facing plume, chemical identity, PPE, medical, weather, and protective-action paths now use the same labels where the current structure safely supports them.

## B. Chemical Data Accuracy

| Area | Current status | Finding / GO requirement |
|---|---|---|
| Chemical Companion database | **Imported Source** | A committed SQLite database drives Chemical ID profiles. Its redistribution authorization, revision, checksum, and field-level source lineage are not established in the app. |
| CAS / UN / ERG identity | **Imported Source** | Chemical ID displays identity values with the profile source and an imported-status label. Provenance is profile-level rather than independently recorded for each identifier. Missing header values display **No Current Data Exists**. |
| CAMEO subset | **Imported Source** | The seed manifest labels a hand-curated CAMEO subset. Automated repeatable ingestion and record-level reconciliation are absent. |
| NIOSH NPG | **Imported Source** | The source document identifies the NPG-derived dataset and license. A release audit still needs record counts, checksum, sampled transcription review, and UI provenance checks. |
| SDS | **Needs Verification** | `sdsUrl` exists in the database schema, but SDS currency, issuer, product specificity, and snapshot policy are not enforced. |
| CHEMM | **Needs Verification** | CHEMM is an external verification link, not evidence that displayed medical text was imported from or verified against CHEMM. |
| Missing properties | **No Current Data Exists** | Major readiness views use the required fallback; older normalized profile internals still contain `Not available`, and a complete UI inventory remains required. |

Chemical Companion linkage gaps are tracked in `data/chemical-companion-linkage-coverage.json` and `docs/chemical-companion-linkage-gaps.md`. The snapshot records 1,980 distinct transportation identifiers, 0 reviewed links, and a complete 1,980-record review inventory with stable source IDs, UN/NA values, shipping names, guide/book/country context, and relationship IDs. All remain `unknown/requires-review`; no uncertain records were force-linked. Inventory completeness is explicitly insufficient for enforcement readiness.

The flat `erg_table_1` schema in `server/src/schema.ts` remains the production path. The normalized `erg_norm_*` schema is staging-only and must not replace production until the documented cutover gates pass.

Required before GO: reconcile source populations; export and review all unlinked identifiers; establish immutable per-record source/revision metadata; verify representative CAS/UN/ERG joins against canonical publications; document Chemical Companion authorization; and make missing-data behavior consistent across every output.

## C. Plume Model Validation

**Status: Blocked Pending Validation.** The plume model is not independently validated and must not be described as precise, operationally validated, or equivalent to ALOHA.

`docs/model-validation.md` and the offline validation harness cover the four required categories:

1. ammonia railcar release;
2. chlorine cylinder release;
3. continuous release; and
4. puff release.

One published NOAA/EPA chlorine-cylinder expected-distance candidate is registered with unit conversions and a stable citation. It is skipped because ALOHA's instantaneous heavy-gas direct source is not directly compatible with the current Gaussian puff model's required evaluation time; the 60-minute AEGL averaging duration is not substituted. The other three fixtures remain source-empty placeholders. There are zero runnable cases, so validation remains blocked.

For future accepted fixtures, each case must cite an authorized, stable publication; reproduce all documented inputs and units without inference; state the ALOHA/model version; record expected distance; and define a reviewed tolerance. The harness supports a per-case tolerance (the placeholder default is 20%), but that value is not an approved scientific acceptance criterion. GO requires a domain reviewer to approve tolerance rules before use.

Pass criteria: every required baseline fixture is runnable from a cited published source, none is skipped, every calculated relative error is within its approved tolerance, transcription is independently reviewed, and failures remain visible. Any skipped or failed required case is a release-gate failure. **No additional plume complexity until baseline validation passes.**

## D. PPE and Suit Recommendation Readiness

| Output | Status | Finding |
|---|---|---|
| PPE source records | **Imported Source / Needs Verification** | Chemical Companion, ERG, and NIOSH-derived text may be present. Coverage is incomplete and provenance is coarse. |
| Dashboard ensemble level | **Needs Verification** | The UI no longer infers Level A/B/C merely from partial respiratory/suit text. Imported text is shown as guidance requiring review. |
| Operator selection | **Manual Entry** | Operator-entered PPE is labeled manual and is not presented as source consensus. |
| Suit compatibility | **Imported Source** only when a chemical-specific imported record is present; otherwise **No Current Data Exists** | Missing compatibility shows “Suit compatibility not verified from current source.” |
| Unsupported recommendation | **Blocked Pending Validation** | Full-source consensus is not currently demonstrated. Missing data does not create a confident recommendation. |

The user-facing warning is present near dashboard PPE/suit guidance. No Kappler, First Line, or other proprietary compatibility data was added, scraped, or inferred in this pass. Existing external reference links do not convert absent data into a recommendation.

Before GO, establish the license and revision of every suit dataset, verify chemical/material/product specificity with manufacturer documentation, test missing and conflicting records, and obtain HazMat/industrial-hygiene review of all recommendation rules and labels.

## E. Medical and Protective Action Readiness

Displayed medical content is primarily **Imported Source** text from Chemical Companion plus available NIOSH/ERG-derived records. CHEMM is now labeled as an external verification reference; the repository does not demonstrate a CHEMM medical-content import or clinical validation. CAMEO, ERG, NIOSH, SDS, and CHEMM coverage is not uniform per chemical.

ERG isolation/protective-action records are labeled as imported source guidance. HazMatIQ plume-derived zones are labeled **Planning Estimate** and are no longer presented as CAMEO/ALOHA output. Imported ALOHA/MARPLOT KML is labeled **Imported Source**. Missing guidance falls back to **No Current Data Exists**.

The required Incident Command verification disclaimer is present next to medical and protective-action guidance. GO requires toxicology/medical review of the content pipeline, source-specific revision metadata, tests proving that absent or contradictory content is blocked, and reviewed differentiation between ERG initial actions and modeled planning estimates.

## F. Export-Ready Incident Data

| Data | Status | Structured capture |
|---|---|---|
| Selected chemical and profile | **Imported Source** | Saved with Chemical ID, CAS, UN/NA, ERG, profile, source labels, and capture time when available. |
| Release/container inputs | **Manual Entry / Planning Estimate** | Stored as typed fields in incident and plume workflow records. |
| Plume output | **Planning Estimate** | Model/version, thresholds, distances, zones, geometry, timestamp, limitations, and map center are structured. |
| Imported plume overlay | **Imported Source** | File name, geometry, timestamps, and disclaimers are structured; imported data is not represented as backend output. |
| Weather | **Verified Source / Manual Entry / Needs Verification** | Source, observation time, source/freshness text, wind, temperature, and supporting fields are captured when available. A source being reachable is not proof its observation is operationally verified. |
| PPE / medical / protective actions | **Imported Source / Manual Entry / Planning Estimate / No Current Data Exists** | Summaries and statuses are stored on active incidents when available. |
| Disclaimers | **Verified Source** (application policy text) | Required decision-support, plume, weather, missing-data, PPE/suit, and medical/protective-action notices are referenceable in incident data. |

Planning Mode does not create an incident; its state is stored separately in local storage. Active Incident Mode writes the plume workflow to the active incident. Incident snapshots are mirrored to the backend as JSON. A separate `IncidentExportV1` contract now requires schema version, units, statuses, sources/revisions, actor/device identity, audit history, disclaimers, classification, retention policy, attachments, and Reports/ICS mappings. It is a validated target contract; the live snapshot pipeline has not yet migrated to it, and local/backend full-snapshot merging is not a durable multi-user audit design.

The data is useful as a future Reports/ICS input but is **Needs Verification**, not formally export-certified. Missing fields include schema version, actor/device identity, immutable revision/audit trail, unit metadata on every numeric value, authoritative source IDs/revisions/checksums, explicit review/approval state, conflict history, attachments manifest, data classification/retention, and a validated export contract. Reports/ICS generation was not changed.

## G. UI / Layout / Responsiveness

| Target | Status | Finding |
|---|---|---|
| 1440 desktop | **Needs Verification** | CSS provides the intended 20 / 56 / 24 Plume layout and bounded right-side content. Browser acceptance is not recorded. |
| 1366 and 1280 laptop | **Needs Verification** | The desktop grid remains active and uses minimum-width/overflow guards. Visual regression evidence is absent. |
| 1024 tablet landscape | **Needs Verification** | Desktop rules remain active above 980px and fit by declared minimums; touch, zoom, text clipping, and opened-accordion testing is still required. |
| Tablet portrait | **Needs Verification** | At 980px and below the main layout collapses to one column and plume inputs stack. Formal device testing is absent. |
| Mobile | **Needs Verification / limited** | Breakpoints exist at 719/620px, but mobile is not an operational target in this pass and dense tables/maps can require internal scrolling. |

The Incident Dashboard right-side accordions use bounded flex panels with internal vertical scrolling; expanded content should not overlap sibling titles. The Plume result card has a light background, dark text, bounded width/height, and internal scrolling. Chemical ID metadata and tab content wrap or scroll within their containers. Lightened status boxes use dark navy/black text. No global color redesign, external font, or dependency was added.

GO still requires screenshots or automated viewport tests at 1440, 1366, 1280, 1024 landscape, and a supported portrait width; keyboard-only and screen-reader checks; 200% zoom; long chemical/source text; every right accordion opened; plume result expansion; and explicit horizontal-overflow measurement.

## H. Offline / Cache / Integration Readiness

| Area | Status | Finding |
|---|---|---|
| Bundled ERG/Chemical data | **Imported Source** | SQLite and bundled JSON/TS data can be local, but edition/revision completeness and operational preload verification are incomplete. |
| Whole application offline | **Needs Verification** | Docker is documented as runnable without network, but live map tiles, weather, external references, and integrations do not work offline. There is no service worker. |
| Weather adapters | **Needs Verification** | Open-Meteo and NWS paths exist; the running UI duplicates adapter logic. Observation time/freshness is displayed, but stale policy is not uniformly enforced. |
| CWS | **Blocked Pending Validation** | A typed adapter and CSV/manual path exist. Live station connection is unconfigured pending approved endpoint/auth/payload artifacts. |
| Safety Suite | **Blocked Pending Validation** | Adapter scaffolding and SDK notes exist; no approved endpoint artifacts or production credential provisioning are configured. |
| FirstDue | **Blocked Pending Validation** | UI supports approved manual/export concepts only. No production API connection is attempted. |
| Cache policy | **Blocked Pending Validation** | A tested metadata evaluator now marks Current/Recent/Stale/Expired/Unknown and permits verified use only for current, checksum-verified records. It is not yet wired across storage, updates, or synchronization. |

Unknown observation time must remain **Needs Verification**; stale or manually entered weather must never be treated as verified. GO requires an approved offline architecture, cache signing/versioning, source-specific expiry rules, degraded-mode drills, map fallback, atomic updates/rollback, and synchronization conflict tests.

## I. Security / Public-Use Concerns

**Status: NO-GO — Blocked Pending Validation.**

- No credentials were added by this pass. Integration secret types and an in-memory store exist; production secret storage, rotation, access control, and log redaction are not complete.
- Incident and facility data can include protected operational information. Authentication, authorization, tenant isolation, encryption policy, retention, deletion, backup, breach logging, and audit controls are not demonstrated.
- Medical summaries can become patient-adjacent data. The current incident structure has no approved patient-data boundary or HIPAA/public-records policy; patient-identifying data should not be entered until governance exists.
- Chemical Companion and proprietary suit/manufacturer content require explicit license and redistribution review.
- External links and live map/weather requests disclose network metadata and may be unavailable or governed by third-party terms.
- Existing scripts include a Tier II scraper entry point. Public release requires an authorization and legal review of every ingestion path. No scraping or hidden API was added in this pass.
- Full incident JSON sync lacks user/device attribution and conflict-safe authorization. It is unsuitable as a public multi-user security boundary.
- The decision-support, plume, weather, PPE/suit, medical/protective-action, and missing-data disclaimers must remain visible and included by reference in exports.

## J. Recommended Next Priorities

Complete these tasks in this exact order:

1. Obtain and independently transcribe authorized published ALOHA baseline cases for all four required categories; approve tolerances and make the validation gate pass without skips.
2. Review all 1,980 transportation identifiers against the Chemical Companion master with evidence, and leave uncertain rows `requires review`.
3. Establish a versioned provenance manifest for every chemical, CAS/UN/ERG identifier, ERG distance, PPE/suit, medical, and protective-action field, including license, revision, checksum, and review state.
4. Complete ERG 2024 coverage/reconciliation and regression tests while retaining the flat production schema until a separately approved normalized-schema cutover.
5. Obtain HazMat/industrial-hygiene approval for PPE rules and authorized manufacturer compatibility data; test missing, conflicting, and chemical/form-specific cases.
6. Obtain toxicology/medical review of medical and protective-action content against approved CHEMM/NIOSH/CAMEO/ERG/SDS sources; block unsupported treatment or evacuation output.
7. Define and validate a versioned incident/export schema with units, statuses, source revisions, actors/devices, audit history, disclaimers, and Reports/ICS field mappings.
8. Approve and implement authentication, role/tenant authorization, encryption, secret management, audit, retention, backup/restore, and protected/patient-data policies.
9. Approve the local-first/offline/cache/synchronization architecture; implement stale/expired enforcement and test disconnected incident operation plus conflict recovery.
10. Complete production integration certification and viewport/accessibility acceptance for weather, CWS, Safety Suite, FirstDue, desktop/laptop/tablet layouts, and degraded states.

## K. Ten-task execution record

The tasks above were attempted in order. Repository-side controls and evidence were
completed where authority and source material allowed; no external approval was
fabricated.

| Task | Repository result | Release disposition |
|---:|---|---|
| 1 | Registered the official chlorine comparison candidate and its incompatibility rationale; the harness rejects incomplete/model-incompatible cases. | **Blocked** — zero runnable cases; ammonia railcar and two generic baselines remain absent. |
| 2 | Exported all 1,980 transportation identifiers with stable source relationships and validated inventory integrity. | **Blocked** — human categorization, evidence, and link approval remain. |
| 3 | Added `data/source-provenance-manifest.json`, checksums, critical-field coverage, and a fail-closed validator. | **Blocked** — citations, revisions, permissions, record lineage, and attributable approvals are incomplete. |
| 4 | Added structural flat-ERG checks and an explicit source-reconciliation/cutover gate. | **Blocked** — source reconciliation and normalized cutover approval are absent; flat production remains authoritative. |
| 5 | Added PPE/suit evidence rules requiring chemical form, revision, source locator, manufacturer/product specificity, conflict resolution, and domain approval. | **Blocked** — authorized evidence and HazMat/IH approval are absent. |
| 6 | Applied the same fail-closed evidence and domain-review gate to medical and protective-action output. | **Blocked** — toxicology/medical review is absent. |
| 7 | Added and tested versioned `IncidentExportV1`, including units, provenance, actors/devices, audit, disclaimers, retention/classification, attachments, and mapping slots. | **Needs Verification** — live export migration and Reports/ICS mapping acceptance remain. |
| 8 | Added a public-release evaluator covering ten security/governance controls. | **Blocked** — implementation and approved evidence are absent. |
| 9 | Added tested cache freshness/expiry and integrity semantics plus offline/sync certification targets. | **Blocked** — application-wide cache wiring and disconnected/conflict drills remain. |
| 10 | Added a versioned certification matrix for four integrations, five viewports, accessibility, zoom, offline, and conflict recovery. | **Blocked** — all targets remain unevidenced and must be executed in approved environments. |

## Change-scope confirmations

- No chemical data was fabricated.
- No plume validation distances were fabricated.
- No PPE or suit recommendations were invented; inferred ensemble-level selection was removed from the dashboard readiness path.
- No terrain modeling was added.
- No plume math was changed.
- No current ERG production schema was replaced.
- No Chemical ID production lookup was replaced or intentionally changed.
- No Reports/ICS Forms generation was changed.
- No Live Map logic was changed.
- No Monitoring Equipment logic was changed.
- No backend APIs or routing were changed.
- No map provider was changed.
- No external APIs, scraping, hidden APIs, credentials, external fonts, or dependencies were added.
