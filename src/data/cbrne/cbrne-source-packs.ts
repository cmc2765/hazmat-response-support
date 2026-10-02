import type { CbrneImportPackage, CbrneImportRecord, CbrneImportSourceFact } from "../../lib/cbrne/cbrneImportTypes.js";
import type { CbrneFieldGroup } from "../../lib/cbrne/cbrneTypes.js";

const IMPORTED_AT = "2026-08-26T00:00:00.000Z";

function fact(
  fieldGroup: CbrneFieldGroup,
  fieldName: string,
  value: string,
  sourcePage: string,
  verificationStatus: CbrneImportSourceFact["verificationStatus"] = "Requires SME Review",
  notes = "Concise responder-facing paraphrase; confirm against the linked source and local protocols before operational use.",
): CbrneImportSourceFact {
  return { fieldGroup, fieldName, value, sourcePage, verificationStatus, notes };
}

const nioshNerveAgentFacts = (agent: "VX" | "Sarin (GB)"): CbrneImportSourceFact[] => [
  fact("IDENTITY", "Agent identity", `${agent} is identified by NIOSH as a nerve agent.`, "Agent Characteristics — Description", "Source Imported"),
  fact("HAZARDS", "Primary responder hazard", "Nerve-agent exposure can rapidly disrupt nervous-system function and may become fatal within minutes.", "Agent Characteristics — Description; Signs/Symptoms — Time Course"),
  fact("DETECTION", "Recognition and confirmation", "Use the cholinergic nerve-agent toxidrome for initial recognition and coordinate confirmation with trained hazardous-material sampling and analysis resources.", "Signs/Symptoms; Emergency Response — Sampling and Analysis"),
  fact("PPE", "Unknown concentration entry protection", "For an unknown contaminant or unknown concentration, NIOSH directs trained responders to use CBRN-certified SCBA with Level A protection until monitoring identifies the contaminant and concentration.", "Personal Protective Equipment — General Information", "Requires SME Review", "This is a source-imported starting point, not a PPE downgrade or independent entry authorization."),
  fact("ISOLATION_STANDOFF", "Scene control", "Stay upwind and keep personnel out of poorly ventilated, low-lying, or confined areas; apply source-card distances only when the described spill or fire scenario actually matches.", "Emergency Response — Initial Isolation and Protective Action Distances; Physical Dangers", "Requires SME Review", "No universal standoff distance is created by this fact."),
  fact("DECON", "Responder and patient decontamination", "Place decontamination upwind and uphill, use trained personnel in appropriate PPE, remove contaminated clothing, and wash exposed skin with soap and water while preventing secondary exposure.", "Decontamination — Decontamination Corridor; Individual Decontamination"),
  fact("MEDICAL", "Urgent medical priorities", "Move the patient from exposure, protect the airway, support ventilation as needed, and use nerve-agent antidotes only under applicable medical direction and protocols.", "First Aid — General Information; Inhalation", "Requires SME Review", "Medication selection and dosing are intentionally not reproduced in Hazard ID."),
  fact("TECHNICAL_OPERATIONS", "Operational controls", "Establish controlled hot, warm, and cold work areas, prevent contaminated runoff from spreading, and document responder and patient transfers.", "Emergency Response — Fire Fighting Information; Decontamination — Decontamination Corridor"),
];

