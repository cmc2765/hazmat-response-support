export const PUBLIC_RELEASE_SECURITY_CONTROLS = [
  "authentication",
  "role-authorization",
  "tenant-isolation",
  "encryption-in-transit",
  "encryption-at-rest",
  "secret-management",
  "immutable-audit",
  "retention-deletion",
  "backup-restore-test",
  "protected-data-policy",
] as const;

export type PublicReleaseSecurityControl = typeof PUBLIC_RELEASE_SECURITY_CONTROLS[number];

export interface SecurityControlEvidence {
  control: PublicReleaseSecurityControl;
  status: "passed" | "failed" | "not-tested";
  evidence: string[];
  approvedBy: string | null;
  approvedAt: string | null;
}

export function evaluatePublicReleaseSecurity(records: SecurityControlEvidence[]) {
  const byControl = new Map(records.map((record) => [record.control, record]));
  const blockers = PUBLIC_RELEASE_SECURITY_CONTROLS.flatMap((control) => {
    const record = byControl.get(control);
    return !record || record.status !== "passed" || !record.evidence.length || !record.approvedBy || !record.approvedAt
      ? [`${control} is not evidenced and approved.`]
      : [];
  });
  return { releaseReady: blockers.length === 0, blockers };
}
