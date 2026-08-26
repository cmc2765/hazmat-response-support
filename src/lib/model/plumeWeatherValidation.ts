export const PLUME_WEATHER_FRESHNESS = [
  "Current",
  "Recent / Verify",
  "Stale",
  "Expired",
  "Time Unknown",
  "Future / Invalid",
] as const;

export type PlumeWeatherFreshness = typeof PLUME_WEATHER_FRESHNESS[number];

export interface PlumeWeatherValidationInput {
  windSpeedMps?: number | null;
  windDirectionDeg?: number | null;
  source?: string | null;
  sourceMode?: string | null;
  observationTime?: string | null;
  now?: string | Date;
}

export interface PlumeWeatherValidationResult {
  status: "Complete" | "Planning Estimate" | "Missing Required Inputs" | "Requires Review";
  freshness: PlumeWeatherFreshness;
  ageMinutes: number | null;
  requiredInputs: string[];
  providedInputs: string[];
  missingInputs: string[];
  usableForPlanning: boolean;
  eligibleForValidatedModel: boolean;
  limitations: string[];
}

export function plumeWeatherFreshness(observationTime?: string | null, now: string | Date = new Date()): {
  status: PlumeWeatherFreshness;
  ageMinutes: number | null;
} {
  const observed = Date.parse(String(observationTime || ""));
  const current = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(observed) || !Number.isFinite(current)) return { status: "Time Unknown", ageMinutes: null };
  const ageMinutes = (current - observed) / 60_000;
  if (ageMinutes < -5) return { status: "Future / Invalid", ageMinutes };
  const nonnegativeAgeMinutes = Math.max(0, ageMinutes);
  if (nonnegativeAgeMinutes <= 10) return { status: "Current", ageMinutes: nonnegativeAgeMinutes };
  if (nonnegativeAgeMinutes <= 30) return { status: "Recent / Verify", ageMinutes: nonnegativeAgeMinutes };
  if (nonnegativeAgeMinutes <= 60) return { status: "Stale", ageMinutes: nonnegativeAgeMinutes };
  return { status: "Expired", ageMinutes: nonnegativeAgeMinutes };
}

export function validatePlumeWeather(input: PlumeWeatherValidationInput): PlumeWeatherValidationResult {
  const requiredInputs = ["windSpeedMps", "windDirectionDeg", "weatherSource"];
  const providedInputs: string[] = [];
  const missingInputs: string[] = [];
  const validWindSpeed = typeof input.windSpeedMps === "number" && Number.isFinite(input.windSpeedMps) && input.windSpeedMps > 0;
  const validWindDirection = typeof input.windDirectionDeg === "number"
    && Number.isFinite(input.windDirectionDeg) && input.windDirectionDeg >= 0 && input.windDirectionDeg <= 360;
  const source = input.source?.trim() || "";
  const hasSource = Boolean(source) && !/^(no current data exists|unavailable|unknown|not available)$/i.test(source);
  if (validWindSpeed) providedInputs.push("windSpeedMps"); else missingInputs.push("windSpeedMps");
  if (validWindDirection) providedInputs.push("windDirectionDeg"); else missingInputs.push("windDirectionDeg");
  if (hasSource) providedInputs.push("weatherSource"); else missingInputs.push("weatherSource");

  const manual = /manual/i.test(input.sourceMode || "") || /manual/i.test(input.source || "");
  const freshness = plumeWeatherFreshness(input.observationTime, input.now);
  const hasUsableObservationTime = !["Time Unknown", "Future / Invalid"].includes(freshness.status);
  if (hasUsableObservationTime) providedInputs.push("observationTime");
  else missingInputs.push("observationTime");
  const windComplete = validWindSpeed && validWindDirection;
  const usableForPlanning = windComplete && hasSource && hasUsableObservationTime
    && freshness.status !== "Expired";
  const eligibleForValidatedModel = windComplete && hasSource && !manual
    && ["Current", "Recent / Verify"].includes(freshness.status);
  const limitations = [
    !hasSource ? "Weather source is not identified." : "",
    freshness.status === "Time Unknown" ? "Weather observation time is unknown." : "",
    freshness.status === "Stale" ? "Weather is stale and may be used only for a planning estimate." : "",
    freshness.status === "Expired" ? "Weather is expired and requires replacement or Incident Command review." : "",
    freshness.status === "Future / Invalid" ? "Weather observation time is implausibly in the future." : "",
    manual ? "Manual weather may be used only for a planning estimate." : "",
  ].filter(Boolean);
  const status = !windComplete || !hasSource || !hasUsableObservationTime
    ? "Missing Required Inputs"
    : eligibleForValidatedModel
      ? "Complete"
      : manual || ["Stale", "Expired"].includes(freshness.status)
        ? "Planning Estimate"
        : "Requires Review";
  return {
    status,
    freshness: freshness.status,
    ageMinutes: freshness.ageMinutes,
    requiredInputs,
    providedInputs,
    missingInputs: [...new Set(missingInputs)],
    usableForPlanning,
    eligibleForValidatedModel,
    limitations,
  };
}
