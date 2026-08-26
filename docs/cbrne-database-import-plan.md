# CBRNE Master Database Import Plan

## Boundary and purpose

The HazMatIQ CBRNE master database is a separate data domain under `src/data/cbrne`. It does not read from, write to, merge with, duplicate, or replace Chemical Companion. Chemical searches continue through the existing Chemical Companion service. The CBRNE database owns Chemical Warfare Agent, biological, radiological, nuclear, threat-material, and CBRNE scenario identities plus their independently reviewed source facts.

Master records provide searchable identity only. Tactical profile content is rendered exclusively from `CbrneSourceFact` records. An identity match never implies PPE, isolation distance, decontamination, medical, dose-rate, plume, or operational guidance.

## Source hierarchy

Chemical-warfare sources are prioritized as NIOSH ERSH-DB, CHEMM, NRT CBRN QRG, CAMEO Chemicals, EPA AEGL, ERG 2024, OPCW identity/classification, and applicable NIOSH/OSHA PPE frameworks. OPCW is not treated as standalone tactical response guidance.

Biological sources are prioritized as NIOSH ERSH-DB, NRT CBRN QRG, CDC, applicable OSHA/NIOSH biological PPE guidance, public-health authority guidance, and manual SME review.

Radiological and nuclear sources are prioritized as REMM, EPA PAG, IAEA, NRT CBRN QRG, NNDC NuDat or IAEA LiveChart, EPA Radionuclide Basics, and 49 CFR/ERG Class 7. RESRAD-RDD and HotSpot are external model references only. NuDat supports identity, not standoff. EPA PAG supports dose-based protective-action guidance, not isotope identity. IAEA initial cordons do not replace surveys.

## Import package

`CbrneImportPackage` records package identity, source document metadata, import time and operator, and one or more `CbrneImportRecord` objects. Every imported fact carries a source name, document title, field group, value, and verification state. Packages are local inputs only; HazMatIQ does not scrape or automatically ingest external sites.

Validation rejects incomplete package metadata, incomplete record identities, tactical facts without a recognized source, null values not explicitly marked `No Current Data Exists`, missing document titles, and biological misuse-enabling content. A request to import a fact as `Verified` is downgraded and reported as a warning. Imports never auto-verify tactical data.

## Staging and review

1. Validate the local package.
2. Normalize identity strings, aliases, identifiers, source metadata, and deterministic fact IDs.
3. Match existing records by exact display name, scientific name, alias, agent code, CAS, or radionuclide symbol.
4. Stage new facts without mutating the live constants.
5. Mark identity/reference facts `Source Imported`; mark tactical facts `Requires SME Review`.
6. Flag differing values for the same record, field group, and field name as `Conflicting Sources`.
7. Preserve existing `Verified` facts; an import never overwrites them.
8. Keep absent data as `No Current Data Exists` until an authoritative fact is reviewed.

Promotion from staging requires an SME to confirm source applicability, scope, units, context, limitations, and consistency. Verification must be explicit and auditable.

## Source-fact model and missing data

`CbrneMasterRecord` is the searchable identity. `CbrneSourceFact` is the atomic source-backed value used by a profile. Facts are grouped into identity, hazards, symptoms, detection, PPE, isolation/standoff, decon, medical, technical operations, radiological survey, protective action, limitations, and sources.

The profile adapter never fills a tactical gap from general knowledge or from the identity itself. When no fact exists, it emits a fail-closed display sentinel with a null value and `No Current Data Exists`. Imported but unreviewed values show `Requires SME Review`; unresolved differences show `Conflicting Sources`.

## Anthrax example

The starter registry includes Anthrax with scientific name `Bacillus anthracis` and search aliases `B. anthracis`, `Biological agent`, and `Bacterial agent`. Selecting it renders an Anthrax Hazard ID Profile with Overview, Hazards, Detection/Recognition, PPE, Isolation/Standoff, Decon, Medical/EMS, Technical Operations, and Sources sections. Until authoritative facts are imported, each tactical section displays `No Current Data Exists` and the responder action cards remain fail closed.

The profile workflow is limited to responder-facing identify, isolate, protect, coordinate detection, decon, notify medical/public health, preserve evidence, and report functions. It contains no production, cultivation, growth, weaponization, aerosolization, dissemination, dispersal, or delivery instructions.

## Safety limitations

### Biological

Agent identity alone cannot establish standoff, justify a PPE downgrade, prescribe decon, or direct medical treatment. Decon and medical facts require authoritative sources and appropriate public-health or medical control. Misuse-enabling operational content is rejected during import.

### Chemical warfare agents

A profile cannot authorize PPE downgrade or offensive entry. Plume and standoff certainty require verified endpoints, source/scenario inputs, weather, model applicability, and field monitoring. Antidote administration requires source-backed medical direction.

### Radiological and nuclear

Isotope identity cannot establish fixed standoff or protective actions. Inverse-square calculations are gated unless measured dose rate, measured distance, and a documented point-source assumption are all present. PPE is contamination control, not radiation shielding, unless a reviewed source says otherwise. Time, distance, shielding, surveys, and radiation-authority coordination remain required.

## Future source imports

Future packages may represent locally acquired, license-compliant extracts or manually transcribed and reviewed facts from the hierarchy above. Each package should identify the exact source document/version and preserve field-level provenance. Model output from RESRAD-RDD or HotSpot must remain external scenario output and must not be imported as universal identity-based tactical guidance.
