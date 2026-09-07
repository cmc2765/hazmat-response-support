export type PrePlanType =
  | 'Facility Pre-Plan' | 'HazMat Facility Pre-Plan' | 'Pipeline Incident Pre-Plan'
  | 'Special Event Pre-Plan' | 'Disaster / Large-Scale Incident Pre-Plan'
  | 'School / Public Assembly Pre-Plan' | 'Healthcare / Nursing Home Pre-Plan'
  | 'Industrial / Manufacturing Pre-Plan';

export type PrePlanStatus = 'Draft' | 'Ready for Review' | 'Approved' | 'Archived';

export type PrePlanRecord = {
  id: string;
  planType: PrePlanType;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
  status: PrePlanStatus;
  facility: Record<string, string>;
  contacts: string[];
  access: string;
  utilities: string;
  fireProtection: string;
  waterSupply: string;
  hazards: string;
  hazmatOperations: string;
  mapPlanning: string;
  eventPlanning?: string;
  pipelinePlanning?: string;
  resources: string[];
  attachments: string[];
  notes: string[];
};
