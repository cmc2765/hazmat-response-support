#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "../..");
const OUTPUT = resolve(ROOT, "src/data/cbrne/authoritative/generated-source-artifacts.json");
const SNAPSHOT_ROOT = resolve(ROOT, "data/cbrne/source-artifacts");
const ACQUIRED_AT = "2026-09-10T00:00:00.000Z";
const REFRESH = process.argv.includes("--refresh");

const officialDomains = ["epa.gov", "nrt.org", "hhs.gov", "cdc.gov", "fema.gov", "bnl.gov", "opcw.org", "fbi.gov", "atf.gov", "nrc.gov", "energy.gov", "frmac.gov"];

const nrtChemical = [
  ["sarin-gb", "Sarin (GB) QRG", "NRT CBRN CHEM UPDATE Sarin GB QRG FINAL 2022 07 26.pdf", "2022-07-26"],
  ["tabun-ga", "Tabun (GA) QRG", "NRT CBRN CHEM UPDATE Tabun GA QRG FINAL 2022 07 26.pdf", "2022-07-26"],
  ["soman-gd", "Soman (GD) QRG", "NRT CBRN CHEM UPDATE Soman GD QRG FINAL 2022 07 26.pdf", "2022-07-26"],
  ["cyclosarin-gf", "Cyclosarin (GF) QRG", "NRT CBRN CHEM UPDATE Cyclosarin GF QRG FINAL 2022 07 26.pdf", "2022-07-26"],
  ["vx", "VX QRG", "NRT CBRN CHEM UPDATE VX QRG FINAL 2022 07 26.pdf", "2022-07-26"],
  ["sulfur-mustard-hd", "Sulfur Mustard (HD) QRG", "NRT CBRN CHEM UPDATE Sulfur Mustard HD QRG FINAL 2023 12 18.pdf", "2023-12-18"],
  ["mustard-lewisite-hl", "Mustard-Lewisite Mixture (HL) QRG", "NRT CBRN CHEM UPDATE Mustard Lewisite Mixture HL QRG FINAL 2023 12 18.pdf", "2023-12-18"],
  ["lewisite-l", "Lewisite (L) QRG", "NRT CBRN CHEM UPDATE Lewisite L QRG FINAL 2023 12 18.pdf", "2023-12-18"],
  ["ammonia", "Ammonia (NH3) QRG", "NRT CBRN CHEM Ammonia NH3 QRG FINAL 2020 04 06.pdf", "2020-04-06"],
  ["chlorine", "Chlorine Gas (CL) QRG", "NRT CBRN CHEM UPDATE Chlorine Gas CL QRG FINAL 2026 05 04.pdf", "2026-05-04"],
  ["phosgene", "Phosgene (CG) QRG", "Phosgene CG QRG FINAL 2017 04 26.pdf", "2017-04-26"],
  ["arsine", "Arsine (SA) QRG", "Arsine SA QRG FINAL 2017 04 25.pdf", "2017-04-25"],
  ["cyanide-salts", "Cyanide Salts QRG", "NRT WMD CHEM Cyanide Salts QRG FINAL 2017 02 17.pdf", "2017-02-17"],
  ["hydrogen-cyanide", "Hydrogen Cyanide (AC) QRG", "NRT WMD CHEM UPDATE Hydrogen Cyanide AC QRG FINAL 2017 02 17.pdf", "2017-02-17"],
  ["hydrogen-sulfide", "Hydrogen Sulfide (H2S) QRG", "NRT WMD CHEM Hydrogen Sulfide H2S QRG_FINAL 2016 04 04.pdf", "2016-04-04"],
  ["methyl-isocyanate", "Methyl Isocyanate (MIC) QRG", "NRT WMD CHEM UPDATE MIC QRG_FINAL 2015 07 10.pdf", "2015-07-10"],
  ["organothiophosphate-pesticides", "Organothiophosphate Pesticides QRG", "NRT CBRN CHEM UPDATE OTP QRG FINAL 2018 11 14.pdf", "2018-11-14"],
  ["phosphine", "Phosphine (PH3) QRG", "NRT WMD CHEM Phosphine PH3 QRG FINAL 2018 09 27.pdf", "2018-09-27"],
  ["fentanyl", "Fentanyl QRG", "NRT CBRN CHEM Fentanyl QRG FINAL 2025 06 16.pdf", "2025-06-16"],
  ["tets", "Tetramethylenedisulfotetramine (TETS) QRG", "NRT_WMD_CHEM_TETS_QRG_18June2013_EnDyna.pdf", "2013-06-18"],
];