const sulfurMustardRecord: CbrneImportRecord = {
  displayName: "Sulfur Mustard",
  domain: "CHEMICAL_WARFARE",
  category: "BLISTER_AGENT",
  aliases: ["Mustard", "Mustard gas"],
  agentCodes: ["HD"],
  cas: ["505-60-2"],
  unNaNumbers: ["2810"],
  sourceFacts: [
    fact("IDENTITY", "Agent identity", "Sulfur mustard (HD) is identified by NIOSH as a blister agent and persistent liquid contact hazard.", "Agent Characteristics — Description", "Source Imported"),
    fact("HAZARDS", "Primary responder hazards", "Sulfur mustard can injure the eyes, skin, respiratory tract, and immune system; vapor can collect in low-lying or poorly ventilated areas, and clinical effects may be delayed.", "Agent Characteristics; Emergency Response — Physical Dangers; Signs/Symptoms — Time Course"),
    fact("SYMPTOMS", "Delayed injury recognition", "Eye irritation and pain, skin redness or blistering, and respiratory irritation or breathing difficulty may appear hours after exposure; an initially asymptomatic patient may still develop serious injury.", "Signs/Symptoms — Time Course; Eye, Skin, and Inhalation Exposure"),
    fact("DETECTION", "Recognition and confirmation", "Do not use the absence of immediate pain or visible injury to exclude exposure; coordinate hazard confirmation with trained monitoring, sampling, and analysis resources.", "Signs/Symptoms — Time Course; Emergency Response — Sampling and Analysis"),
    fact("PPE", "Unknown contaminant entry protection", "For an unknown contaminant or concentration, NIOSH directs trained responders to use CBRN-certified SCBA with Level A protection until monitoring confirms the contaminant and concentration.", "Personal Protective Equipment — General Information", "Requires SME Review", "This source fact is not an independent entry authorization or PPE downgrade."),
    fact("ISOLATION_STANDOFF", "Scene control", "Stay upwind and keep personnel out of low-lying, confined, or poorly ventilated areas; use source-card distances only when the described spill or fire scenario and material identity match.", "Emergency Response — Initial Isolation and Protective Action Distances; Physical Dangers", "Requires SME Review", "No universal standoff distance is created by this profile."),
    fact("DECON", "Patient contamination control", "Move the patient into the decontamination corridor, remove contaminated clothing, wash exposed skin with soap and water without breaking the skin, cover open wounds, and prevent secondary contamination.", "Decontamination — Individual Decontamination"),
    fact("MEDICAL", "Urgent medical priorities", "Remove the patient from exposure, protect the airway, support breathing as required, obtain immediate medical attention, and account for delayed eye, skin, respiratory, and systemic effects under medical direction.", "First Aid — General Information; Eye, Inhalation, and Skin", "Requires SME Review", "No treatment dose or unsupervised medical order is stored."),
    fact("TECHNICAL_OPERATIONS", "Operational controls", "Control hot, warm, and cold work areas, avoid splashing or spreading liquid contamination, contain runoff when feasible, and document responder and patient transfers.", "Emergency Response — Fire Fighting Information; Decontamination — Decontamination Corridor"),
  ],
};

const ricinResponderRecord: CbrneImportRecord = {
  displayName: "Ricin",
  domain: "BIOLOGICAL",
  category: "BIOLOGICAL_TOXIN",
  aliases: ["Ricin toxin"],
  cas: ["9009-86-3"],
  unNaNumbers: ["3462"],
  sourceFacts: [
    fact("IDENTITY", "Agent identity", "Ricin is identified by NIOSH as a highly toxic biological toxin; illness from exposure is not communicable person to person.", "Agent Characteristics — Description; Signs/Symptoms — Short-Term Exposure", "Source Imported"),
    fact("HAZARDS", "Primary responder hazards", "Ricin exposure can cause severe respiratory or gastrointestinal illness, dehydration, and multi-organ injury; effects depend on the route and extent of exposure.", "Signs/Symptoms — Effects of Short-Term Exposure"),
    fact("SYMPTOMS", "Recognition indicators", "Possible findings include cough, fever, respiratory distress, eye inflammation, or severe vomiting and diarrhea; some serious systemic effects can be delayed.", "Signs/Symptoms — Time Course; Eye, Ingestion, and Inhalation Exposure"),
    fact("DETECTION", "Recognition and confirmation", "Use the clinical pattern only for initial recognition and coordinate confirmation with public-health authorities and qualified laboratory resources; do not treat symptoms alone as agent confirmation.", "Signs/Symptoms; Emergency Response — Sampling and Analysis"),
    fact("PPE", "Unknown contaminant entry protection", "For an unknown contaminant or concentration, NIOSH directs trained responders to use CBRN-certified SCBA with Level A protection until monitoring confirms the contaminant and concentration.", "Personal Protective Equipment — General Information", "Requires SME Review", "This source fact is not an independent entry authorization or PPE downgrade."),
    fact("ISOLATION_STANDOFF", "Incident-specific scene control", "The NIOSH card does not provide an agent-specific ERG table distance; establish zones from incident characterization, monitoring, applicable procedures, and Incident Command direction.", "Emergency Response — Initial Isolation and Protective Action Distances", "Requires SME Review", "No fixed distance is inferred."),
    fact("DECON", "Patient contamination control", "Move the patient into the decontamination corridor, remove contaminated clothing, wash exposed skin with soap and water without breaking the skin, cover open wounds, and prevent secondary contamination.", "Decontamination — Individual Decontamination"),
    fact("MEDICAL", "Urgent medical priorities", "Initial care is supportive: remove the patient from exposure, protect the airway, support breathing as needed, and obtain immediate medical attention under applicable medical direction.", "First Aid — General Information; Eye, Inhalation, and Skin", "Requires SME Review", "Medication and procedure doses are intentionally not stored."),
    fact("TECHNICAL_OPERATIONS", "Operational controls", "Avoid creating or spreading dust, control contaminated runoff when feasible, use appropriate PPE, and coordinate scene responsibilities and evidence handling through Incident Command.", "Emergency Response — Fire Fighting and Spill Controls; On-Site Fatalities — Incident Site"),
  ],
};

