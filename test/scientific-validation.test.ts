import { describe, expect, it } from "vitest";
import {
  SAFETY_DATA_STATUS,
  resolveSafetyValues,
  safetyDisplayValue,
  type ApprovedSourceRecord,
} from "@/lib/readiness";

describe("scientific safety-field validation", () => {
  it("uses the required nonblank missing-data messages", () => {
    expect(safetyDisplayValue(undefined)).toBe(SAFETY_DATA_STATUS.NO_CURRENT_DATA);
    expect(safetyDisplayValue("Not established")).toBe(SAFETY_DATA_STATUS.NOT_LISTED);
    expect(safetyDisplayValue("Not available")).toBe(SAFETY_DATA_STATUS.UNAVAILABLE);
    expect(safetyDisplayValue("Data unavailable")).toBe(SAFETY_DATA_STATUS.UNAVAILABLE);
  });

  it("rejects unapproved and unverified linked values", () => {
    const records: ApprovedSourceRecord[] = [
      { field: "idlh", value: "99 ppm", sourceName: "NIOSH", sourceRecordId: "bad-1", approved: false, linkVerified: true },
      { field: "idlh", value: "88 ppm", sourceName: "CAMEO Chemicals", sourceRecordId: "bad-2", approved: true, linkVerified: false },
    ];
    expect(resolveSafetyValues("idlh", records)).toEqual([]);
  });

  it("preserves all supported IDLH values, source labels, and history", () => {
    const records: ApprovedSourceRecord[] = [
      { field: "idlh", value: "50 ppm", sourceName: "NIOSH", sourceRecordId: "n-1", approved: true, linkVerified: true, isCurrent: true },
      { field: "idlh", value: "40 ppm", sourceName: "Chemical Companion", sourceRecordId: "cc-1", approved: true, isCurrent: true },
      { field: "idlh", value: "30 ppm", sourceName: "Chemical Companion", sourceRecordId: "cc-old", approved: true, isHistorical: true },
    ];
    const values = resolveSafetyValues("idlh", records);
    expect(values.map(({ value, source }) => [value, source])).toEqual([
      ["40 ppm", "Chemical Companion"],
      ["30 ppm", "Chemical Companion"],
      ["50 ppm", "NIOSH"],
    ]);
    expect(values[1].historical).toBe(true);
  });

  it("uses a verified linked IDLH when the master has no value", () => {
    const records: ApprovedSourceRecord[] = [
      { field: "idlh", value: null, sourceName: "Chemical Companion", sourceRecordId: "cc-1", approved: true },
      { field: "idlh", value: "10 ppm", sourceName: "NIOSH", sourceRecordId: "n-1", approved: true, linkVerified: true },
    ];
    expect(resolveSafetyValues("idlh", records)[0].value).toBe("10 ppm");
  });
});
