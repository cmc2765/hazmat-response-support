# CBRNE/Radiological source packs

Source packs are controlled, local imports into the CBRNE/Radiological Hazard ID database. They are physically and logically separate from Chemical Companion.

## Required metadata

Every package must identify an entry in `../cbrne-source-registry.ts`, plus a document title, an absolute HTTPS source URL, import timestamp, importer, and review state. A supplied source name must match the registry's human-readable name after whitespace and case normalization; when omitted, the validator derives it from the registry. Every tactical fact must also include a page, section, table, or equivalent locator.

The import validator rejects:

- an unknown registry ID or a supplied source name that conflicts with the registry entry's human-readable name;
- a fact mapped to a field group the registry entry is not approved to populate;
- missing or invalid source provenance;
- a null value not explicitly marked `No Current Data Exists`;
- prohibited biological misuse-enabling content.

Imported tactical facts are normalized to `Requires SME Review`. An import cannot create a `Verified` tactical fact. Conflicting values are staged as `Conflicting Sources` and do not overwrite a reviewed value.

## Pack boundaries

Use one registry source per package. A document-specific registry entry takes precedence over its parent landing page. For example, use `NRT_ANTHRAX_QRG` for the Anthrax PDF, `CHEMM_NERVE_AGENTS` for the nerve-agent page, and the separate `REMM_RADIATION_PPE`, `REMM_SURVEY`, and `REMM_DECON` entries for their respective facts.

Reference-only sources such as RESRAD-RDD and HotSpot must not create static profile guidance. Missing or unsupported information remains `No Current Data Exists`.