const nrtBiological = [
  ["anthrax", "Anthrax QRG", "NRT CBRN BIO UPDATE Anthrax QRG_FINAL 2022 02 16.pdf", "2022-02-16"],
  ["plague", "Plague QRG", "NRT CBRN BIO UPDATE Plague QRG_FINAL 2022 09 18.pdf", "2022-09-18"],
  ["brucellosis", "Brucellosis QRG", "120502_Brucella_QRG_Final.pdf", "2012-05-02"],
  ["q-fever", "Q Fever QRG", "120502_Q_Fever_QRG_Final.pdf", "2012-05-02"],
  ["glanders-melioidosis", "Glanders and Melioidosis QRG", "120502_Glanders Melioidosis_QRG_Final.pdf", "2012-05-02"],
  ["tularemia", "Tularemia QRG", "120502_Tularemia_QRG_Final.pdf", "2012-05-02"],
  ["hemorrhagic-fever-viruses", "Hemorrhagic Fever Viruses QRG", "NRT CBRN BIO UPDATE HFViruses QRG_FINAL 2021 09 30.pdf", "2021-09-30"],
  ["hantavirus", "Hantavirus Pulmonary Syndrome QRG", "Hantavirus_QRG_Final_Exec_Sec_Review.pdf", null],
  ["smallpox-mpox", "Smallpox and Mpox QRG", "NRT CBRN BIO UPDATE smallpox_mpox QRG FINAL 12202024.pdf", "2024-12-20"],
  ["ricin-abrin", "Ricin and Abrin QRG", "NRT CBRN BIO Ricin Abrin QRG_ FINAL 2020 05 05.pdf", "2020-05-05"],
  ["botulinum-toxin", "Botulinum Neurotoxin QRG", "NRT CBRN BIO UPDATE BoNT QRG FINAL 2024 01 16.pdf", "2024-01-16"],
  ["biotoxin-reference", "Biotoxin Reference Document", "110908_Biotoxin_Reference_Document.pdf", "2011-09-08"],
];

const nrtRad = [
  ["ind", "Improvised Nuclear Device QRG", "RAD_IND_QRG_ExecSecVersion_EnDyna_13June2013.pdf", "2013-06-13"],
  ["rdd", "Radiological Dispersion Device QRG", "Final_RAD_QRG_17Dec2012_EnDyna.pdf", "2012-12-17"],
];

