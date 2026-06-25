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
