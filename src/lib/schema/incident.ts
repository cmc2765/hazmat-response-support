import { z } from "zod";

export const TimelineEventType = z.enum([
  "arrival",
  "sizeup",
  "action",
  "reading",
  "observation",
  "comms",
  "note",
  "closeout",
]);
export type TimelineEventType = z.infer<typeof TimelineEventType>;

export const TimelineEvent = z.object({
  id: z.string(),
  ts: z.string(),
  type: TimelineEventType,
  actor: z.string().optional(),
  note: z.string().optional(),
  refId: z.string().optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

export const ActionRecord = z.object({
  id: z.string(),
  ts: z.string(),
  label: z.string(),
  details: z.string().optional(),
  units: z.array(z.string()).default([]),
});
export type ActionRecord = z.infer<typeof ActionRecord>;

export const Exposure = z.object({
  id: z.string(),
  ts: z.string(),
  person: z.string(),
  agent: z.string(),
  durationSec: z.number().int().nonnegative(),
  notes: z.string().optional(),
});
export type Exposure = z.infer<typeof Exposure>;

export const Incident = z.object({
  id: z.string(),
  openedAt: z.string(),
  closedAt: z.string().optional(),
  facilityId: z.string().optional(),
  chemicalId: z.string().optional(),
  weatherSource: z.string().optional(),
  timeline: z.array(TimelineEvent).default([]),
  actions: z.array(ActionRecord).default([]),
  exposures: z.array(Exposure).default([]),
  units: z.array(z.string()).default([]),
  notes: z.string().optional(),
  modelVersion: z.string().optional(),
});
export type Incident = z.infer<typeof Incident>;

const ReadinessStatus = z.enum([
  "Verified Source",
  "Imported Source",
  "Planning Estimate",
  "Manual Entry",
  "Needs Verification",
  "No Current Data Exists",
  "Blocked Pending Validation",
]);

const SourceReference = z.object({
  sourceId: z.string().min(1),
  revision: z.string().min(1),
  checksum: z.string().min(1).nullable(),
  locator: z.string().min(1),
});

const Measurement = z.object({
  value: z.number(),
  unit: z.string().min(1),
  status: ReadinessStatus,
  source: SourceReference.nullable(),
});

export const IncidentExportV1 = z.object({
  schemaVersion: z.literal("1.0.0"),
  exportId: z.string().min(1),
  generatedAt: z.string().datetime(),
  incident: z.object({
    id: z.string().min(1),
    openedAt: z.string().datetime(),
    closedAt: z.string().datetime().nullable(),
    actorId: z.string().min(1),
    deviceId: z.string().min(1),
    revision: z.number().int().positive(),
    classification: z.enum(["public", "operational-sensitive", "protected"]),
    retentionPolicyId: z.string().min(1),
  }),
  chemical: z.object({
    chemicalId: z.string().min(1),
    name: z.string().min(1),
    cas: z.string().nullable(),
    unNa: z.string().nullable(),
    ergGuide: z.string().nullable(),
    status: ReadinessStatus,
    source: SourceReference,
  }).nullable(),
  weather: z.object({
    observedAt: z.string().datetime().nullable(),
    status: ReadinessStatus,
    windSpeed: Measurement,
    windDirection: Measurement,
    temperature: Measurement,
  }).nullable(),
  plume: z.object({
    modelId: z.string().min(1),
    modelVersion: z.string().min(1),
    status: z.literal("Planning Estimate"),
    generatedAt: z.string().datetime(),
    maximumDownwind: Measurement,
    limitations: z.array(z.string().min(1)).min(1),
  }).nullable(),
  guidance: z.array(z.object({
    kind: z.enum(["ppe", "suit-compatibility", "medical", "protective-action"]),
    status: ReadinessStatus,
    text: z.string().min(1),
    source: SourceReference.nullable(),
    reviewState: z.enum(["approved", "requires-review", "blocked"]),
  })),
  auditHistory: z.array(z.object({
    sequence: z.number().int().positive(),
    at: z.string().datetime(),
    actorId: z.string().min(1),
    deviceId: z.string().min(1),
    action: z.string().min(1),
    previousRevision: z.number().int().nonnegative(),
    resultingRevision: z.number().int().positive(),
  })).min(1),
  disclaimers: z.array(z.string().min(1)).min(1),
  attachments: z.array(z.object({ id: z.string(), fileName: z.string(), sha256: z.string(), mediaType: z.string() })),
  reportsMappings: z.array(z.object({ target: z.string().min(1), field: z.string().min(1), valuePath: z.string().min(1) })),
});
export type IncidentExportV1 = z.infer<typeof IncidentExportV1>;

export const PrePlan = z.object({
  id: z.string(),
  facilityId: z.string(),
  hydrants: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    note: z.string().optional(),
  })).default([]),
  access: z.string().optional(),
  contacts: z.array(z.object({
    role: z.string(),
    name: z.string().optional(),
    phone: z.string().optional(),
  })).default([]),
  notes: z.string().optional(),
  updatedAt: z.string(),
});
export type PrePlan = z.infer<typeof PrePlan>;
