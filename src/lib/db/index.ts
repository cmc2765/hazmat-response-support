import Dexie, { type Table } from "dexie";
import type {
  Chemical,
  NPGRecord,
  Facility,
  Incident,
  PrePlan,
  PlumeRun,
  IntegrationConfig,
  Reading,
  Observation,
} from "@/lib/schema";

export interface FavoriteRow {
  id: string;
  kind: "chemical" | "npg" | "facility";
  createdAt: string;
}

export class HazmatDB extends Dexie {
  chemicals!: Table<Chemical, string>;
  npg!: Table<NPGRecord, string>;
  facilities!: Table<Facility, string>;
  incidents!: Table<Incident, string>;
  preplans!: Table<PrePlan, string>;
  plumeRuns!: Table<PlumeRun, string>;
  integrations!: Table<IntegrationConfig, string>;
  readings!: Table<Reading, string>;
  observations!: Table<Observation, string>;
  favorites!: Table<FavoriteRow, string>;

  constructor() {
    super("hazmat-response-support");
    this.version(1).stores({
      chemicals: "id, name, *un, *na, *cas",
      npg: "id, name, cas",
      facilities: "id, name, dunn, *chemicals.chemicalId",
      incidents: "id, openedAt, closedAt",
      preplans: "id, facilityId, updatedAt",
      plumeRuns: "id, incidentId, createdAt",
      integrations: "id, kind, enabled",
      readings: "[source+monitorId+ts], source, ts, monitorId",
      observations: "[source+ts], source, ts",
      favorites: "id, kind",
    });
  }
}

export const db = new HazmatDB();
