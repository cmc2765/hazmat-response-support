import { z } from "zod";

const ErgTableRow = z.object({
  un: z.string(),
  name: z.string(),
  guide: z.string(),
  smallInitialIsoFt: z.number().nonnegative(),
  smallProtectiveFt: z.number().nonnegative(),
  largeInitialIsoFt: z.number().nonnegative(),
  largeProtectiveFt: z.number().nonnegative(),
  day: z.boolean(),
});

export type ErgTableRow = z.infer<typeof ErgTableRow>;

export interface ErgQueryInputs {
  un: string;
  isLarge: boolean;
  isDay: boolean;
  windMph: number;
}

export function lookupErgRow(rows: ErgTableRow[], q: ErgQueryInputs): ErgTableRow | null {
  const match = rows.find((r) => r.un === q.un);
  return match ?? null;
}

export interface ThreatZoneEstimate {
  source: "erg-table-1";
  initialIsolationFt: number;
  protectiveActionFt: number;
  dayNight: "day" | "night";
  size: "small" | "large";
  notes: string[];
}

export function estimateThreatZone(row: ErgTableRow | null, q: ErgQueryInputs): ThreatZoneEstimate | null {
  if (!row) return null;
  const day = q.isDay ? "day" : "night";
  const size = q.isLarge ? "large" : "small";
  const rowDay = row.day;
  const initialIso = rowDay
    ? q.isLarge ? row.largeInitialIsoFt : row.smallInitialIsoFt
    : q.isLarge ? Math.round(row.largeInitialIsoFt * 1.5) : Math.round(row.smallInitialIsoFt * 1.5);
  const protective = rowDay
    ? q.isLarge ? row.largeProtectiveFt : row.smallProtectiveFt
    : q.isLarge ? Math.round(row.largeProtectiveFt * 1.5) : Math.round(row.smallProtectiveFt * 1.5);
  const notes = [
    `ERG ${row.guide} for UN ${row.un}.`,
    `${day} release, ${size} quantity, wind ${q.windMph} mph.`,
    "Initial isolation and protective action distances derived from ERG Table 1 / Table 3. Verify against the current ERG before field use.",
  ];
  return {
    source: "erg-table-1",
    initialIsolationFt: initialIso,
    protectiveActionFt: protective,
    dayNight: day,
    size,
    notes,
  };
}
