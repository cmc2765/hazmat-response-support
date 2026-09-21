import type { CbrneMasterRecord } from "../../../lib/cbrne/cbrneTypes.js";

export type CanonicalRecordCandidate = {
  candidateId: string;
  namespace: "CWA_CHEMICAL" | "BIOLOGICAL";
  displayName: string;
  scientificName: string | null;
  cas: string[];
  sourceArtifactIds: string[];
  disposition: "CANONICAL_RECORD_CREATED" | "REQUIRES_IDENTITY_REVIEW" | "REQUIRES_MANUAL_ARTIFACT";
  reason: string;
};

export const CBRNE_CANONICAL_RECORD_CANDIDATES: readonly CanonicalRecordCandidate[] = Object.freeze([
  { candidateId: "ammonia", namespace: "CWA_CHEMICAL", displayName: "Ammonia", scientificName: null, cas: ["7664-41-7"], sourceArtifactIds: ["nrt-qrg-chemical-ammonia"], disposition: "CANONICAL_RECORD_CREATED", reason: "Current EPA/NRT QRG provides an unambiguous chemical identity absent from the starter 43." },
  { candidateId: "cyanide-salts", namespace: "CWA_CHEMICAL", displayName: "Cyanide Salts", scientificName: null, cas: [], sourceArtifactIds: ["nrt-qrg-chemical-cyanide-salts"], disposition: "REQUIRES_IDENTITY_REVIEW", reason: "The QRG covers a chemical family; individual salts require separate CAS-scoped identities." },
  { candidateId: "hydrogen-sulfide", namespace: "CWA_CHEMICAL", displayName: "Hydrogen Sulfide", scientificName: null, cas: ["7783-06-4"], sourceArtifactIds: ["nrt-qrg-chemical-hydrogen-sulfide"], disposition: "CANONICAL_RECORD_CREATED", reason: "Current EPA/NRT QRG provides an unambiguous chemical identity absent from the starter 43." },
  { candidateId: "methyl-isocyanate", namespace: "CWA_CHEMICAL", displayName: "Methyl Isocyanate", scientificName: null, cas: ["624-83-9"], sourceArtifactIds: ["nrt-qrg-chemical-methyl-isocyanate"], disposition: "REQUIRES_MANUAL_ARTIFACT", reason: "The official index identifies the record, but its current PDF URL returns a JPEG placeholder." },
  { candidateId: "organothiophosphate-pesticides", namespace: "CWA_CHEMICAL", displayName: "Organothiophosphate Pesticides", scientificName: null, cas: [], sourceArtifactIds: ["nrt-qrg-chemical-organothiophosphate-pesticides"], disposition: "REQUIRES_IDENTITY_REVIEW", reason: "The QRG is a response family, not a single chemical identity." },
  { candidateId: "phosphine", namespace: "CWA_CHEMICAL", displayName: "Phosphine", scientificName: null, cas: ["7803-51-2"], sourceArtifactIds: ["nrt-qrg-chemical-phosphine"], disposition: "CANONICAL_RECORD_CREATED", reason: "Current EPA/NRT QRG provides an unambiguous chemical identity absent from the starter 43." },
  { candidateId: "fentanyl", namespace: "CWA_CHEMICAL", displayName: "Fentanyl", scientificName: null, cas: ["437-38-7"], sourceArtifactIds: ["nrt-qrg-chemical-fentanyl"], disposition: "CANONICAL_RECORD_CREATED", reason: "Current EPA/NRT QRG provides an unambiguous chemical identity absent from the starter 43." },
  { candidateId: "tets", namespace: "CWA_CHEMICAL", displayName: "Tetramethylenedisulfotetramine", scientificName: null, cas: ["80-12-6"], sourceArtifactIds: ["nrt-qrg-chemical-tets"], disposition: "CANONICAL_RECORD_CREATED", reason: "Current EPA/NRT QRG provides an unambiguous chemical identity absent from the starter 43." },
  { candidateId: "glanders", namespace: "BIOLOGICAL", displayName: "Glanders", scientificName: "Burkholderia mallei", cas: [], sourceArtifactIds: ["nrt-qrg-biological-glanders-melioidosis"], disposition: "CANONICAL_RECORD_CREATED", reason: "The combined QRG distinguishes this disease and organism." },
  { candidateId: "melioidosis", namespace: "BIOLOGICAL", displayName: "Melioidosis", scientificName: "Burkholderia pseudomallei", cas: [], sourceArtifactIds: ["nrt-qrg-biological-glanders-melioidosis"], disposition: "CANONICAL_RECORD_CREATED", reason: "The combined QRG distinguishes this disease and organism." },
  { candidateId: "hantavirus-pulmonary-syndrome", namespace: "BIOLOGICAL", displayName: "Hantavirus Pulmonary Syndrome", scientificName: "Orthohantavirus", cas: [], sourceArtifactIds: ["nrt-qrg-biological-hantavirus"], disposition: "CANONICAL_RECORD_CREATED", reason: "Current EPA/NRT QRG provides an authoritative candidate absent from the starter 43." },
  { candidateId: "tick-borne-encephalitis", namespace: "BIOLOGICAL", displayName: "Tick-Borne Encephalitis", scientificName: "Tick-borne encephalitis virus", cas: [], sourceArtifactIds: ["nrt-qrg-biological-tick-borne-encephalitis"], disposition: "REQUIRES_MANUAL_ARTIFACT", reason: "The EPA index lists the QRG but no child PDF is currently exposed by NRT." },
]);

const CREATED_AT = "2026-09-10T00:00:00.000Z";

export const CBRNE_ADDITIONAL_CANONICAL_RECORDS: readonly CbrneMasterRecord[] = Object.freeze(CBRNE_CANONICAL_RECORD_CANDIDATES
  .filter((candidate) => candidate.disposition === "CANONICAL_RECORD_CREATED")
  .map((candidate) => ({
    id: candidate.candidateId,
    domain: candidate.namespace === "BIOLOGICAL" ? "BIOLOGICAL" as const : "CHEMICAL_WARFARE" as const,
    category: candidate.namespace === "BIOLOGICAL"
      ? candidate.candidateId === "hantavirus-pulmonary-syndrome" ? "VIRAL_AGENT" as const : "BACTERIAL_AGENT" as const
      : "TOXIC_INDUSTRIAL_CHEMICAL" as const,
    displayName: candidate.displayName,
    scientificName: candidate.scientificName ?? undefined,
    commonNames: [],
    aliases: [],
    cas: candidate.cas,
    verificationStatus: "Requires SME Review" as const,
    sourceFactIds: [`candidate-authoritative-identity-${candidate.candidateId}`],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  })));
