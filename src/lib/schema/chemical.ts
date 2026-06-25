import { z } from "zod";

export const SourceRef = z.object({
  source: z.string(),
  id: z.string().optional(),
  url: z.string().url().optional(),
  lastReviewed: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

export const Chemical = z.object({
  id: z.string(),
  un: z.array(z.string()).optional(),
  na: z.array(z.string()).optional(),
  cas: z.array(z.string()).optional(),
  name: z.string(),
  synonyms: z.array(z.string()).default([]),
  hazardClass: z.array(z.string()).default([]),
  packingGroup: z.array(z.enum(["I", "II", "III"])).default([]),
  ergGuide: z.string().optional(),
  placard: z.string().optional(),
  ppe: z.array(z.string()).default([]),
  isolation: z.object({
    initial: z.string().optional(),
    protective: z.string().optional(),
  }).default({}),
  firstAid: z.array(z.string()).default([]),
  reactivity: z.array(z.string()).default([]),
  incompatibilities: z.array(z.string()).default([]),
  sdsUrl: z.string().url().optional(),
  sources: z.array(SourceRef).default([]),
});
export type Chemical = z.infer<typeof Chemical>;

export const NPGRecord = z.object({
  id: z.string(),
  name: z.string(),
  synonyms: z.array(z.string()).default([]),
  cas: z.string().optional(),
  rtecs: z.string().optional(),
  formula: z.string().optional(),
  exposureLimits: z.object({
    pel: z.string().optional(),
    rel: z.string().optional(),
    idlh: z.string().optional(),
    aegl: z.tuple([z.string().optional(), z.string().optional(), z.string().optional()]).optional(),
    erpg: z.tuple([z.string().optional(), z.string().optional(), z.string().optional()]).optional(),
    teel: z.tuple([z.string().optional(), z.string().optional(), z.string().optional(), z.string().optional()]).optional(),
  }).default({}),
  physical: z.object({
    mw: z.string().optional(),
    mp: z.string().optional(),
    bp: z.string().optional(),
    vpMmHg: z.string().optional(),
    sg: z.string().optional(),
    flPt: z.string().optional(),
    uel: z.string().optional(),
    lel: z.string().optional(),
  }).default({}),
  health: z.object({
    symptoms: z.array(z.string()).default([]),
    targetOrgans: z.array(z.string()).default([]),
    firstAid: z.array(z.string()).default([]),
    respiratorSelection: z.array(z.string()).default([]),
  }).default({}),
  ppe: z.object({
    skin: z.array(z.string()).default([]),
    eye: z.array(z.string()).default([]),
    respiratory: z.array(z.string()).default([]),
  }).default({}),
  reactivity: z.object({
    incompatibilities: z.array(z.string()).default([]),
    waterReactive: z.boolean().default(false),
  }).default({}),
  sources: z.array(SourceRef).default([]),
});
export type NPGRecord = z.infer<typeof NPGRecord>;

export const FacilityChemical = z.object({
  chemicalId: z.string(),
  maxDailyAmount: z.object({
    value: z.number(),
    unit: z.string(),
  }),
  container: z.string().optional(),
  conditions: z.string().optional(),
  lastReportedYear: z.number().int(),
});
export type FacilityChemical = z.infer<typeof FacilityChemical>;

export const Facility = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  dunn: z.string().optional(),
  ehsFlag: z.boolean().default(false),
  chemicals: z.array(FacilityChemical).default([]),
  source: z.string(),
  lastUpdated: z.string(),
});
export type Facility = z.infer<typeof Facility>;
