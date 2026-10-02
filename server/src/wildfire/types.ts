export type WildfireStatus = "CHECKING" | "CONNECTED" | "STALE" | "ERROR" | "NOT CONFIGURED";

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GeoJsonGeometry {
  type: "Point" | "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface WildfireFeature {
  id: string;
  geometry: GeoJsonGeometry;
  properties: Record<string, unknown>;
  source: string;
}

export interface WildfireResult<T extends WildfireFeature = WildfireFeature> {
  status: WildfireStatus;
  source: string;
  sourceUrl?: string;
  sourceUse?: string;
  refreshIntervalMinutes?: number;
  retrievedAt: string | null;
  features: T[];
  count: number;
  error?: string;
}

export function isValidBounds(bounds: MapBounds): boolean {
  return Number.isFinite(bounds.west)
    && Number.isFinite(bounds.south)
    && Number.isFinite(bounds.east)
    && Number.isFinite(bounds.north)
    && bounds.west >= -180 && bounds.west <= 180
    && bounds.east >= -180 && bounds.east <= 180
    && bounds.south >= -90 && bounds.south <= 90
    && bounds.north >= -90 && bounds.north <= 90
    && bounds.south < bounds.north;
}

export function boundsContainPoint(bounds: MapBounds, longitude: number, latitude: number): boolean {
  if (latitude < bounds.south || latitude > bounds.north) return false;
  return bounds.west <= bounds.east
    ? longitude >= bounds.west && longitude <= bounds.east
    : longitude >= bounds.west || longitude <= bounds.east;
}

export function splitBounds(bounds: MapBounds): MapBounds[] {
  return bounds.west <= bounds.east
    ? [bounds]
    : [
        { west: bounds.west, east: 180, south: bounds.south, north: bounds.north },
        { west: -180, east: bounds.east, south: bounds.south, north: bounds.north },
      ];
}

export function parseMapBounds(values: Partial<Record<keyof MapBounds, string | undefined>>): MapBounds | null {
  const bounds = {
    west: Number(values.west),
    south: Number(values.south),
    east: Number(values.east),
    north: Number(values.north),
  };
  return isValidBounds(bounds) ? bounds : null;
}
