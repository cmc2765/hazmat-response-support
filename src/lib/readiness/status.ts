export const GO_READINESS_STATUS = {
  VERIFIED_SOURCE: "Verified Source",
  IMPORTED_SOURCE: "Imported Source",
  PLANNING_ESTIMATE: "Planning Estimate",
  MANUAL_ENTRY: "Manual Entry",
  NEEDS_VERIFICATION: "Needs Verification",
  NO_CURRENT_DATA_EXISTS: "No Current Data Exists",
  BLOCKED_PENDING_VALIDATION: "Blocked Pending Validation",
} as const;

export type GoReadinessStatus = typeof GO_READINESS_STATUS[keyof typeof GO_READINESS_STATUS];

const statusValues = new Set<GoReadinessStatus>(Object.values(GO_READINESS_STATUS));

export function isGoReadinessStatus(value: unknown): value is GoReadinessStatus {
  return typeof value === "string" && statusValues.has(value as GoReadinessStatus);
}

export interface SourceStatus<T = unknown> {
  status: GoReadinessStatus;
  value?: T;
  source?: string;
  observedAt?: string;
  note?: string;
}

export function sourceStatus<T>(status: GoReadinessStatus, fields: Omit<SourceStatus<T>, "status"> = {}): SourceStatus<T> {
  return { status, ...fields };
}