const anthraxRecord: CbrneImportRecord = {
  displayName: "Anthrax",
  scientificName: "Bacillus anthracis",
  domain: "BIOLOGICAL",
  category: "BACTERIAL_AGENT",
  aliases: ["B. anthracis"],
  sourceFacts: [
    fact("IDENTITY", "Agent identity", "Bacillus anthracis is a bacterium that causes anthrax; inhalation, gastrointestinal, and cutaneous disease are the predominant clinical forms.", "Page 1 — Agent Characteristics", "Source Imported"),
    fact("HAZARDS", "Responder hazard summary", "Environmental contamination can persist for long periods, inhalation disease can be severe without prompt diagnosis and treatment, and anthrax is not considered communicable person to person.", "Pages 1–2 — Agent Characteristics and Health Effects"),
    fact("DETECTION", "Environmental sampling coordination", "Coordinate site access and environmental sampling with law enforcement, public-health authorities, and laboratories that can accept the site-specific sample types; use a documented sampling and quality plan.", "Page 6 — Environmental Sampling"),
    fact("PPE", "Responder PPE selection", "Use trained, fit-tested responders and site-specific hazard assessment to select NIOSH-approved CBRN respiratory and protective clothing; any downgrade requires the site safety officer, risk assessment, and monitoring.", "Pages 3–4 — Personnel Safety and PPE", "Requires SME Review", "The profile does not select a PPE level or authorize a downgrade."),
    fact("ISOLATION_STANDOFF", "Exposure control", "No occupational exposure guideline is established in the QRG; minimize responder exposure and establish incident-specific zones through the site safety plan and monitoring.", "Page 2 — Exposure Guidelines; Page 3 — Site Controls", "Requires SME Review", "No fixed standoff distance is supplied."),
    fact("DECON", "Personnel contamination control", "Personnel decontamination must use source-appropriate PPE, avoid skin abrasion, contain generated waste, and follow the incident-specific decontamination and waste-management plans.", "Pages 4–6 — Personnel Decontamination"),
    fact("MEDICAL", "Medical and public-health coordination", "Monitor exposed personnel for illness and obtain prompt medical attention; early diagnosis and treatment materially affect outcomes.", "Pages 2–3 — Health Effects and Personnel Monitoring", "Requires SME Review", "Medical actions require public-health and medical direction."),
    fact("TECHNICAL_OPERATIONS", "Unified sampling operations", "Coordinate law-enforcement, public-health, laboratory, evidence, sample-handling, and waste-management requirements before field sampling or cleanup work.", "Pages 6–8 — Environmental Sampling and Analysis"),
  ],
};

const radiologicalPpeFacts = (): CbrneImportSourceFact[] => [
  fact("HAZARDS", "Penetrating radiation limitation", "Protective clothing does not shield high-energy penetrating radiation; reduce exposure by limiting time, increasing distance, and using appropriate shielding.", "Radiation PPE — Recommended PPE and practices"),
  fact("PPE", "PPE and dosimetry", "Incident command or the on-scene safety official selects PPE for the identified hazards; responders should use personal radiation dosimetry and contamination-control practices.", "Radiation PPE — Important considerations; External Decontamination — Protecting Responding Personnel", "Requires SME Review", "PPE is not represented as shielding and this fact does not select a response level."),
];

const radiologicalSurveyFacts = (): CbrneImportSourceFact[] => [
  fact("RADIOLOGICAL_SURVEY", "Contamination survey", "Check the instrument, perform operational and background checks, survey systematically, and document initial and follow-up results with consistent geometry.", "Brief instructions for conducting a contamination survey"),
  fact("TECHNICAL_OPERATIONS", "Survey documentation", "Record the instrument, background, survey locations, geometry, readings, and time so initial and follow-up survey results can be compared.", "Brief instructions and survey documentation"),
];

