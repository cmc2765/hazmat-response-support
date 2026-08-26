import { cbrneProfileById } from "../cbrne/cbrneProfileAdapter.js";
import type { HazardIdLane, HazardProfile } from "./hazardTypes.js";

export function starterHazardProfile(lane: Exclude<HazardIdLane, "CHEMICAL">, id: string): HazardProfile | null {
  return cbrneProfileById(lane, id);
}
