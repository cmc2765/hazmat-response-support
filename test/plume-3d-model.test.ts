import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const modelUrl = new URL("../server/public/plume-3d-model.js", import.meta.url).href;
const plumeUi = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
await import(`${modelUrl}?test=plume3d`);
type Plume3DSlice = {
  centerlineAGL: number;
  denseGasFactor: number;
  sourceTermFactor: number;
  baseMSL: number;
  topMSL: number;
  terrainElevationM: number;
  topAGL: number;
};
type Plume3DModel = {
  MODEL_VERSION: string;
  SLICE_FRACTIONS: number[];
  buildVerticalSlices: (args: {
    zone: { maxDownwindM: number; maxCrosswindM: number };
    footprintPoints: Array<[number, number]>;
    inputs: Record<string, unknown>;
    profile: { properties: Record<string, unknown> };
    terrainElevations: number[];
  }) => Plume3DSlice[];
  chemicalProperties: (profile: Record<string, unknown>, inputs: Record<string, unknown>) => {
    vaporDensity: number | null;
    sources: { vaporDensity: string };
  };
  confidence: (properties: unknown, inputs: Record<string, unknown>) => { level: string };
  applyUrbanObstacleInteraction: (args: {
    slices: Plume3DSlice[];
    obstacles: Array<{ xMin: number; xMax: number; yMin: number; yMax: number; heightM: number }>;
    maxCrosswindM: number;
  }) => Array<{ branches: Array<{ branchId: string; obstacleInteraction: string }> }>;
};
const plume3d = (globalThis as { HazScopePlume3D?: Plume3DModel }).HazScopePlume3D as Plume3DModel;

const footprint = [[0, 0], [180, -18], [480, -56], [1000, -120], [1000, 120], [480, 56], [180, 18], [0, 0]] as Array<[number, number]>;
const baseInputs: Record<string, unknown> = {
  releaseRateKgPerSec: 0.01,
  releaseHeightM: 0,
  windSpeedMps: 4,
  windDirDeg: 180,
  stabilityClass: "D",
  surfaceRoughness: "rural",
  tempC: 20,
  terrainElevationM: 100,
};

function slices(profile: Record<string, unknown>, inputs = baseInputs) {
  return plume3d.buildVerticalSlices({
    zone: { maxDownwindM: 1000, maxCrosswindM: 120 },
    footprintPoints: footprint,
    inputs,
    profile: { properties: profile },
    terrainElevations: [100, 104, 109, 115, 121, 128, 136],
  });
}