const remmPaths = [
  "TriageToolscombined.pdf", "ars.htm", "ars_summary.htm", "ars_timephases1.htm", "ars_tutorial.htm", "ars_wbd.htm", "arstimephases_tutorial.htm",
  "contam_modifiers.htm", "contamimage.htm", "contamimage_1.htm", "contamimage_2.htm", "contamimage_3.htm", "contamimage_4.htm", "contamimage_5.htm", "contamimage_6.htm",
  "contamonly.htm", "contamonly_tutorial.htm", "countermeasures_exposure.htm", "countermeasures_internal.htm", "decon_firehose.htm", "deconimage.htm", "decontent.htm", "deconvideo.htm",
  "diff_contam_exp.htm", "exposure_modifiers.htm", "exposurecontam.htm", "exposurecontam_modifiers.htm", "exposureimage.htm", "exposureimage_1.htm", "exposureonly.htm", "exposureonly_tutorial.htm",
  "ext_contamination.htm", "howtosurvey.htm", "int_contamination.htm", "medical_countermeasures.htm", "nocontamexp.htm", "nuclearaccident.htm", "nucleareffects_youtube.htm", "nuclearexplosion.htm",
  "nuclearfallout.htm", "nuclearfallout_youtube.htm", "nuclearmedequipmt.htm", "osha_niosh_rdd_ppe.htm", "radtriage.htm", "rdd.htm", "rdd_100min.htm", "rdd_dispersal.htm",
  "rdd_experimental.htm", "rdd_protectiveactions.htm", "rdd_response_talk.htm", "rdd_vs_fissionbomb.htm", "reactor_isotopes.htm", "reactor_types.htm", "remm_FirstResponder.htm", "remm_RadPhysics.htm",
  "remm_SourcesBooks.htm", "remm_SourcesContam.htm", "remm_SourcesGov.htm", "remm_SourcesHistory.htm", "remm_SourcesInternational.htm", "remm_SourcesIsotopes.htm", "remm_SourcesLate.htm",
  "remm_SourcesMedical.htm", "remm_SourcesNuclear.htm", "remm_SourcesPlans.htm", "remm_SourcesProf.htm", "remm_SourcesRDD.htm", "remm_SourcesReactors.htm", "remm_SourcesSafety.htm",
  "remm_SourcesTools.htm", "remm_SourcesofRadInfo.htm", "salttriage.htm", "triagetool5.htm", "triagetool_help.htm", "triagetool_intro.htm", "triagetool_new_video_tutorials.htm",
  "triagetool_tutorial.htm", "zones_CRCPD.htm", "zones_IAEA.htm", "zones_NCRP.htm", "zones_nucleardetonation.htm", "zones_radincident.htm", "zones_timesequence.htm",
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function candidate(sourceArtifactId, agency, sourceFamily, title, officialUrl, artifactType, publicationDate = null, documentIdentifier = null, sourceVersion = null, notes = null) {
  const url = new URL(officialUrl);
  const extension = artifactType === "PDF" ? ".pdf" : artifactType === "JSON_API" ? ".json" : ".html";
  return {
    sourceArtifactId, agency, department: null, sourceFamily, title, documentIdentifier, officialUrl,
    officialDomain: url.hostname, publicationDate, revisionDate: null, sourceVersion, artifactType,
    acquisitionMethod: artifactType === "JSON_API" ? "PUBLIC_API" : sourceArtifactId.endsWith("-index") ? "INDEX_DISCOVERY" : "HTTPS_DOWNLOAD",
    localSnapshotPath: `data/cbrne/source-artifacts/${slug(sourceFamily)}/${sourceArtifactId}${extension}`,
    copyrightOrUseStatus: "PUBLIC_FIRST_PARTY_GOVERNMENT_SOURCE",
    supersedes: null, supersededBy: null, notes,
  };
}

function disposition(sourceArtifactId, agency, sourceFamily, title, officialUrl, status, artifactType, notes) {
  const url = new URL(officialUrl);
  return {
    sourceArtifactId, agency, department: null, sourceFamily, title, documentIdentifier: null, officialUrl,
    officialDomain: url.hostname, publicationDate: null, revisionDate: null, sourceVersion: null, artifactType,
    acquisitionMethod: "MANUAL_ONLY", localSnapshotPath: null, copyrightOrUseStatus: null,
    intendedDisposition: status, supersedes: null, supersededBy: null, notes,
  };
}

const candidates = [
  candidate("epa-nrt-qrg-index", "EPA / National Response Team", "EPA_NRT_QRG", "CBRN Quick Reference Guides index", "https://www.epa.gov/emergency-response/chemical-biological-radiological-and-nuclear-quick-reference-guides", "WEB_PAGE"),
  candidate("nrt-biological-index", "National Response Team", "EPA_NRT_QRG", "Biological QRG index", "https://www.nrt.org/Main/Resources.aspx?Category=Biological&ResourceSection=2&ResourceType=Hazards%20%28Oil%2C%20Chemical%2C%20Radiological%2C%20etc%29", "WEB_PAGE"),
  candidate("nrt-chemical-index", "National Response Team", "EPA_NRT_QRG", "Chemical QRG index", "https://www.nrt.org/Main/Resources.aspx?Category=Chemical&ResourceSection=2&ResourceType=Hazards%20%28Oil%2C%20Chemical%2C%20Radiological%2C%20etc%29", "WEB_PAGE"),
  candidate("nrt-radiological-index", "National Response Team", "EPA_NRT_QRG", "Radiological and Nuclear QRG index", "https://www.nrt.org/Main/Resources.aspx?ResourceType=Hazards%20%28Oil%2C%20Chemical%2C%20Radiological%2C%20etc%29&ResourceSection=2&Category=Radiological%20and%20Nuclear%20Hazards%3A%20QRGs%20and%20other%20links", "WEB_PAGE"),
  ...nrtChemical.map(([id, title, filename, date]) => candidate(`nrt-qrg-chemical-${id}`, "EPA / National Response Team", "EPA_NRT_QRG", title, `https://www.nrt.org/sites/2/files/${encodeURIComponent(filename).replaceAll("%2F", "/")}`, "PDF", date, null, date)),
  candidate("nrt-sulfur-mustard-aegl-summary-1", "U.S. Army Public Health Command / NRT", "EPA_NRT_QRG", "Sulfur Mustard AEGL Summary Table 1", "https://www.nrt.org/sites/2/files/USAPHC_AR-40-5e_PHN0711-02_SummaryTable1_July2011.pdf", "PDF", "2011-07-01"),
  candidate("nrt-sulfur-mustard-aegl-summary-2", "U.S. Army Public Health Command / NRT", "EPA_NRT_QRG", "Sulfur Mustard AEGL Summary Table 2", "https://www.nrt.org/sites/2/files/USAPHC_AR-40-5e_PHN0711-03_SummaryTable2_July2011%202.pdf", "PDF", "2011-07-01"),
  ...nrtBiological.map(([id, title, filename, date]) => candidate(`nrt-qrg-biological-${id}`, "EPA / National Response Team", "EPA_NRT_QRG", title, `https://www.nrt.org/sites/2/files/${encodeURIComponent(filename).replaceAll("%2F", "/")}`, "PDF", date, null, date)),
  ...nrtRad.map(([id, title, filename, date]) => candidate(`nrt-qrg-rad-${id}`, "EPA / National Response Team", "EPA_NRT_QRG", title, `https://www.nrt.org/sites/2/files/${encodeURIComponent(filename).replaceAll("%2F", "/")}`, "PDF", date, null, date)),
  disposition("nrt-qrg-biological-tick-borne-encephalitis", "EPA / National Response Team", "EPA_NRT_QRG", "Tick-Borne Encephalitis QRG", "https://www.epa.gov/emergency-response/chemical-biological-radiological-and-nuclear-quick-reference-guides", "MANUAL_ACQUISITION_REQUIRED", "PDF", "Listed by the EPA index, but no child artifact appears on the current public NRT Biological QRG index."),

  candidate("chemm-index", "HHS ASPR", "CHEMM", "Chemical Hazards Emergency Medical Management", "https://chemm.hhs.gov/", "WEB_PAGE"),
  candidate("chemm-sitemap-index", "HHS ASPR", "CHEMM", "CHEMM sitemap", "https://chemm.hhs.gov/sitemap", "WEB_PAGE"),
  candidate("chemm-download-index", "HHS ASPR", "CHEMM", "Download CHEMM", "https://chemm.hhs.gov/download-chemm", "WEB_PAGE"),
  candidate("chemm-patient-care-index", "HHS ASPR", "CHEMM", "CHEMM Patient Care", "https://chemm.hhs.gov/patient-care", "WEB_PAGE"),
  candidate("chemm-nerve-agents", "HHS ASPR", "CHEMM", "Nerve Agents", "https://chemm.hhs.gov/nerveagents.htm", "WEB_PAGE"),
  candidate("chemm-nerve-agents-hospital", "HHS ASPR", "CHEMM", "Nerve Agents Hospital Management", "https://chemm.hhs.gov/na_hospital_mmg.htm", "WEB_PAGE"),
  candidate("chemm-fga-medical-management", "HHS ASPR", "CHEMM", "Fourth Generation Agents Medical Management Guidelines", "https://chemm.hhs.gov/nerveagents/FGA.htm", "WEB_PAGE", "2019-01-18", null, "Information as of January 18, 2019"),
  candidate("chemm-decontamination", "HHS ASPR", "CHEMM", "Patient Decontamination", "https://chemm.hhs.gov/incident-primer/decontamination", "WEB_PAGE"),
  candidate("chemm-ppe", "HHS ASPR", "CHEMM", "Personal Protective Equipment", "https://chemm.hhs.gov/incident-primer/ppe", "WEB_PAGE"),
  candidate("chemm-triage", "HHS ASPR", "CHEMM", "Triage", "https://chemm.hhs.gov/incident-primer/triage", "WEB_PAGE"),
  candidate("chemm-responder-safety", "HHS ASPR", "CHEMM", "Responder Safety", "https://chemm.hhs.gov/incident-primer#responder-safety", "WEB_PAGE"),
  candidate("chemm-medical-countermeasures", "HHS ASPR", "CHEMM", "Medical Countermeasures Database", "https://chemm.hhs.gov/medical_countermeasures.htm", "WEB_PAGE"),
  disposition("chemm-offline-pwa-package", "HHS ASPR", "CHEMM", "CHEMM offline application package", "https://chemm.hhs.gov/download-chemm", "MANUAL_ACQUISITION_REQUIRED", "DATASET", "The current download flow requires interactive acknowledgement and browser service-worker installation; no stable public package URL is exposed."),

  candidate("remm-index", "HHS ASPR", "REMM", "Radiation Emergency Medical Management", "https://remm.hhs.gov/", "WEB_PAGE"),
  candidate("remm-sitemap-index", "HHS ASPR", "REMM", "REMM sitemap", "https://remm.hhs.gov/sitemap.htm", "WEB_PAGE"),
  candidate("remm-whats-new", "HHS ASPR", "REMM", "REMM update history", "https://remm.hhs.gov/whatsnew.htm", "WEB_PAGE"),
  candidate("remm-radiation-ppe", "HHS ASPR", "REMM", "PPE in a Radiation Emergency", "https://remm.hhs.gov/radiation_ppe.htm", "WEB_PAGE"),
  candidate("remm-protective-actions", "HHS ASPR", "REMM", "Protective Actions and PAGs", "https://remm.hhs.gov/pag.htm", "WEB_PAGE"),
  ...remmPaths.map((path) => candidate(`remm-${slug(path.replace(/\.[^.]+$/, ""))}`, "HHS ASPR", "REMM", `REMM ${basename(path, extname(path)).replaceAll("_", " ")}`, `https://remm.hhs.gov/${path}`, path.toLowerCase().endsWith(".pdf") ? "PDF" : "WEB_PAGE")),

  candidate("fema-nuclear-planning-third-edition", "FEMA", "FEMA_NUCLEAR_RESPONSE", "Planning Guidance for Response to a Nuclear Detonation, Third Edition", "https://www.fema.gov/sites/default/files/documents/fema_nuc-detonation-planning-guide.pdf", "PDF", "2022-01-01", null, "Third Edition (2022)"),
  candidate("fema-nuclear-first-72-hours", "FEMA", "FEMA_NUCLEAR_RESPONSE", "Nuclear Detonation Response Guidance: Planning for the First 72 Hours", "https://www.fema.gov/sites/default/files/documents/fema_oet-72-hour-nuclear-detonation-response-guidance.pdf", "PDF", "2024-01-01", null, "2024"),
  candidate("fema-nuclear-communications", "FEMA", "FEMA_NUCLEAR_RESPONSE", "Nuclear Detonation Preparedness: Communicating in the Immediate Aftermath", "https://www.fema.gov/sites/default/files/documents/fema_nuclear-detonation-preparedness_communicating-in-the-immediate-aftermath_v3_2024.pdf", "PDF", "2024-01-01", null, "Second Edition (2024)"),
  candidate("fema-nria", "FEMA", "FEMA_NUCLEAR_RESPONSE", "Nuclear/Radiological Incident Annex to the Response and Recovery FIOP", "https://www.fema.gov/sites/default/files/documents/fema_incident-annex_nuclear-radiological.pdf", "PDF", "2023-05-16", null, "May 2023"),
  candidate("fema-chemical-incident-annex", "FEMA", "FEMA_CBRNE_DOCTRINE", "Oil/Chemical Incident Annex", "https://www.fema.gov/sites/default/files/documents/fema_incident-annex-oil-chemical.pdf", "PDF"),
  candidate("fema-chemical-consequence-framework", "FEMA", "FEMA_CBRNE_DOCTRINE", "Planning Framework for a Chemical Incident", "https://www.fema.gov/sites/default/files/documents/fema_planning-framework-for-chemical-incident-consequence-management-2022.pdf", "PDF", "2022-01-01"),
  candidate("fema-chemical-kpf", "FEMA", "FEMA_CBRNE_DOCTRINE", "Chemical Incident Key Planning Factors", "https://www.fema.gov/sites/default/files/documents/fema_chemical-incident-kpf-2022.pdf", "PDF", "2022-01-01"),
  candidate("fema-biological-incident-annex", "FEMA", "FEMA_CBRNE_DOCTRINE", "Biological Incident Annex", "https://www.fema.gov/sites/default/files/documents/fema_rd_biological-incident-annex-npb_042025_0.pdf", "PDF", "2025-04-01"),
  candidate("fema-biotoxin-addendum", "FEMA", "FEMA_CBRNE_DOCTRINE", "Biologically Derived Toxins Addendum", "https://www.fema.gov/sites/default/files/documents/fema_rd_biologically-derived-toxins-addendum-npb_042025.pdf", "PDF", "2025-04-01"),
  candidate("fema-biological-kpf", "FEMA", "FEMA_CBRNE_DOCTRINE", "Biological Incident Key Planning Factors", "https://www.fema.gov/sites/default/files/documents/fema_biological-incident-kpf-2022.pdf", "PDF", "2022-01-01"),

  candidate("epa-pag-index", "EPA", "EPA_PAG", "PAG Manuals and Resources", "https://www.epa.gov/radiation/pag-manuals-and-resources", "WEB_PAGE"),
  candidate("epa-pag-2017", "EPA", "EPA_PAG", "Protective Action Guides and Planning Guidance for Radiological Incidents", "https://www.epa.gov/system/files/documents/2025-04/epa_pag_manual_final_revisions_01-11-2017_cover_508-d.pdf", "PDF", "2017-01-01", "EPA-400/R-17/001", "January 2017 final revision"),
  candidate("epa-pag-communications-index", "EPA", "EPA_PAG", "PAG Public Communication Resources", "https://www.epa.gov/radiation/pag-public-communication-resources", "WEB_PAGE"),
  disposition("epa-pag-2016", "EPA", "EPA_PAG", "2016 PAG Manual", "https://www.epa.gov/radiation/pag-manuals-and-resources", "SUPERSEDED", "PDF", "The January 2017 final revision explicitly supersedes the 2016 manual."),
  disposition("epa-pag-2013", "EPA", "EPA_PAG", "2013 interim PAG Manual", "https://www.epa.gov/radiation/pag-manuals-and-resources", "SUPERSEDED", "PDF", "The January 2017 final revision explicitly supersedes the 2013 interim manual."),
  disposition("epa-pag-1992", "EPA", "EPA_PAG", "1992 PAG Manual", "https://www.epa.gov/radiation/pag-manuals-and-resources", "SUPERSEDED", "PDF", "The January 2017 final revision explicitly supersedes the 1992 manual."),

  candidate("cdc-radiation-population-index", "CDC", "CDC_RADIATION_POPULATION_MONITORING", "Population Monitoring", "https://www.cdc.gov/radiation-emergencies/php/population-monitoring/index.html", "WEB_PAGE", "2024-04-08"),
  candidate("cdc-population-monitoring-second-edition", "CDC", "CDC_RADIATION_POPULATION_MONITORING", "Population Monitoring in Radiation Emergencies, Second Edition", "https://www.cdc.gov/radiation-emergencies/media/pdfs/2024/04/population-monitoring-guide.pdf", "PDF", "2014-04-01", null, "Second Edition"),
  candidate("cdc-radiation-public-shelters", "CDC", "CDC_RADIATION_POPULATION_MONITORING", "A Guide to Operating Public Shelters in a Radiation Emergency", "https://www.cdc.gov/radiation-emergencies/media/pdfs/2024/04/operating-public-shelters-1.pdf", "PDF", "2015-02-01"),
  candidate("cdc-radiation-contamination-vs-exposure", "CDC", "CDC_RADIATION_POPULATION_MONITORING", "Contamination versus Exposure", "https://www.cdc.gov/radiation-emergencies/infographic/contamination-versus-exposure.html", "WEB_PAGE", "2024-04-17"),
  candidate("cdc-radiation-contamination-vs-exposure-pdf", "CDC", "CDC_RADIATION_POPULATION_MONITORING", "Radiation Contamination versus Exposure infographic", "https://www.cdc.gov/radiation-emergencies/media/pdfs/Infographic_Contamination_versus_Exposure.pdf", "PDF"),
  candidate("cdc-radiation-instruments", "CDC", "CDC_RADIATION_POPULATION_MONITORING", "Use of Radiation Detection, Measuring, and Imaging Instruments", "https://www.cdc.gov/radiation-emergencies/hcp/screening/index.html", "WEB_PAGE", "2024-04-27"),

  candidate("nndc-ensdf-api-index", "Brookhaven National Laboratory NNDC", "NNDC_ENSDF", "ENSDF API documentation", "https://www.nndc.bnl.gov/ensdf-api/", "WEB_PAGE"),
  candidate("nndc-ensdf-openapi", "Brookhaven National Laboratory NNDC", "NNDC_ENSDF", "ENSDF OpenAPI schema", "https://www.nndc.bnl.gov/ensdf-api/openapi.json", "JSON_API"),
  candidate("nndc-ensdf-release", "Brookhaven National Laboratory NNDC", "NNDC_ENSDF", "ENSDF API release metadata", "https://www.nndc.bnl.gov/ensdf-api/meta/release", "JSON_API"),
  ...["137CS", "60CO", "192IR", "241AM", "90SR", "131I", "226RA", "235U", "238U", "239PU"].flatMap((name) => [
    candidate(`nndc-${name.toLowerCase()}-identity`, "Brookhaven National Laboratory NNDC", "NNDC_ENSDF", `${name} nuclide identity`, `https://www.nndc.bnl.gov/ensdf-api/nuclides/${name}`, "JSON_API"),
    candidate(`nndc-${name.toLowerCase()}-levels`, "Brookhaven National Laboratory NNDC", "NNDC_ENSDF", `${name} evaluated levels`, `https://www.nndc.bnl.gov/ensdf-api/nuclides/${name}/levels?limit=500`, "JSON_API"),
    candidate(`nndc-${name.toLowerCase()}-decays`, "Brookhaven National Laboratory NNDC", "NNDC_ENSDF", `${name} evaluated decay datasets`, `https://www.nndc.bnl.gov/ensdf-api/nuclides/${name}/decays?limit=500`, "JSON_API"),
  ]),

  candidate("opcw-handbook-index", "OPCW", "OPCW_CWA_IDENTITY", "Handbook on Chemicals", "https://www.opcw.org/resources/declarations/handbook-chemicals", "WEB_PAGE"),
  candidate("opcw-handbook-2024", "OPCW", "OPCW_CWA_IDENTITY", "Handbook on Chemicals 2024", "https://www.opcw.org/sites/default/files/documents/2024/03/Handbook%20of%20Chemicals_2024.pdf", "PDF", "2024-03-01", null, "2024"),
  candidate("opcw-schedule-1", "OPCW", "OPCW_CWA_IDENTITY", "Chemical Weapons Convention Schedule 1", "https://www.opcw.org/chemical-weapons-convention/annexes/annex-chemicals/schedule-1", "WEB_PAGE"),
  candidate("opcw-schedule-2", "OPCW", "OPCW_CWA_IDENTITY", "Chemical Weapons Convention Schedule 2", "https://www.opcw.org/chemical-weapons-convention/annexes/annex-chemicals/schedule-2", "WEB_PAGE"),
  candidate("opcw-schedule-3", "OPCW", "OPCW_CWA_IDENTITY", "Chemical Weapons Convention Schedule 3", "https://www.opcw.org/chemical-weapons-convention/annexes/annex-chemicals/schedule-3", "WEB_PAGE"),

  candidate("niosh-ersh-index", "CDC NIOSH", "NIOSH_ERSH_LEGACY", "Emergency Response Safety and Health Database", "https://www.cdc.gov/niosh/ershdb/default.html", "WEB_PAGE", "2011-05-12", null, "LEGACY / SUPPLEMENTAL"),
  candidate("niosh-ersh-agent-index", "CDC NIOSH", "NIOSH_ERSH_LEGACY", "ERSH-DB Agent Name Index", "https://www.cdc.gov/niosh/ershdb/index_name.html", "WEB_PAGE", "2011-05-12", null, "LEGACY / SUPPLEMENTAL"),
  ...[["sarin", "29750001"], ["ricin", "29750002"], ["soman", "29750003"], ["vx", "29750005"], ["sulfur-mustard", "29750008"], ["phosgene", "29750023"]].map(([name, number]) =>
    candidate(`niosh-ersh-${name}`, "CDC NIOSH", "NIOSH_ERSH_LEGACY", `ERSH-DB ${name.replaceAll("-", " ")} card`, `https://www.cdc.gov/niosh/ershdb/emergencyresponsecard_${number}.html`, "WEB_PAGE", "2011-05-12", null, "LEGACY / SUPPLEMENTAL")),

  candidate("fbi-wmd-index", "FBI", "FBI_PUBLIC_WMD", "Weapons of Mass Destruction", "https://www.fbi.gov/investigate/wmd", "WEB_PAGE"),
  candidate("fbi-wmd-coordinators-2025", "FBI", "FBI_PUBLIC_WMD", "WMD Coordinators: Keeping America Left-of-Boom Safe", "https://www.fbi.gov/news/stories/wmd-coordinators-aim-for-left-of-boom-in-outreach-and-training-efforts", "WEB_PAGE", "2025-01-29"),
  candidate("fbi-terrorism-publications-index", "FBI", "FBI_PUBLIC_WMD", "FBI Terrorism Publications", "https://www.fbi.gov/investigate/terrorism/publications", "WEB_PAGE"),
  candidate("fbi-crimepi-domestic-2025", "FBI", "FBI_PUBLIC_WMD", "Joint Criminal and Epidemiological Investigation Handbook, Domestic Edition", "https://www.fbi.gov/file-repository/joint-criminal-and-epidemiological-investigation-handbook-domestic-edition", "PDF", "2025-05-27", null, "May 2025"),
  disposition("fbi-restricted-threat-credibility-material", "FBI", "FBI_PUBLIC_WMD", "Restricted Threat Credibility Evaluation procedures", "https://www.fbi.gov/investigate/wmd", "OUT_OF_SCOPE", "DATASET", "Restricted/non-public procedures are intentionally excluded; only public coordination doctrine is eligible."),

  candidate("atf-tools-index", "ATF", "ATF_PUBLIC_EXPLOSIVES", "Law Enforcement Tools and Services", "https://www.atf.gov/explosives/law-enforcement-tools-services", "WEB_PAGE"),
  candidate("atf-national-response-team", "ATF", "ATF_PUBLIC_EXPLOSIVES", "National Response Teams", "https://www.atf.gov/careers/rapid-response-teams/national-response-teams", "WEB_PAGE"),
  candidate("atf-basic-post-blast", "ATF", "ATF_PUBLIC_EXPLOSIVES", "Basic Post-Blast Investigative Techniques", "https://www.atf.gov/explosives/enforcement-tools-services/arson-explosives-training-programs/basic-post-blast-investigative-techniques", "WEB_PAGE"),
  candidate("atf-ncetr", "ATF", "ATF_PUBLIC_EXPLOSIVES", "National Center for Explosives Training and Research", "https://www.atf.gov/explosives/national-center-explosives-training-and-research", "WEB_PAGE"),
  candidate("atf-usbdc", "ATF", "ATF_PUBLIC_EXPLOSIVES", "U.S. Bomb Data Center", "https://www.atf.gov/explosives/us-bomb-data-center", "WEB_PAGE"),
  disposition("atf-bats", "ATF", "ATF_PUBLIC_EXPLOSIVES", "Bomb Arson Tracking System", "https://www.atf.gov/explosives/bomb-arson-tracking-system", "OUT_OF_SCOPE", "DATASET", "BATS is protected law-enforcement content and is explicitly excluded from acquisition."),

  candidate("nrc-state-local-response", "NRC", "FEDERAL_RAD_SUPPORT", "State and Local Response Actions", "https://www.nrc.gov/about-nrc/emerg-preparedness/respond-to-emerg/state-local-actions", "WEB_PAGE", "2020-11-13"),
  candidate("doe-nest", "DOE NNSA", "FEDERAL_RAD_SUPPORT", "Nuclear Emergency Support Team", "https://www.energy.gov/nnsa/nuclear-emergency-support-team-nest", "WEB_PAGE"),
  candidate("doe-emergency-response-resources", "DOE", "FEDERAL_RAD_SUPPORT", "Emergency Response Resources", "https://www.energy.gov/ehss/emergency-response-resources", "WEB_PAGE"),
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function allowedDomain(hostname) {
  const value = hostname.toLowerCase();
  return officialDomains.some((domain) => value === domain || value.endsWith(`.${domain}`));
}

function detectContentType(buffer, declared) {
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  const text = buffer.subarray(0, 1024).toString("utf8").trimStart();
  if (text.startsWith("{") || text.startsWith("[")) return "application/json";
  if (/^<!doctype html|^<html/i.test(text)) return "text/html";
  return declared?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function parseable(path, type, buffer) {
  if (type === "application/json") {
    try { JSON.parse(buffer.toString("utf8")); return true; } catch { return false; }
  }
  if (type === "text/html") {
    const text = buffer.toString("utf8");
    return /<html|<!doctype html/i.test(text) && text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length > 100;
  }
  if (type === "application/pdf") {
    try {
      const text = execFileSync("pdftotext", ["-f", "1", "-l", "3", path, "-"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
      return text.trim().length > 40;
    } catch {
      return buffer.subarray(0, 5).toString() === "%PDF-";
    }
  }
  return false;
}

function parseMethod(type, parsed) {
  if (!parsed) return "NOT_PARSED";
  if (type === "application/json") return "STRUCTURED_JSON";
  if (type === "text/html") return "HTML_DOCUMENT";
  if (type === "application/pdf") return "PDF_STRUCTURE";
  return "NOT_PARSED";
}

function invalidBody(buffer, type) {
  const text = buffer.subarray(0, 16384).toString("utf8");
  if (type === "application/json") {
    try {
      const value = JSON.parse(buffer.toString("utf8"));
      if (value === null || typeof value !== "object") return "JSON artifact does not contain an object or array.";
    } catch {
      return "JSON artifact cannot be parsed.";
    }
  } else if (buffer.length < 256) return "Artifact is implausibly small.";
  if (type === "text/html" && /access denied|request blocked|captcha|sign in to continue|page not found|404 not found/i.test(text)) return "Downloaded HTML is an error, access-denied, login, or placeholder page.";
  return null;
}

function existingRegistry() {
  if (!existsSync(OUTPUT)) return new Map();
  try {
    return new Map(JSON.parse(readFileSync(OUTPUT, "utf8")).map((entry) => [entry.sourceArtifactId, entry]));
  } catch {
    return new Map();
  }
}

async function acquire(item, prior) {
  if (item.intendedDisposition) {
    return { ...item, retrievedAt: null, sha256: null, contentType: null, fileSize: null, currentStatus: item.intendedDisposition, parsed: false, parseMethod: "NOT_PARSED", duplicateOf: null, failureReason: item.notes };
  }

  const absolutePath = resolve(ROOT, item.localSnapshotPath);
  if (!REFRESH && ["ACQUIRED", "DUPLICATE"].includes(prior?.currentStatus) && existsSync(absolutePath)) {
    const buffer = readFileSync(absolutePath);
    const digest = sha256(buffer);
    if (digest === prior.sha256 && buffer.length === prior.fileSize) {
      const parsed = parseable(absolutePath, prior.contentType, buffer);
      return { ...prior, currentStatus: "ACQUIRED", parsed, parseMethod: parseMethod(prior.contentType, parsed), duplicateOf: null, failureReason: null };
    }
  }

  mkdirSync(dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.partial`;
  rmSync(tempPath, { force: true });
  try {
    const response = await fetch(item.officialUrl, {
      redirect: "follow",
      headers: { "user-agent": "HAZMATIQ-Source-Acquisition/1.0 (+public-authoritative-source-audit)" },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const finalUrl = new URL(response.url);
    if (!allowedDomain(finalUrl.hostname)) throw new Error(`Redirected outside approved official domains to ${finalUrl.hostname}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = detectContentType(buffer, response.headers.get("content-type"));
    const expected = item.artifactType === "PDF" ? "application/pdf" : item.artifactType === "JSON_API" ? "application/json" : "text/html";
    if (contentType !== expected) throw new Error(`Expected ${expected}, received ${contentType}`);
    const invalid = invalidBody(buffer, contentType);
    if (invalid) throw new Error(invalid);
    writeFileSync(tempPath, buffer);
    renameSync(tempPath, absolutePath);
    const parsed = parseable(absolutePath, contentType, buffer);
    return {
      ...item, retrievedAt: prior?.retrievedAt ?? ACQUIRED_AT, sha256: sha256(buffer), contentType,
      fileSize: statSync(absolutePath).size, currentStatus: "ACQUIRED", parsed, parseMethod: parseMethod(contentType, parsed), duplicateOf: null, failureReason: null,
    };
  } catch (error) {
    rmSync(tempPath, { force: true });
    const message = error instanceof Error ? error.message : String(error);
    const blocked = /HTTP (401|403)|access.denied|login/i.test(message);
    return {
      ...item, retrievedAt: null, sha256: null, contentType: null, fileSize: null,
      currentStatus: blocked ? "ACCESS_BLOCKED" : "FAILED", parsed: false, parseMethod: "NOT_PARSED", duplicateOf: null, failureReason: message,
    };
  }
}

for (const item of candidates) {
  if (["nrt-qrg-chemical-methyl-isocyanate", "nrt-qrg-biological-biotoxin-reference"].includes(item.sourceArtifactId)) {
    item.acquisitionMethod = "MANUAL_ONLY";
    item.localSnapshotPath = null;
    item.intendedDisposition = "MANUAL_ACQUISITION_REQUIRED";
    item.notes = "The current official NRT PDF link returns the same 400x300 JPEG placeholder rather than a PDF artifact.";
  }
  if (["fbi-wmd-index", "fbi-crimepi-domestic-2025"].includes(item.sourceArtifactId)) {
    item.acquisitionMethod = "MANUAL_ONLY";
    item.localSnapshotPath = null;
    item.intendedDisposition = "ACCESS_BLOCKED";
    item.notes = item.sourceArtifactId === "fbi-crimepi-domestic-2025"
      ? "The official May 2025 handbook is publicly listed, but the FBI repository blocks automated retrieval; a stale 2018 cached file is not accepted as the 2025 artifact."
      : "The official public page is readable interactively but blocks repeatable automated snapshot acquisition.";
  }
}

const ids = new Set();
for (const item of candidates) {
  if (ids.has(item.sourceArtifactId)) throw new Error(`Duplicate sourceArtifactId: ${item.sourceArtifactId}`);
  ids.add(item.sourceArtifactId);
  const url = new URL(item.officialUrl);
  if (url.protocol !== "https:" || url.hostname !== item.officialDomain || !allowedDomain(url.hostname)) throw new Error(`Invalid official URL: ${item.officialUrl}`);
}

const prior = existingRegistry();
const artifacts = [];
for (const item of candidates) {
  const artifact = await acquire(item, prior.get(item.sourceArtifactId));
  artifacts.push(artifact);
  process.stdout.write(`${artifact.currentStatus.padEnd(30)} ${artifact.sourceArtifactId}\n`);
}

const hashOwners = new Map();
for (const artifact of artifacts) {
  if (artifact.currentStatus !== "ACQUIRED" || !artifact.sha256) continue;
  const owner = hashOwners.get(artifact.sha256);
  if (!owner) hashOwners.set(artifact.sha256, artifact.sourceArtifactId);
  else {
    artifact.currentStatus = "DUPLICATE";
    artifact.duplicateOf = owner;
    artifact.failureReason = `Exact byte duplicate of ${owner}; the requested child URL did not yield distinct content.`;
  }
}

mkdirSync(dirname(OUTPUT), { recursive: true });
const next = `${JSON.stringify(artifacts, null, 2)}\n`;
if (!existsSync(OUTPUT) || readFileSync(OUTPUT, "utf8") !== next) writeFileSync(OUTPUT, next);

const totals = artifacts.reduce((result, artifact) => {
  result[artifact.currentStatus] = (result[artifact.currentStatus] ?? 0) + 1;
  return result;
}, {});
process.stdout.write(`${JSON.stringify({ total: artifacts.length, ...totals }, null, 2)}\n`);
