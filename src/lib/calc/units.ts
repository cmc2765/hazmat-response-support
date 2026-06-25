export const FEET_PER_METER = 3.28084;
export const MILES_PER_METER = 0.000621371;

export function mToFt(m: number): number {
  return m * FEET_PER_METER;
}

export function mToMi(m: number): number {
  return m * MILES_PER_METER;
}

export function msToMph(ms: number): number {
  return ms * 2.23694;
}

export function cToF(c: number): number {
  return c * 9 / 5 + 32;
}
