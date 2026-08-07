export interface FlatErgEntryLike {
  un: string;
  name: string;
  guide: string;
  smallInitialDayFt: number;
  smallProtectiveDayMi: number;
  largeInitialDayFt: number;
  largeProtectiveDayMi: number;
}

export function evaluateFlatErgRelease(
  entries: FlatErgEntryLike[],
  availableGuides: ReadonlySet<string>,
  approvals: { sourceReconciled: boolean; normalizedCutoverApproved: boolean },
) {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.un}:${entry.name}`;
    if (keys.has(key)) errors.push(`Duplicate flat ERG entry ${key}.`);
    keys.add(key);
    if (!/^\d{4}$/.test(entry.un)) errors.push(`${key} has an invalid UN/NA identifier.`);
    if (!/^\d{3}P?$/.test(entry.guide)) errors.push(`${key} has an invalid guide number.`);
    const baseGuide = entry.guide.replace(/P$/, "");
    if (!availableGuides.has(baseGuide)) errors.push(`${key} references unavailable guide ${entry.guide}.`);
    for (const value of [entry.smallInitialDayFt, entry.smallProtectiveDayMi, entry.largeInitialDayFt, entry.largeProtectiveDayMi]) {
      if (!Number.isFinite(value) || value < 0) errors.push(`${key} has an invalid required distance.`);
    }
  }
  const blockers = [
    ...(!approvals.sourceReconciled ? ["ERG source coverage and transcription are not reconciled."] : []),
    ...(!approvals.normalizedCutoverApproved ? ["Normalized schema cutover is not approved; retain the flat production path."] : []),
  ];
  return { structurallyValid: errors.length === 0, releaseReady: errors.length === 0 && blockers.length === 0, errors, blockers };
}
