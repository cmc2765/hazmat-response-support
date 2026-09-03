import { describe, expect, it } from "vitest";
import { weatherStatusFromObservation } from "@/lib/weather";

describe("weather snapshot freshness", () => {
  const now = "2026-08-30T12:00:00.000Z";

  it("classifies current, stale, expired, and future observations", () => {
    expect(weatherStatusFromObservation("2026-08-30T11:55:00.000Z", now)).toBe("Current");
    expect(weatherStatusFromObservation("2026-08-30T11:20:00.000Z", now)).toBe("Stale");
    expect(weatherStatusFromObservation("2026-08-30T10:00:00.000Z", now)).toBe("Expired");
    expect(weatherStatusFromObservation("2026-08-30T12:01:00.000Z", now)).toBe("Unavailable");
  });

  it("does not invent a status when observation time is absent", () => {
    expect(weatherStatusFromObservation(undefined, now)).toBe("Unavailable");
  });
});