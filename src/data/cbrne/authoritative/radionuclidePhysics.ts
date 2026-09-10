import physics from "./generated-radionuclide-physics.json";

export type EvaluatedDecayMode = {
  decayMode: string;
  daughterCanonicalNuclideId: string | null;
  daughterNndcName: string | null;
  qValue: number | null;
  qValueUnits: string | null;
  datasetId: number | null;
  datasetName: string | null;
  evaluationCutoffDate: string | null;
};

export type RadionuclidePhysicsRecord = {
  canonicalRecordId: string;
  namespace: "RADIONUCLIDE";
  canonicalNuclideId: string;
  element: string;
  elementSymbol: string;
  atomicNumber: number;
  neutronNumber: number;
  massNumber: number;
  metastableState: string | null;
  nndcName: string;
  nndcNuclideId: number;
  stability: "STABLE" | "RADIOACTIVE";
  halfLifeOriginal: string | null;
  halfLifeValue: number | null;
  halfLifeUnits: string | null;
  halfLifeSeconds: number | null;
  halfLifeUncertainty: unknown;
  decayModes: EvaluatedDecayMode[];
  branchingInformation: Record<string, unknown>;
  adoptedDataset: {
    datasetId: number | null;
    datasetName: string | null;
    evaluationCutoffDate: string | null;
  };
  sourceArtifacts: string[];
  sourceApi: "ENSDF";
  reviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW";
  limitations: string[];
};

export const RADIONUCLIDE_PHYSICS_RECORDS: readonly RadionuclidePhysicsRecord[] = Object.freeze(physics as RadionuclidePhysicsRecord[]);

export function findRadionuclidePhysicsRecord(canonicalRecordId: string) {
  return RADIONUCLIDE_PHYSICS_RECORDS.find((record) => record.canonicalRecordId === canonicalRecordId) ?? null;
}
