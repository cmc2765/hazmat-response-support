export interface CertificationTarget {
  id: string;
  status: "passed" | "failed" | "not-tested" | "blocked";
  evidence: string[];
  approvedBy: string | null;
  approvedAt: string | null;
}

export function evaluateCertificationTargets(requiredIds: readonly string[], targets: CertificationTarget[]) {
  const byId = new Map(targets.map((target) => [target.id, target]));
  const blockers = requiredIds.flatMap((id) => {
    const target = byId.get(id);
    return !target || target.status !== "passed" || !target.evidence.length || !target.approvedBy || !target.approvedAt
      ? [`${id} has not passed attributable acceptance.`]
      : [];
  });
  return { releaseReady: blockers.length === 0, blockers };
}