describe("HazScope 3D plume screening model", () => {
  it("changes vertical geometry for heavy versus light vapor", () => {
    const heavy = slices({ physicalState: "Gas", vaporDensity: "2.5", molecularWeight: "72" });
    const light = slices({ physicalState: "Gas", vaporDensity: "0.6", molecularWeight: "17" });

    expect(heavy).toHaveLength(plume3d.SLICE_FRACTIONS.length);
    expect(heavy[3].centerlineAGL).toBeLessThan(light[3].centerlineAGL);
    expect(heavy[3].denseGasFactor).toBeGreaterThan(light[3].denseGasFactor);
  });

  it("uses vapor pressure and liquid specific gravity only in the liquid source term", () => {
    const lowVolatility = slices({ physicalState: "Liquid", vaporDensity: "2.0", vaporPressure: "10 mmHg", specificGravity: "1.2" });
    const highVolatility = slices({ physicalState: "Liquid", vaporDensity: "2.0", vaporPressure: "1 atm", specificGravity: "0.8" });
    const gasWithPressure = slices({ physicalState: "Gas", vaporDensity: "2.0", vaporPressure: "10 mmHg", specificGravity: "1.2" });

    expect(highVolatility[1].sourceTermFactor).toBeGreaterThan(lowVolatility[1].sourceTermFactor);
    expect(gasWithPressure[1].sourceTermFactor).toBe(1);
  });

  it("uses humidity only as a bounded liquid-source persistence modifier", () => {
    const dry = slices({ physicalState: "Liquid", vaporDensity: "2.0", vaporPressure: "1 atm", specificGravity: "1.0" }, { ...baseInputs, rh: 20 });
    const humid = slices({ physicalState: "Liquid", vaporDensity: "2.0", vaporPressure: "1 atm", specificGravity: "1.0" }, { ...baseInputs, rh: 90 });
    const gasDry = slices({ physicalState: "Gas", vaporDensity: "2.0", vaporPressure: "1 atm" }, { ...baseInputs, rh: 20 });
    const gasHumid = slices({ physicalState: "Gas", vaporDensity: "2.0", vaporPressure: "1 atm" }, { ...baseInputs, rh: 90 });

    expect(dry[1].sourceTermFactor).not.toBe(humid[1].sourceTermFactor);
    expect(Math.abs(dry[1].sourceTermFactor - humid[1].sourceTermFactor)).toBeLessThan(0.1);
    expect(gasDry[1].sourceTermFactor).toBe(gasHumid[1].sourceTermFactor);
  });

  it("preserves release height at the source and recomputes terrain-referenced elevations", () => {
    const elevated = slices({ physicalState: "Gas", vaporDensity: "1.0", molecularWeight: "29" }, { ...baseInputs, releaseHeightM: 3.048 });
    expect(elevated[0].centerlineAGL).toBeCloseTo(3.048, 4);
    expect(elevated[0].topMSL).toBeGreaterThan(100);
    expect(elevated.at(-1)?.terrainElevationM).toBe(136);
    expect(elevated.at(-1)?.topMSL).toBeGreaterThan(elevated.at(-1)?.topAGL || 0);
  });

  it("discloses missing properties instead of fabricating them", () => {
    const properties = plume3d.chemicalProperties({ physicalState: "Liquid" }, baseInputs);
    expect(properties.vaporDensity).toBeNull();
    expect(properties.sources.vaporDensity).toBe("unavailable");
    expect(plume3d.confidence(properties, baseInputs).level).toBe("Limited");
  });

  it("uses a mapped building obstacle to split or attenuate the plume path", () => {
    const open = plume3d.applyUrbanObstacleInteraction({
      slices: plume3d.buildVerticalSlices({
        zone: { maxDownwindM: 1000, maxCrosswindM: 120 },
        footprintPoints: footprint,
        inputs: baseInputs,
        profile: { properties: { physicalState: "Gas", vaporDensity: "2.5", molecularWeight: "72" } },
        terrainElevations: [100, 100, 100, 100, 100, 100, 100],
      }),
      maxCrosswindM: 120,
      obstacles: [],
    });
    const blocked = plume3d.applyUrbanObstacleInteraction({
      slices: plume3d.buildVerticalSlices({
        zone: { maxDownwindM: 1000, maxCrosswindM: 120 },
        footprintPoints: footprint,
        inputs: baseInputs,
        profile: { properties: { physicalState: "Gas", vaporDensity: "2.5", molecularWeight: "72" } },
        terrainElevations: [100, 100, 100, 100, 100, 100, 100],
      }),
      maxCrosswindM: 120,
      obstacles: [{ xMin: 250, xMax: 430, yMin: -18, yMax: 18, heightM: 20 }],
    });

    expect(open.some((section: { branches: Array<{ obstacleInteraction: string }> }) => section.branches.some((branch) => branch.obstacleInteraction !== "none"))).toBe(false);
    expect(blocked.some((section: { branches: Array<{ obstacleInteraction: string }> }) => section.branches.some((branch) => branch.obstacleInteraction.includes("building")))).toBe(true);
    expect(blocked.some((section: { branches: Array<{ branchId: string }> }) => section.branches.some((branch) => branch.branchId === "left"))).toBe(true);
    expect(blocked.some((section: { branches: Array<{ branchId: string }> }) => section.branches.some((branch) => branch.branchId === "right"))).toBe(true);
  });

  it("restores the calculated 3D source and layers after map style changes", () => {
    expect(plumeUi).toContain("restorePlumeMapOverlays();");
    expect(plumeUi).toContain("addPlume3dEnvelopeLayers();");
    expect(plumeUi).toContain("plumeMap.once('idle'");
    expect(plumeUi).toContain("const plume3dCustomLayerId = 'hazmat-plume-3d-mesh'");
    expect(plumeUi).toContain("type: 'custom'");
    expect(plumeUi).toContain("renderingMode: '3d'");
    expect(plumeUi).not.toContain("'fill-extrusion-height': ['get', 'topMSL']");
  });
});
