import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PLUME_VALIDATION_PLACEHOLDER_WARNING,
  validatePlumeCases,
  type PlumeValidationCase,
} from "@/lib/model/validation";

const validationCases = JSON.parse(readFileSync(
  new URL("./plume-validation-cases.example.json", import.meta.url),
  "utf8",
)) as PlumeValidationCase[];

describe("independent plume validation framework", () => {
  it("contains each required baseline validation category", () => {
    expect(new Set(validationCases.map((validationCase) => validationCase.category))).toEqual(new Set([
      "ammonia-railcar-release",
      "chlorine-cylinder-release",
      "dense-gas",
      "neutral-gas",
      "low-wind-stable",
      "moderate-wind-neutral",
      "urban-roughness",
      "rural-roughness",
    ]));
  });

  it("skips placeholders instead of treating them as passing validation cases", () => {
    const report = validatePlumeCases(validationCases);
    expect(report.summary).toEqual({
      totalValidationCases: 8,
      runnableValidationCases: 0,
      skippedCases: 8,
      passedCases: 0,
      failedCases: 0,
      validationStatus: "not-independently-validated",
    });
    expect(report.results.find((result) => result.id === "chlorine-cylinder-release")).toMatchObject({
      status: "skipped",
      expectedDistanceM: 1356.9696,
    });
    expect(report.results.filter((result) => result.status === "skipped")).toHaveLength(8);
    expect(report.results.filter((result) => result.expectedSource === null)
      .every((result) => result.message.includes(PLUME_VALIDATION_PLACEHOLDER_WARNING))).toBe(true);
    expect(report.results.find((result) => result.id === "chlorine-cylinder-release")?.message)
      .toContain("not directly runnable");
  });

  it("does not mark a partially populated fixture as runnable", () => {
    const partial = structuredClone(validationCases[0]);
    partial.expectedDistanceM = 1000;
    partial.expectedSource = "TODO: replace with a published source";
    const report = validatePlumeCases([partial]);
    expect(report.summary.runnableValidationCases).toBe(0);
    expect(report.summary.validationStatus).toBe("not-independently-validated");
    expect(report.results[0].status).toBe("skipped");
  });
});
