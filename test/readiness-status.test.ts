import { describe, expect, it } from "vitest";
import { GO_READINESS_STATUS, isGoReadinessStatus, sourceStatus } from "@/lib/readiness";

describe("GO-readiness source status", () => {
  it("provides the required user-facing status vocabulary", () => {
    expect(Object.values(GO_READINESS_STATUS)).toEqual([
      "Verified Source",
      "Imported Source",
      "Planning Estimate",
      "Manual Entry",
      "Needs Verification",
      "No Current Data Exists",
      "Blocked Pending Validation",
    ]);
  });

  it("builds and recognizes structured source statuses", () => {
    const result = sourceStatus(GO_READINESS_STATUS.IMPORTED_SOURCE, {
      source: "PHMSA ERG 2024",
      value: "Guide 125",
    });
    expect(result).toEqual({
      status: "Imported Source",
      source: "PHMSA ERG 2024",
      value: "Guide 125",
    });
    expect(isGoReadinessStatus(result.status)).toBe(true);
    expect(isGoReadinessStatus("Operationally Validated")).toBe(false);
  });
});
