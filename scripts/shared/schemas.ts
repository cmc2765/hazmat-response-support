// Shared Zod schemas live in /src/lib/schema so scripts and the app share validation.
// This file re-exports the canonical schemas and provides a normalizer interface
// for data-pipeline scripts.

export {
  Chemical,
  NPGRecord,
  Facility,
  FacilityChemical,
  SourceRef,
  PlumeInputs,
  PlumeRun,
  PlumeResult,
  Isopleth,
  CenterlinePoint,
  Observation,
  Reading,
  SensorReading,
  IntegrationConfig,
} from "../src/lib/schema/index.js";

export const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/;
