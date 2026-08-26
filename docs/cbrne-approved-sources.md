# Approved CBRNE and Radiological Sources

This registry governs which official sources may populate the separate CBRNE/Radiological Hazard ID database. Registration does not mean every source has been imported and does not authorize unsupported tactical guidance.

| ID | Official source | Approved profile role |
| --- | --- | --- |
| `NIOSH_ERSH_DB` | [NIOSH Emergency Response Safety and Health Database](https://www.cdc.gov/niosh/ershdb/default.html) | Primary multi-domain responder facts |
| `NRT_CBRN_QRG` | [National Response Team CBRN Quick Reference Guides](https://www.epa.gov/emergency-response/chemical-biological-radiological-and-nuclear-quick-reference-guides) | Early consequence-management guidance |
| `NRT_ANTHRAX_QRG` | [NRT Anthrax QRG](https://nrt.response.epa.gov/sites/2/files/NRT%20CBRN%20BIO%20UPDATE%20Anthrax%20QRG_FINAL%202022%2002%2016.pdf) | Anthrax-specific responder pack |
| `CHEMM` | [Chemical Hazards Emergency Medical Management](https://chemm.hhs.gov/) | CWA medical context |
| `CHEMM_NERVE_AGENTS` | [CHEMM Nerve Agents](https://chemm.hhs.gov/nerveagents.htm) | Nerve-agent recognition and medical context |
| `CHEMM_SARIN_PREHOSPITAL` | [CHEMM Sarin Prehospital Medical Management](https://chemm-cms.beam.hhs.gov/sarin_prehospital_mmg) | Sarin prehospital medical target; import blocked while unavailable |
| `CAMEO_CHEMICALS` | [CAMEO Chemicals](https://cameochemicals.noaa.gov/) | Supporting CWA/TIC properties and response facts |
| `EPA_AEGL` | [EPA AEGL values](https://www.epa.gov/aegl/access-acute-exposure-guideline-levels-aegls-values) | Exact chemical/CAS-linked inhalation endpoints |
| `OPCW_SCHEDULED_CHEMICALS` | [OPCW Scheduled Chemicals Database](https://apps.opcw.org/cas/default.aspx) | Identity and classification only |
| `OPCW_SCHEDULE_1` | [OPCW Schedule 1](https://www.opcw.org/chemical-weapons-convention/annexes/annex-chemicals/schedule-1) | Schedule 1 identity and classification only |
| `OSHA_NIOSH_CBRN_PPE_MATRIX` | [OSHA/NIOSH CBRN PPE Matrix](https://www.osha.gov/emergency-preparedness/cbrn-matrix) | PPE selection framework, not automatic selection |
| `PHMSA_ERG_2024` | [PHMSA ERG 2024](https://www.phmsa.dot.gov/training/hazmat/erg/emergency-response-guidebook-erg) | Initial transport-phase guidance with exact linkage |
| `REMM` | [Radiation Emergency Medical Management](https://remm.hhs.gov/) | Primary radiological medical/response portal |
| `REMM_RADIATION_PPE` | [REMM Radiation PPE](https://remm.hhs.gov/radiation_ppe.htm) | PPE and contamination-control concepts |
| `REMM_SURVEY` | [REMM Contamination Survey](https://www.remm.hhs.gov/howtosurvey.htm) | Survey and monitoring concepts |
| `REMM_DECON` | [REMM External Decontamination](https://remm.hhs.gov/ext_contamination.htm) | External contamination and decon context |
| `EPA_PAG` | [EPA Protective Action Guides](https://www.epa.gov/radiation/protective-action-guides-pags) | Dose-based protective-action framework |
| `REMM_PAG_SUMMARY` | [REMM PAG Summary](https://remm.hhs.gov/pag.htm) | Responder-facing PAG context |
| `IAEA_FIRST_RESPONDER_RAD` | [IAEA First Responder Manual](https://www-pub.iaea.org/MTCD/Publications/PDF/EPR_FirstResponder_web.pdf) | Initial radiological response framework |
| `IAEA_GSG2_CORDON` | [IAEA GSG-2 cordon table](https://nucleus.iaea.org/sites/nss-oui/Published%20Chunks/m_76287e92-e1c2-4d80-bc8a-a02e1b5a2131/c_02c837a5-7548-440c-8723-0eba5d391d72__3_0.Html) | Scenario-specific initial cordon context |
| `NNDC_NUDAT` | [NNDC NuDat](https://www.nndc.bnl.gov/nudat3/) | Nuclide identity and evaluated nuclear data |
| `IAEA_LIVECHART` | [IAEA LiveChart](https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html) | Nuclear-data cross-checking |
| `DOT_49CFR_CLASS7` | [49 CFR Title 49](https://www.ecfr.gov/current/title-49) | Class 7 transportation context |
| `RESRAD_RDD` | [RESRAD-RDD/IND](https://resrad.evs.anl.gov/codes/resrad-rdd/) | External model reference only |
| `HOTSPOT` | [HotSpot Health Physics Codes](https://www.energy.gov/ehss/hotspot) | External model reference only |

## Hierarchy

- CWA: NIOSH ERSH-DB; NRT QRG; CHEMM; CAMEO; EPA AEGL; PHMSA ERG 2024; OPCW identity/classification; OSHA/NIOSH PPE Matrix.
- Biological: NIOSH ERSH-DB; NRT QRG; future approved CDC pages; OSHA/NIOSH PPE Matrix; public-health authority guidance; manual SME review.
- Radiological: REMM; EPA PAG; IAEA first-responder guidance; NRT QRG; NuDat/LiveChart; future EPA radionuclide basics; 49 CFR/ERG Class 7; external RESRAD-RDD/HotSpot references.

## Governance guarantees

Every displayed tactical fact retains registry ID, exact source name, document title, URL, locator, and review status. Imported tactical facts require SME review. Unsupported values remain `No Current Data Exists`; disagreements become `Conflicting Sources`. CBRNE facts never overwrite Chemical Companion, and external model references never become static tactical facts.
