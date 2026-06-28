# Sources & attribution

This product bundles public-domain data from:

- **PHMSA Emergency Response Guidebook (ERG) 2024** — U.S. Department of Transportation.
  Response guides, isolation distances, placard references.
- **NOAA CAMEO Chemicals suite** — Office of Response and Restoration.
  Chemical properties, physical data, reactivity, AEGL/ERPG/TEEL values where published.
- **NIOSH Pocket Guide to Chemical Hazards (NPG)** — Centers for Disease Control and Prevention.
  Exposure limits (REL, PEL, IDLH), physical properties, symptoms, PPE. The bulk of NPG
  records (`src/data/compact-npg.ts`, ~640+ chemicals) are ingested from supplementary data
  published with Lucas LK, Whittaker C, Bailer AJ, "An interactive data visualization tool
  for occupational exposure limits," *J Occup Environ Hyg.* 2024;21(1):47-57,
  doi:10.1080/15459624.2023.2267098 — licensed CC BY 4.0, itself derived from the NIOSH
  Pocket Guide (U.S. Government work, public domain under 17 USC §105). See
  `scripts/niosh/index.js` for the ingestion pipeline.
- **EPA Tier II Emergency and Hazardous Chemical Inventory** — U.S. Environmental Protection Agency.
  Facility chemical inventories, EHS flags, container types.
- **EPA Acute Exposure Guideline Levels (AEGL)** — public-domain federal values.
- **AIHA Emergency Response Planning Guidelines (ERPG)** — published values.
- **DOE Temporary Emergency Exposure Limits (TEEL)** — published values.

Inclusion does not imply endorsement by the source agencies. All trademarks belong to
their respective owners. Each chemical/NIOSH/facility record in `/src/data/` carries a
`sources` array with a per-row citation back to the canonical source.

The app is not affiliated with NOAA, EPA, NIOSH, PHMSA, AIHA, DOE, Honeywell,
Columbia Weather Systems, or OpenStreetMap/OpenFreeMap contributors.
