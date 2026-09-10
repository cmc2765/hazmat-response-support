import type { AuthoritativeSourceFact } from "./authoritativeSourceTypes.js";

export type AuthoritativeFactConflict = {
  canonicalRecordId: string;
  fieldGroup: AuthoritativeSourceFact["fieldGroup"];
  field: string;
  units: string | null;
  factIds: string[];
  values: Array<AuthoritativeSourceFact["value"]>;
};

function comparisonValue(value: AuthoritativeSourceFact["value"]) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : JSON.stringify(value);
}

export function detectAuthoritativeFactConflicts(facts: readonly AuthoritativeSourceFact[]) {
  const groups = new Map<string, AuthoritativeSourceFact[]>();
  for (const fact of facts.filter((candidate) => !candidate.superseded && candidate.value !== null && candidate.reviewStatus !== "REJECTED")) {
    const key = JSON.stringify([fact.canonicalRecordId, fact.fieldGroup, fact.field, fact.units]);
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  const conflicts: AuthoritativeFactConflict[] = [];
  for (const group of groups.values()) {
    const values = [...new Map(group.map((fact) => [comparisonValue(fact.value), fact.value])).values()];
    if (values.length < 2) continue;
    conflicts.push({
      canonicalRecordId: group[0].canonicalRecordId,
      fieldGroup: group[0].fieldGroup,
      field: group[0].field,
      units: group[0].units,
      factIds: group.map((fact) => fact.factId),
      values,
    });
  }
  return conflicts;
}
