# HazMatIQ linked-source feature expansion plan

Chemical Companion is the master identity source for every module. `No Current Data
Exists` is the required missing-data behavior. Source facts remain labeled and do not
overwrite the master.

| Module | Linked sources | Required validation and badges | Export-ready fields | Readiness |
|---|---|---|---|---|
| Chemical Profile | CAMEO, NIOSH, SDS | Identity mapping and conflicts; `Chemical Companion Master`, linked-source badges | Master ID, identifiers, source links/revisions | Safe scaffolding; validation blocked |
| ERG / Isolation | ERG | Edition, UN/NA context, transcription; `Linked ERG` | Guide, table, distances, edition/status | Existing display; reconciliation blocked |
| PPE / Suit Guidance | NIOSH, SDS, manufacturer | Chemical/form/product compatibility and IH review | Guidance, source, limitations, approval | Blocked pending evidence |
| Decon | ERG, NIOSH, CAMEO, SDS | Source-specific procedure review and conflict handling | Method, source, review state | Existing imported guidance; review blocked |
| Detector Guidance | NIOSH, approved manufacturer | Range, cross-sensitivity, calibration context | Detector/channel/range/source | Safe only as source-labeled data |
| Reactivity | CAMEO, SDS | Substance/form and condition review | Facts, sources, conflicts | Source display safe; recommendations blocked |
| Medical | NIOSH, CHEMM/SDS where approved | Toxicology/medical review | Guidance, source, review, disclaimer | Blocked pending clinical review |
| Container Recognition | ERG, approved reference | Container/transport applicability review | Container, source, confidence | Planning display only |
| Firefighting | ERG, CAMEO, SDS | Incident-context and source review | Fire guidance, source, limitations | Source display safe; operational validation blocked |
| Plume / Threat Zone | ALOHA/CAMEO links, ERG, Census, local GIS | Model compatibility; demographic method review; `Planning Estimate`, source/status | Inputs, model output, geometry, household method/status/limits | Planning only; validation blocked |
| Incident Export | All linked layers | Versioned contract, attribution, audit, retention | Master ID, facts, statuses, revisions, disclaimers | Schema target exists; migration blocked |

No module should reproduce proprietary screens or workflows. Use existing HazMatIQ
tabs, compact cards, accordions, and source badges, with long material behind Show More.
