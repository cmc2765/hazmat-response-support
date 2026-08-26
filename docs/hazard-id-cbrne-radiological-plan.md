# Hazard ID: CBRNE/CWA and Radiological Governance Plan

## Why Hazard ID

Hazard ID replaces the Chemical ID landing experience with one command workspace for chemical, CBRNE/CWA, and radiological identification. Chemical Companion remains the chemical system of record; the other lanes remain separate so an identity match cannot be mistaken for source-backed tactical guidance.

## Lane structure

- **Chemical:** adapts existing Chemical Companion search and profiles without duplicating or modifying its records.
- **CBRNE/CWA:** searches a small identity-only starter catalog. Tactical fields fail closed until authoritative records are linked and reviewed.
- **Radiological:** searches a separate identity-only radionuclide, package, and incident catalog. It never infers dose, standoff, shielding, or protective actions from a name.

## Source hierarchy

Chemical sources are prioritized as Chemical Companion, CAMEO Chemicals, NIOSH, ERG 2024, EPA AEGL, and applicable NFPA framework data. CBRNE/CWA review prioritizes NIOSH ERSH-DB, CHEMM, CAMEO, EPA AEGL, ERG, OPCW identity/classification, and NIOSH/OSHA CBRN PPE frameworks. Radiological review prioritizes REMM, EPA PAG, IAEA emergency guidance, NNDC NuDat/IAEA LiveChart, EPA Radionuclide Basics, and 49 CFR/ERG Class 7.

OPCW classification is not tactical response guidance. Nuclide identity sources do not establish standoff. EPA PAG supports protective-action decisions, not identity. HotSpot and RESRAD-RDD remain external model references unless their outputs are explicitly imported and validated.

## Missing-data and verification rules

Every absent field displays **No Current Data Exists**. Identity-only or incompletely linked records display **Requires Review**. The system does not substitute “N/A,” “Unknown,” blanks, estimates, or generic defaults.

Each future tactical fact must retain a source name, field name, value, units when applicable, verification status, and review metadata. Identity matches alone cannot unlock PPE, medical, isolation, standoff, plume, or dose guidance.

## CBRNE/CWA safety gates

- No PPE downgrade or offensive-entry decision from Hazard ID alone.
- No antidote recommendation without medical direction and authoritative guidance.
- No plume or standoff certainty without a verified chemical identity, endpoint/LOC source, scenario inputs, weather, model support, and field monitoring.
- Starter records contain names, categories, aliases, and common agent codes only.

## Radiological safety gates

- No standoff without scenario-based source guidance or measured dose-rate inputs.
- No inverse-square calculation without measured dose rate, measured distance, and documented point-source assumptions.
- No protective-action decision from isotope identity alone.
- PPE language must not imply protection from penetrating radiation.
- Operational framing emphasizes time, distance, shielding, contamination control, survey mapping, and radiation-authority coordination.

## Plume eligibility

The chemical lane retains the existing Plot Plume workflow and selected-chemical state. CBRNE/CWA Plot Plume remains disabled until a reviewed chemical identity and supported endpoint/LOC source are present. Radiological records never enter the chemical plume model; radiological plume/standoff requires a dedicated validated model.

## Separation from Chemical Companion

CBRNE/CWA and radiological starters are intentionally stored outside Chemical Companion. This prevents identity-only records, radionuclides, package types, or scenario categories from being promoted into chemical-specific response, PPE, medical, decon, or plume workflows.

