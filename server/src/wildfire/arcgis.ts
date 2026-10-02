import type { GeoJsonGeometry, MapBounds, WildfireFeature } from "./types.js";

type ArcgisGeometry = {
  x?: number;
  y?: number;
  rings?: number[][][];
};

export function arcgisGeometryToGeoJson(geometry: ArcgisGeometry | undefined): GeoJsonGeometry | null {
  if (!geometry) return null;
  if (Number.isFinite(geometry.x) && Number.isFinite(geometry.y)) {
    return { type: "Point", coordinates: [geometry.x, geometry.y] };
  }
  if (Array.isArray(geometry.rings) && geometry.rings.length > 0) {
    return { type: "Polygon", coordinates: geometry.rings };
  }
  return null;
}

export function arcgisQueryUrl(
  serviceUrl: string,
  bounds: MapBounds,
  resultRecordCount = 2000,
): string {
  const url = new URL(serviceUrl);
  url.search = new URLSearchParams({
    f: "json",
    where: "1=1",
    geometry: JSON.stringify({
      xmin: bounds.west,
      ymin: bounds.south,
      xmax: bounds.east,
      ymax: bounds.north,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(resultRecordCount),
  }).toString();
  return url.toString();
}

export function dedupeWildfireFeatures<T extends WildfireFeature>(features: T[]): T[] {
  const seen = new Set<string>();
  return features.filter((feature) => {
    if (seen.has(feature.id)) return false;
    seen.add(feature.id);
    return true;
  });
}