const radiologicalDeconFacts = (): CbrneImportSourceFact[] => [
  fact("DECON", "External contamination reduction", "Carefully remove and secure clothing, survey the patient, use tepid water with mild soap when washing is needed, and avoid aggressive scrubbing that damages skin.", "Gross whole-body contamination"),
  fact("MEDICAL", "Contaminated wounds and foreign material", "Use survey support for contaminated wounds or suspected radioactive foreign material and obtain expert medical and health-physics advice for further management.", "Radioactive shrapnel and open wounds", "Requires SME Review", "No isotope-specific treatment or countermeasure is inferred."),
];

const radiologicalIdentities = [
  { displayName: "Cesium-137", domain: "RADIOLOGICAL" as const, category: "RADIONUCLIDE" as const, radionuclideSymbol: "Cs-137", isotopeMassNumber: 137 },
  { displayName: "Cobalt-60", domain: "RADIOLOGICAL" as const, category: "RADIONUCLIDE" as const, radionuclideSymbol: "Co-60", isotopeMassNumber: 60 },
  { displayName: "Iridium-192", domain: "RADIOLOGICAL" as const, category: "RADIONUCLIDE" as const, radionuclideSymbol: "Ir-192", isotopeMassNumber: 192 },
  { displayName: "Radiological Dispersal Device", domain: "CBRNE_SCENARIO" as const, category: "RADIOLOGICAL_DISPERSAL_DEVICE" as const, aliases: ["RDD", "Dirty Bomb"] },
];

const radiologicalRecords = (facts: () => CbrneImportSourceFact[]): CbrneImportRecord[] => radiologicalIdentities.map((record) => ({ ...record, sourceFacts: facts() }));

const pagRecords: CbrneImportRecord[] = radiologicalRecords(() => [fact(
    "PROTECTIVE_ACTION",
    "Incident-specific protective actions",
    "Use projected dose, field measurements, incident conditions, and current authority guidance to select protective actions; recommendations may change as better information becomes available.",
    "PAG Manual overview; Protective Actions and PAGs",
    "Requires SME Review",
    "This source fact provides a decision framework and no universal distance or dose-rate value.",
  )]);

const nndcIdentityRecords: CbrneImportRecord[] = [
  ["Cesium-137", "Cs-137", 137],
  ["Cobalt-60", "Co-60", 60],
  ["Iridium-192", "Ir-192", 192],
].map(([displayName, radionuclideSymbol, isotopeMassNumber]) => ({
  displayName: String(displayName),
  domain: "RADIOLOGICAL" as const,
  category: "RADIONUCLIDE" as const,
  radionuclideSymbol: String(radionuclideSymbol),
  isotopeMassNumber: Number(isotopeMassNumber),
  sourceFacts: [fact("IDENTITY", "Nuclide identity", `${displayName} is the radionuclide identified as ${radionuclideSymbol}, with mass number ${isotopeMassNumber}.`, `NuDat nucleus record: ${String(radionuclideSymbol).replace("-", "")}`, "Source Imported", "Identity only; no dose, standoff, shielding, or medical value is inferred.")],
}));

