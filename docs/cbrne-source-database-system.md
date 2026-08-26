# CBRNE source database and Hazard ID hydration

## Why profiles were empty

The original CBRNE database contained 43 starter master records but deliberately exported an empty `CBRNE_SOURCE_FACTS` base array. Master records therefore had no attached `sourceFactIds`. Search and profile adapters read those static exports directly, so selecting a CBRNE or radiological identity opened a fail-closed profile made entirely of `No Current Data Exists` cards.

Starter records are identity and search records. They are not tactical guidance. Source facts are separately attributed, field-grouped values that may populate a responder profile only after a local import package passes validation.

## Automatic local hydration

`hydrateCbrneDatabase()` now performs a deterministic, offline startup hydration:

1. Clone the starter master-record registry.
2. Load the bundled TypeScript manual source packs.
3. Validate each package against the approved source registry and biological safety gate.
4. Normalize every fact with a stable ID, record ID, source registry ID, source name, document title, URL, source location, and review status.
5. Match package records to CBRNE master records without touching Chemical Companion.
6. Attach normalized source-fact IDs and return hydrated records, source facts, import reports, and warnings.

The search and profile adapters use this hydrated database. No internet connection, user upload, or admin import action is required at runtime. The empty static base fact array remains intentionally empty so bundled imports cannot be confused with reviewed, hardcoded facts.

Imported tactical facts are always normalized to `Requires SME Review`. Identity/classification facts may be `Source Imported`. Hydration never assigns `Verified`.

## Bundled source packs

The following local packs load automatically:

| Pack | Records | Profile use |
| --- | --- | --- |
| NRT Anthrax QRG | Anthrax / *Bacillus anthracis* | Identity, hazards, detection coordination, PPE decision constraints, exposure control, personnel decon, medical/public-health coordination, technical operations |
| NIOSH ERSH-DB VX | VX | Identity, hazards, recognition, PPE starting posture, scene control, decon, medical priorities, technical operations |
| NIOSH ERSH-DB Sarin | Sarin / GB | Identity, hazards, recognition, PPE starting posture, scene control, decon, medical priorities, technical operations |
| CHEMM nerve-agent toxidrome | VX and Sarin / GB | Cholinergic recognition and medical-management context without medication dosing |
| OPCW Schedule 1 identity crosswalk | VX, Sarin, Sulfur Mustard / HD, Ricin | Identity, CAS, and Schedule 1 classification only |
| REMM radiological response concepts | Cesium-137, Cobalt-60, Iridium-192, RDD / Dirty Bomb | Radiation hazards, survey, PPE/contamination control, decon, medical/health-physics coordination, dosimetry, technical operations |
| EPA PAG response framework | Cesium-137, Cobalt-60, Iridium-192, RDD / Dirty Bomb | Incident-specific protective-action decision framework; no universal distance or dose value |
| NNDC NuDat identity | Cesium-137, Cobalt-60, Iridium-192 | Nuclide name, symbol, and mass-number identity only |

## Approved source roles

| Source | Use inside HazMatIQ |
| --- | --- |
| NIOSH ERSH-DB | Primary CBRNE hazards, emergency response, PPE, decon, symptoms, first aid, and agent properties |
| NRT CBRN Quick Reference Guides | CBRN incident guidance, especially biological-agent response |
| CHEMM | CWA/nerve-agent toxidromes and medical/decon context |
| CAMEO Chemicals | Supporting CWA/TIC properties and response facts when an exact local source pack exists |
| EPA AEGL | Exact chemical-linked toxic inhalation endpoints only; not a plume model |
| OPCW Scheduled Chemicals | CWA identity, classification, schedule, synonym, and CAS support |
| OSHA/NIOSH CBRN PPE Matrix | Responder PPE framework and selection logic when locally imported and linked |
| PHMSA ERG 2024 | Transportation-specific isolation and protective-action support |
| REMM | Radiological medical, PPE, survey, decon, exposure, and contamination guidance |
| EPA PAG Manual | Incident-specific evacuation, sheltering, relocation, and dose-based protective-action framework |
| IAEA radiological emergency guidance | Initial response and radiation-safety concepts when a reviewed local pack exists |
| NNDC NuDat / IAEA LiveChart | Nuclide identity and decay-data cross-checking |
| 49 CFR / ERG Class 7 | Radioactive-material transport, package, label, and transport-index context |
| RESRAD-RDD / HotSpot | External model references only; never static profile facts or locally fabricated output |

CAMEO, AEGL, OSHA/NIOSH PPE Matrix, PHMSA ERG, IAEA emergency guidance, IAEA LiveChart, and 49 CFR/Class 7 remain approved registry sources but were not converted into tactical packs in this pass. RESRAD-RDD and HotSpot remain reference-only.

## Current population and fail-closed gaps

- Anthrax, VX, and Sarin populate all eight operational fact sections plus Sources.
- Cesium-137, Cobalt-60, Iridium-192, and RDD / Dirty Bomb populate all eight radiological operational sections plus Sources.
- Sulfur Mustard / HD and Ricin populate source-backed OPCW identity/classification only. Their unsupported tactical sections display `No Current Data Exists`.
- Other starter records remain identity-only until an approved local source pack is added.

Each profile footer reports source packs loaded, attached fact count, source names, SME-review count, missing section count, last import/update time, and import warnings. Every fact card displays its review badge, source name, source document, link, and source location.

## Safety and review limits

- Missing sections always render `No Current Data Exists`.
- Imported tactical facts always render `Requires SME Review` until an existing explicit review mechanism approves them.
- No PPE downgrade or offensive-entry authorization is created from a profile.
- No fixed standoff is inferred from an identity. NIOSH scene-control facts direct users back to the matching source scenario and field monitoring.
- No isotope dose rate, inverse-square output, plume endpoint, or universal radiological distance is stored.
- Radiological PPE is described as contamination control, not shielding from penetrating radiation.
- Biological packs contain responder-facing recognition, safety, coordination, and patient-care context only. Production, cultivation, growth, aerosolization, dispersal, weaponization, delivery, and release-method content is prohibited.
- Chemical Companion and the Chemical Hazard ID lane remain physically and logically separate. Hydration reads and writes only `src/data/cbrne` data structures.

## Sources used in this pass

- NIOSH ERSH-DB: VX and Sarin emergency response cards
- NRT CBRN QRG: *Bacillus anthracis (causes Anthrax)*, February 2022
- CHEMM: *Organophosphorus Pesticides and Nerve Agents — Cholinergic or Nerve Agent Toxidrome*
- OPCW: Chemical Weapons Convention Annex on Chemicals, Schedule 1
- REMM: Radiation PPE, contamination survey, and external decontamination guidance
- EPA: Protective Action Guides
- NNDC: NuDat 3 nuclide records

The URLs and document locations are stored on each normalized fact. Source text is paraphrased rather than copied at length.