export const CBRNE_MANUAL_SOURCE_PACKS: readonly CbrneImportPackage[] = [
  {
    packageId: "nrt-anthrax-qrg-2022",
    packageName: "NRT Anthrax QRG responder facts",
    sourceRegistryId: "NRT_ANTHRAX_QRG",
    sourceName: "NRT Quick Reference Guide: Bacillus anthracis / Anthrax",
    sourceDocumentTitle: "NRT Quick Reference Guide: Bacillus anthracis (causes Anthrax)",
    sourceUrl: "https://nrt.response.epa.gov/sites/2/files/NRT%20CBRN%20BIO%20UPDATE%20Anthrax%20QRG_FINAL%202022%2002%2016.pdf",
    sourceDate: "2022-02-16",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: [anthraxRecord],
  },
  {
    packageId: "niosh-ersh-vx-card",
    packageName: "NIOSH ERSH-DB VX responder facts",
    sourceRegistryId: "NIOSH_ERSH_DB",
    sourceName: "NIOSH Emergency Response Safety and Health Database",
    sourceDocumentTitle: "VX: Nerve Agent — Emergency Response Safety and Health Database",
    sourceUrl: "https://www.cdc.gov/niosh/ershdb/emergencyresponsecard_29750005.html",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: [{ displayName: "VX", domain: "CHEMICAL_WARFARE", category: "NERVE_AGENT", aliases: ["VX nerve agent"], agentCodes: ["VX"], cas: ["50782-69-9"], unNaNumbers: ["2810"], sourceFacts: nioshNerveAgentFacts("VX") }],
  },
  {
    packageId: "niosh-ersh-sarin-card",
    packageName: "NIOSH ERSH-DB Sarin responder facts",
    sourceRegistryId: "NIOSH_ERSH_DB",
    sourceName: "NIOSH Emergency Response Safety and Health Database",
    sourceDocumentTitle: "Sarin (GB): Nerve Agent — Emergency Response Safety and Health Database",
    sourceUrl: "https://www.cdc.gov/niosh/ershdb/emergencyresponsecard_29750001.html",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: [{ displayName: "Sarin", domain: "CHEMICAL_WARFARE", category: "NERVE_AGENT", aliases: ["Sarin"], agentCodes: ["GB"], cas: ["107-44-8"], unNaNumbers: ["2810"], sourceFacts: nioshNerveAgentFacts("Sarin (GB)") }],
  },
  {
    packageId: "niosh-ersh-sulfur-mustard-card",
    packageName: "NIOSH ERSH-DB Sulfur Mustard responder facts",
    sourceRegistryId: "NIOSH_ERSH_DB",
    sourceName: "NIOSH Emergency Response Safety and Health Database",
    sourceDocumentTitle: "Sulfur Mustard: Blister Agent — Emergency Response Safety and Health Database",
    sourceUrl: "https://www.cdc.gov/niosh/ershdb/emergencyresponsecard_29750008.html",
    sourceDate: "2011-05-12",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: [sulfurMustardRecord],
  },
  {
    packageId: "niosh-ersh-ricin-card",
    packageName: "NIOSH ERSH-DB Ricin responder facts",
    sourceRegistryId: "NIOSH_ERSH_DB",
    sourceName: "NIOSH Emergency Response Safety and Health Database",
    sourceDocumentTitle: "Ricin: Biotoxin — Emergency Response Safety and Health Database",
    sourceUrl: "https://www.cdc.gov/niosh/ershdb/emergencyresponsecard_29750002.html",
    sourceDate: "2011-05-12",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: [ricinResponderRecord],
  },
  {
    packageId: "chemm-nerve-agent-toxidrome",
    packageName: "CHEMM nerve-agent clinical recognition facts",
    sourceRegistryId: "CHEMM_NERVE_AGENTS",
    sourceName: "CHEMM Nerve Agents",
    sourceDocumentTitle: "Organophosphorus Pesticides and Nerve Agents — Cholinergic or Nerve Agent Toxidrome",
    sourceUrl: "https://chemm.hhs.gov/nerveagents.htm",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: ["VX", "Sarin"].map((displayName) => ({
      displayName,
      domain: "CHEMICAL_WARFARE" as const,
      category: "NERVE_AGENT" as const,
      agentCodes: [displayName === "Sarin" ? "GB" : "VX"],
      sourceFacts: [
        fact("SYMPTOMS", "Cholinergic toxidrome indicators", "Pinpoint pupils, secretions, sweating, breathing difficulty, muscle twitching, altered mental status, or seizures can support initial nerve-agent toxidrome recognition.", "Nerve Agents — signs and symptoms"),
        fact("MEDICAL", "Medical management context", "Prioritize airway and breathing support, decontamination when indicated, and protocol-directed antidote care under medical direction.", "Nerve Agents — Acute Patient Care Guidelines", "Requires SME Review", "No medication dose is stored in Hazard ID."),
      ],
    })),
  },
  {
    packageId: "opcw-schedule-1-identities",
    packageName: "OPCW Schedule 1 identity crosswalk",
    sourceRegistryId: "OPCW_SCHEDULE_1",
    sourceName: "OPCW Schedule 1 Chemicals",
    sourceDocumentTitle: "Chemical Weapons Convention Annex on Chemicals — Schedule 1",
    sourceUrl: "https://www.opcw.org/chemical-weapons-convention/annexes/annex-chemicals/schedule-1",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Source Imported",
    records: [
      { displayName: "Sarin", domain: "CHEMICAL_WARFARE", category: "NERVE_AGENT", agentCodes: ["GB"], cas: ["107-44-8"], sourceFacts: [fact("IDENTITY", "OPCW classification", "Sarin (CAS 107-44-8) is listed in Schedule 1 of the Chemical Weapons Convention Annex on Chemicals.", "Schedule 1, item 1", "Source Imported")] },
      { displayName: "VX", domain: "CHEMICAL_WARFARE", category: "NERVE_AGENT", agentCodes: ["VX"], cas: ["50782-69-9"], sourceFacts: [fact("IDENTITY", "OPCW classification", "VX (CAS 50782-69-9) is listed in Schedule 1 of the Chemical Weapons Convention Annex on Chemicals.", "Schedule 1, item 3", "Source Imported")] },
      { displayName: "Sulfur Mustard", domain: "CHEMICAL_WARFARE", category: "BLISTER_AGENT", aliases: ["Mustard gas"], agentCodes: ["HD"], cas: ["505-60-2"], sourceFacts: [fact("IDENTITY", "OPCW classification", "Mustard gas, bis(2-chloroethyl)sulfide (CAS 505-60-2), is listed among Schedule 1 sulfur mustards.", "Schedule 1, item 4", "Source Imported")] },
      { displayName: "Ricin", domain: "BIOLOGICAL", category: "BIOLOGICAL_TOXIN", aliases: ["Ricin toxin"], cas: ["9009-86-3"], sourceFacts: [fact("IDENTITY", "OPCW classification", "Ricin (CAS 9009-86-3) is listed in Schedule 1 of the Chemical Weapons Convention Annex on Chemicals.", "Schedule 1, item 8", "Source Imported")] },
    ],
  },
  {
    packageId: "remm-radiation-ppe",
    packageName: "REMM radiological PPE and exposure limitations",
    sourceRegistryId: "REMM_RADIATION_PPE",
    sourceName: "REMM PPE in a Radiation Emergency",
    sourceDocumentTitle: "Personal Protective Equipment (PPE) in a Radiation Emergency",
    sourceUrl: "https://remm.hhs.gov/radiation_ppe.htm",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: radiologicalRecords(radiologicalPpeFacts),
  },
  {
    packageId: "remm-radiation-survey",
    packageName: "REMM radiation contamination survey facts",
    sourceRegistryId: "REMM_SURVEY",
    sourceName: "REMM Radiation Contamination Survey",
    sourceDocumentTitle: "How to Perform a Survey for Radiation Contamination",
    sourceUrl: "https://www.remm.hhs.gov/howtosurvey.htm",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: radiologicalRecords(radiologicalSurveyFacts),
  },
  {
    packageId: "remm-external-contamination-decon",
    packageName: "REMM external contamination and decon facts",
    sourceRegistryId: "REMM_DECON",
    sourceName: "REMM External Contamination / Decontamination",
    sourceDocumentTitle: "Procedures for Radiation Decontamination",
    sourceUrl: "https://remm.hhs.gov/ext_contamination.htm",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: radiologicalRecords(radiologicalDeconFacts),
  },
  {
    packageId: "epa-pag-response-framework",
    packageName: "EPA radiological protective-action framework",
    sourceRegistryId: "EPA_PAG",
    sourceName: "EPA Protective Action Guides for Radiological Incidents",
    sourceDocumentTitle: "Protective Action Guides (PAGs)",
    sourceUrl: "https://www.epa.gov/radiation/protective-action-guides-pags",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Requires SME Review",
    records: pagRecords,
  },
  {
    packageId: "nndc-priority-nuclide-identities",
    packageName: "NNDC NuDat priority nuclide identities",
    sourceRegistryId: "NNDC_NUDAT",
    sourceName: "NNDC NuDat",
    sourceDocumentTitle: "NuDat 3 — Evaluated Nuclear Structure and Decay Data",
    sourceUrl: "https://www.nndc.bnl.gov/nudat3/",
    importedAt: IMPORTED_AT,
    importedBy: "Manual",
    reviewStatus: "Source Imported",
    records: nndcIdentityRecords,
  },
];

export const CBRNE_SOURCE_PACK_WARNINGS = [
  "Sulfur Mustard and Ricin responder facts are source-imported from NIOSH ERSH-DB and require SME review; OPCW remains identity/classification only.",
  "No isotope half-life, emission, dose-rate, or standoff values were imported in this pass; NuDat facts are identity-only.",
] as const;
