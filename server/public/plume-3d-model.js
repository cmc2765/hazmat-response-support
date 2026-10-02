/*
 * HazScope 3D Dispersion Model v2
 *
 * This file contains the screening-layer vertical and urban-obstacle model.
 * It does not
 * create a cloud asset or a canned shape. The browser passes the current
 * AEGL footprint, chemical profile, release inputs, weather, and terrain
 * samples into these functions and receives calculated cross-sections back.
 *
 * The horizontal AEGL result remains authoritative. The vertical estimate
 * reuses the same Briggs rural/urban sigma-z families as src/lib/model/briggs.ts
 * and applies a documented, deliberately limited dense-gas/buoyancy correction.
 * It is not CFD and must be verified with field monitoring and Incident Command.
 */
(function exposePlume3DModel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HazScopePlume3D = api;
}(typeof window !== 'undefined' ? window : globalThis, function createPlume3DModel() {
  const MODEL_VERSION = 'HazScope 3D Dispersion Model v2';
  const AIR_MOLECULAR_WEIGHT = 28.97;
  const STANDARD_ATMOSPHERIC_PRESSURE_KPA = 101.325;

  // Named coefficients keep the screening assumptions auditable. Values are
  // dimensionless multipliers, except where a unit is included in the name.
  const DENSE_GAS_PROXY_REFERENCE_KG_M3 = 0.00001;
  const DENSE_GAS_CONCENTRATION_GAIN = 1.25;
  const DENSE_GAS_SINK_GAIN = 0.72;
  const DENSE_GAS_LATERAL_GAIN = 0.28;
  const PASSIVE_TERRAIN_COUPLING = 0.18;
  const HUMIDITY_SOURCE_GAIN = 0.06;
  const BUILDING_CLEARANCE_M = 4;
  const BUILDING_DEFAULT_HEIGHT_M = 8;
  const BUILDING_WAKE_LENGTH_FACTOR = 1.5;
  const BUOYANT_RISE_GAIN = 0.9;
  const MAX_SCREENING_RISE_M = 180;
  const SLICE_FRACTIONS = [0, 0.08, 0.2, 0.38, 0.58, 0.78, 1];

  // The coefficients match the existing backend Briggs screening model. x,
  // sigma-y, and sigma-z are metres. This keeps the renderer from creating a
  // second incompatible atmospheric-dispersion family.
  const BRIGGS_SIGMA_Z = {
    rural: {
      A: (x) => 0.20 * x,
      B: (x) => 0.12 * x,
      C: (x) => 0.08 * x * Math.pow(1 + 0.0002 * x, -0.5),
      D: (x) => 0.06 * x * Math.pow(1 + 0.0015 * x, -0.5),
      E: (x) => 0.03 * x * Math.pow(1 + 0.0003 * x, -1),
      F: (x) => 0.016 * x * Math.pow(1 + 0.0003 * x, -1),
    },
    urban: {
      A: (x) => 0.24 * x * Math.pow(1 + 0.001 * x, 0.5),
      B: (x) => 0.24 * x * Math.pow(1 + 0.001 * x, 0.5),
      C: (x) => 0.20 * x,
      D: (x) => 0.14 * x * Math.pow(1 + 0.0003 * x, -0.5),
      E: (x) => 0.08 * x * Math.pow(1 + 0.0015 * x, -0.5),
      F: (x) => 0.08 * x * Math.pow(1 + 0.0015 * x, -0.5),
    },
  };

  function finite(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function firstNumber(value) {
    if (typeof value === 'number') return finite(value);
    const match = String(value ?? '').replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    return match ? finite(match[0]) : null;
  }

  function temperatureC(value) {
    const text = String(value ?? '').trim();
    const number = firstNumber(text);
    if (number === null) return null;
    if (/K\b/i.test(text)) return number - 273.15;
    if (/°?F\b/i.test(text)) return (number - 32) * 5 / 9;
    return number;
  }

  function vaporPressureKpa(value) {
    const text = String(value ?? '').trim();
    const number = firstNumber(text);
    if (number === null) return null;
    if (/mm\s*hg|torr/i.test(text)) return number * 0.133322;
    if (/\batm\b/i.test(text)) return number * STANDARD_ATMOSPHERIC_PRESSURE_KPA;
    if (/psi/i.test(text)) return number * 6.894757;
    if (/\bpa\b/i.test(text) && !/kpa/i.test(text)) return number / 1000;
    if (/kpa/i.test(text)) return number;
    // An unlabelled pressure is not silently treated as a pressure in a
    // particular unit. The 3D model reports it as unavailable instead.
    return null;
  }

  function physicalState(value) {
    const text = String(value ?? '').toLowerCase();
    if (/liquid|aqueous|solution/.test(text)) return 'liquid';
    if (/gas|vapor|vapour/.test(text)) return 'gas';
    if (/solid/.test(text)) return 'solid';
    return 'unknown';
  }

  function chemicalProperties(profile = {}, inputs = {}) {
    const properties = profile?.properties || profile || {};
    const state = physicalState(inputs.releasePhase || properties.physicalState || properties.state);
    const vaporDensityMeasured = firstNumber(properties.vaporDensity);
    const molecularWeight = firstNumber(properties.molecularWeight) ?? finite(inputs.molecularWeight);
    const vaporDensity = vaporDensityMeasured !== null
      ? vaporDensityMeasured
      // A liquid release can still produce a vapor cloud; molecular-weight
      // density is therefore a defensible fallback for non-solid sources.
      : (molecularWeight !== null && state !== 'solid' ? molecularWeight / AIR_MOLECULAR_WEIGHT : null);
    const vaporPressure = vaporPressureKpa(properties.vaporPressure);
    const specificGravity = firstNumber(properties.specificGravity);
    const boilingPointC = temperatureC(properties.boilingPoint);
    const sources = {
      vaporDensity: vaporDensityMeasured !== null ? 'source chemical data' : vaporDensity !== null ? 'estimated from molecular weight' : 'unavailable',
      vaporPressure: vaporPressure !== null ? 'source chemical data' : 'unavailable',
      specificGravity: specificGravity !== null ? 'source chemical data' : 'unavailable',
      molecularWeight: molecularWeight !== null ? (properties.molecularWeight ? 'source chemical data' : 'model input') : 'unavailable',
      boilingPoint: boilingPointC !== null ? 'source chemical data' : 'unavailable',
    };
    const missing = Object.entries(sources)
      .filter(([, source]) => source === 'unavailable')
      .map(([name]) => name);
    return {
      state,
      vaporDensity,
      vaporPressureKpa: vaporPressure,
      specificGravity,
      molecularWeight,
      boilingPointC,
      sources,
      missing,
    };
  }

  function sigmaZ(distanceM, stabilityClass = 'D', surfaceRoughness = 'rural') {
    const family = surfaceRoughness === 'urban' ? BRIGGS_SIGMA_Z.urban : BRIGGS_SIGMA_Z.rural;
    const fn = family[String(stabilityClass || 'D').toUpperCase()] || family.D;
    return Math.max(fn(Math.max(0, distanceM)), 0.75);
  }

  function sourceRateKgPerSecond(inputs = {}) {
    if (finite(inputs.releaseRateKgPerSec) !== null) return finite(inputs.releaseRateKgPerSec);
    const mass = finite(inputs.totalMassKg);
    const duration = finite(inputs.durationSec) ?? finite(inputs.releaseDurationSec);
    return mass !== null && duration > 0 ? mass / duration : null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function sourceTermFactor(properties, inputs) {
    // Vapor pressure is used only as a liquid source-volatility modifier. It
    // is never used as a plume-height coefficient. Specific gravity is only
    // used for the liquid pool/source term and not as vapor density.
    const liquid = properties.state === 'liquid' || /liquid|pool/i.test(String(inputs.releasePhase || ''));
    if (!liquid) return 1;
    const volatility = properties.vaporPressureKpa === null
      ? 1
      : clamp(0.65 + 0.35 * Math.sqrt(clamp(properties.vaporPressureKpa / STANDARD_ATMOSPHERIC_PRESSURE_KPA, 0, 4)), 0.65, 1.35);
    const poolFactor = properties.specificGravity === null
      ? 1
      : clamp(1 / Math.sqrt(Math.max(properties.specificGravity, 0.1)), 0.72, 1.28);
    // Relative humidity is deliberately a small, liquid-source persistence
    // modifier only. It never steers the plume and is not applied to gases
    // without a documented hygroscopic property.
    const rh = finite(inputs.rh);
    const humidityFactor = rh === null
      ? 1
      : clamp(1 - ((rh - 50) / 100) * HUMIDITY_SOURCE_GAIN, 0.94, 1.06);
    return volatility * poolFactor * humidityFactor;
  }

  function buildVerticalSlices({ zone, footprintPoints = [], inputs = {}, profile = {}, terrainElevations = [] } = {}) {
    const properties = chemicalProperties(profile, inputs);
    const distanceM = Math.max(finite(zone?.maxDownwindM) ?? 0, 1);
    const maxCrosswindM = Math.max(finite(zone?.maxCrosswindM) ?? 1, 1);
    const windSpeedMps = Math.max(finite(inputs.windSpeedMps) ?? 0.1, 0.1);
    const releaseHeightAGL = Math.max(finite(inputs.releaseHeightM) ?? 0, 0);
    const rate = sourceRateKgPerSecond(inputs);
    const sourceFactor = sourceTermFactor(properties, inputs);
    const sourceProxy = rate === null ? 0 : rate * sourceFactor / (windSpeedMps * Math.max(maxCrosswindM, 1) * sigmaZ(10, inputs.stabilityClass, inputs.surfaceRoughness));
    const densityContrast = properties.vaporDensity === null ? 0 : properties.vaporDensity - 1;
    const thermalDeltaC = (finite(inputs.chemicalTemperatureC) ?? finite(inputs.tempC) ?? 20) - (finite(inputs.tempC) ?? 20);
    const thermalBuoyancy = clamp(thermalDeltaC / 80, -0.35, 0.35);
    const stablePoints = footprintPoints.filter((point) => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]));
    const widthAt = (x) => {
      if (!stablePoints.length) return maxCrosswindM * 0.5;
      const tolerance = Math.max(distanceM * 0.035, 8);
      const near = stablePoints.filter(([pointX]) => pointX <= x + tolerance && pointX >= Math.max(0, x - tolerance * 2));
      const prior = stablePoints.filter(([pointX]) => pointX <= x + tolerance);
      const points = near.length >= 2 ? near : prior;
      const observed = points.reduce((max, [, y]) => Math.max(max, Math.abs(y)), 0);
      return clamp(observed || maxCrosswindM * (0.12 + 0.88 * Math.sqrt(x / distanceM)), 1, maxCrosswindM);
    };
    const centerYAt = (x) => {
      if (!stablePoints.length) return 0;
      const tolerance = Math.max(distanceM * 0.05, 12);
      const near = stablePoints.filter(([pointX]) => Math.abs(pointX - x) <= tolerance);
      if (!near.length) return 0;
      return (Math.min(...near.map(([, y]) => y)) + Math.max(...near.map(([, y]) => y))) / 2;
    };
    return SLICE_FRACTIONS.map((fraction, index) => {
      const downwindDistanceM = distanceM * fraction;
      const dilution = Math.exp(-downwindDistanceM / Math.max(distanceM * 0.42, 1));
      const concentrationFactor = clamp(sourceProxy / DENSE_GAS_PROXY_REFERENCE_KG_M3, 0, 1);
      const denseGasFactor = properties.vaporDensity === null
        ? 0
        : clamp(Math.max(0, densityContrast) * (0.42 + DENSE_GAS_CONCENTRATION_GAIN * concentrationFactor) * dilution, 0, 1);
      const buoyancyFactor = properties.vaporDensity === null
        ? clamp(thermalBuoyancy, -0.35, 0.35)
        : clamp(Math.max(0, 1 - properties.vaporDensity) * (0.55 + 0.45 * (1 - denseGasFactor)) + thermalBuoyancy, -0.5, 1);
      const sigma = sigmaZ(downwindDistanceM, inputs.stabilityClass, inputs.surfaceRoughness);
      const footprintWidthM = widthAt(downwindDistanceM);
      const verticalSpreadM = Math.max(
        sigma,
        footprintWidthM * (0.24 + DENSE_GAS_LATERAL_GAIN * denseGasFactor),
      ) * (0.86 + 0.18 * sourceFactor);
      const passiveRiseM = BUOYANT_RISE_GAIN * buoyancyFactor * Math.sqrt(Math.max(downwindDistanceM, 0)) * 0.34;
      // A release-height source plane is preserved at x = 0. Dense-gas
      // settling develops over the first dispersion length instead of
      // erasing the operator's actual release height at the source.
      const denseSettlingOnset = 1 - Math.exp(-downwindDistanceM / Math.max(distanceM * 0.08, 1));
      const denseSinkM = DENSE_GAS_SINK_GAIN * denseGasFactor * Math.max(4, verticalSpreadM) * denseSettlingOnset;
      const terrainSample = terrainElevations[index];
      const terrainElevationM = finite(terrainSample?.center) ?? finite(terrainSample) ?? finite(inputs.terrainElevationM) ?? 0;
      const terrainLeftM = finite(terrainSample?.left) ?? terrainElevationM;
      const terrainRightM = finite(terrainSample?.right) ?? terrainElevationM;
      const terrainReliefM = ((terrainLeftM + terrainRightM) / 2) - terrainElevationM;
      const terrainCoupling = clamp(PASSIVE_TERRAIN_COUPLING + denseGasFactor * 0.72, 0.1, 1);
      // Positive relief means the centerline is lower than its lateral
      // shoulders (a valley). Dense-gas coupling applies a bounded pooling
      // tendency; buoyant/passive releases remain mostly atmospheric.
      const valleyConfinementM = Math.max(0, terrainReliefM) * terrainCoupling * 0.04;
      const centerlineAGL = clamp(releaseHeightAGL + passiveRiseM - denseSinkM - valleyConfinementM, 0.25, MAX_SCREENING_RISE_M);
      const baseAGL = Math.max(0, centerlineAGL - verticalSpreadM);
      const topAGL = Math.max(baseAGL + 0.5, centerlineAGL + verticalSpreadM);
      return {
        downwindDistanceM,
        terrainElevationM,
        footprintWidthM,
        centerY: centerYAt(downwindDistanceM),
        centerlineAGL,
        baseAGL,
        topAGL,
        baseMSL: terrainElevationM + baseAGL,
        topMSL: terrainElevationM + topAGL,
        verticalSpreadM,
        denseGasFactor,
        buoyancyFactor,
        dilution,
        sigmaZ: sigma,
        sourceTermFactor: sourceFactor,
        humiditySourceFactor: properties.state === 'liquid' && finite(inputs.rh) !== null
          ? clamp(1 - ((finite(inputs.rh) - 50) / 100) * HUMIDITY_SOURCE_GAIN, 0.94, 1.06)
          : 1,
        terrainCoupling: clamp(PASSIVE_TERRAIN_COUPLING + denseGasFactor * 0.72, 0.1, 1),
        terrainSlopeMPerM: (terrainRightM - terrainLeftM) / Math.max(maxCrosswindM * 1.4, 1),
        terrainReliefM,
        propertySource: properties.sources,
        propertyMissing: properties.missing,
        modelVersion: MODEL_VERSION,
        sliceIndex: index,
      };
    });
  }

  function interpolateSlice(slices, distanceM) {
    if (!slices.length) return null;
    if (distanceM <= slices[0].downwindDistanceM) return { ...slices[0], downwindDistanceM: distanceM };
    const last = slices.at(-1);
    if (distanceM >= last.downwindDistanceM) return { ...last, downwindDistanceM: distanceM };
    const index = slices.findIndex((slice, sliceIndex) => sliceIndex > 0 && slice.downwindDistanceM >= distanceM);
    const before = slices[index - 1];
    const after = slices[index];
    const ratio = (distanceM - before.downwindDistanceM) / Math.max(after.downwindDistanceM - before.downwindDistanceM, 1);
    const interpolate = (key) => before[key] + (after[key] - before[key]) * ratio;
    return {
      ...before,
      downwindDistanceM: distanceM,
      terrainElevationM: interpolate('terrainElevationM'),
      footprintWidthM: interpolate('footprintWidthM'),
      centerY: interpolate('centerY'),
      centerlineAGL: interpolate('centerlineAGL'),
      baseAGL: interpolate('baseAGL'),
      topAGL: interpolate('topAGL'),
      baseMSL: interpolate('baseMSL'),
      topMSL: interpolate('topMSL'),
      verticalSpreadM: interpolate('verticalSpreadM'),
      denseGasFactor: interpolate('denseGasFactor'),
      buoyancyFactor: interpolate('buoyancyFactor'),
      dilution: interpolate('dilution'),
      sigmaZ: interpolate('sigmaZ'),
      terrainCoupling: interpolate('terrainCoupling'),
      terrainSlopeMPerM: interpolate('terrainSlopeMPerM'),
      terrainReliefM: interpolate('terrainReliefM'),
    };
  }

  /**
   * Applies a low-order urban-obstacle screen to calculated sections. An
   * obstacle is a mapped building footprint plus its reported/estimated
   * extrusion height in metres. Sections that intersect a building at the
   * modeled height split around its lateral edges; where neither side has
   * room inside the authoritative AEGL crosswind bounds, the section is
   * attenuated instead. This is obstacle deflection, not CFD or infiltration.
   */
  function applyUrbanObstacleInteraction({ slices = [], obstacles = [], maxCrosswindM = 1 } = {}) {
    if (!slices.length) return [];
    const usableObstacles = obstacles.filter((obstacle) => (
      Number.isFinite(obstacle?.xMin)
      && Number.isFinite(obstacle?.xMax)
      && Number.isFinite(obstacle?.yMin)
      && Number.isFinite(obstacle?.yMax)
      && obstacle.xMax >= 0
      && obstacle.xMin <= slices.at(-1).downwindDistanceM
    ));
    if (!usableObstacles.length) {
      return slices.map((slice) => ({
        ...slice,
        branches: [{ ...slice, branchId: 'main', obstacleInteraction: 'none', obstructionFactor: 0 }],
      }));
    }
    const distances = [...new Set([
      ...slices.map((slice) => slice.downwindDistanceM),
      ...usableObstacles.flatMap((obstacle) => [Math.max(0, obstacle.xMin), Math.max(0, obstacle.xMax)]),
    ])]
      .filter((distance) => distance >= 0 && distance <= slices.at(-1).downwindDistanceM)
      .sort((a, b) => a - b);
    return distances.map((distanceM) => {
      const slice = interpolateSlice(slices, distanceM);
      const active = usableObstacles.filter((obstacle) => {
        const lateralOverlap = obstacle.yMax >= slice.centerY - slice.footprintWidthM
          && obstacle.yMin <= slice.centerY + slice.footprintWidthM;
        const heightOverlap = (obstacle.heightM ?? BUILDING_DEFAULT_HEIGHT_M) >= slice.baseAGL;
        return distanceM >= obstacle.xMin && distanceM <= obstacle.xMax && lateralOverlap && heightOverlap;
      });
      const nearby = usableObstacles.filter((obstacle) => distanceM >= obstacle.xMin && distanceM <= obstacle.xMax
        && obstacle.yMax >= -maxCrosswindM && obstacle.yMin <= maxCrosswindM);
      const leftWall = Math.max(...nearby.filter((obstacle) => obstacle.yMax <= slice.centerY).map((obstacle) => obstacle.yMax), -Infinity);
      const rightWall = Math.min(...nearby.filter((obstacle) => obstacle.yMin >= slice.centerY).map((obstacle) => obstacle.yMin), Infinity);
      const corridorGapM = rightWall - leftWall;
      if (!active.length && slice.denseGasFactor > 0.25 && Number.isFinite(leftWall) && Number.isFinite(rightWall)
        && corridorGapM > 0 && corridorGapM < slice.footprintWidthM * 2) {
        return {
          ...slice,
          branches: [{
            ...slice,
            centerY: (leftWall + rightWall) / 2,
            footprintWidthM: Math.max(2, Math.min(slice.footprintWidthM, corridorGapM / 2)),
            branchId: 'main',
            obstacleInteraction: 'channelled through mapped urban corridor',
            obstructionFactor: 0,
          }],
        };
      }
      if (!active.length) return {
        ...slice,
        branches: [{ ...slice, branchId: 'main', obstacleInteraction: 'none', obstructionFactor: 0 }],
      };
      const obstacleMinY = Math.min(...active.map((obstacle) => obstacle.yMin));
      const obstacleMaxY = Math.max(...active.map((obstacle) => obstacle.yMax));
      const buildingHeight = Math.max(...active.map((obstacle) => obstacle.heightM ?? BUILDING_DEFAULT_HEIGHT_M));
      const obstructionFactor = clamp((buildingHeight - slice.baseAGL) / Math.max(buildingHeight + slice.verticalSpreadM, 1), 0, 1);
      const clearance = Math.max(BUILDING_CLEARANCE_M, slice.verticalSpreadM * (slice.denseGasFactor > 0.35 ? 0.12 : 0.2));
      const sideWidth = Math.max(2, Math.min(slice.footprintWidthM * 0.55, maxCrosswindM * 0.28));
      const leftCenter = obstacleMinY - clearance - sideWidth;
      const rightCenter = obstacleMaxY + clearance + sideWidth;
      const leftFits = leftCenter - sideWidth >= -maxCrosswindM;
      const rightFits = rightCenter + sideWidth <= maxCrosswindM;
      const branches = [];
      if (leftFits) branches.push({
        ...slice,
        branchId: 'left',
        centerY: leftCenter,
        footprintWidthM: sideWidth,
        obstacleInteraction: 'split/deflect around mapped building',
        obstructionFactor,
        buildingWakeLengthM: Math.max(20, (Math.max(...active.map((obstacle) => obstacle.xMax - obstacle.xMin)) || 1) * BUILDING_WAKE_LENGTH_FACTOR),
      });
      if (rightFits) branches.push({
        ...slice,
        branchId: 'right',
        centerY: rightCenter,
        footprintWidthM: sideWidth,
        obstacleInteraction: 'split/deflect around mapped building',
        obstructionFactor,
        buildingWakeLengthM: Math.max(20, (Math.max(...active.map((obstacle) => obstacle.xMax - obstacle.xMin)) || 1) * BUILDING_WAKE_LENGTH_FACTOR),
      });
      if (!branches.length) branches.push({
        ...slice,
        footprintWidthM: Math.max(2, slice.footprintWidthM * (1 - obstructionFactor * 0.7)),
        obstacleInteraction: 'attenuated by mapped building; no lateral opening in AEGL footprint',
        obstructionFactor,
        branchId: 'main',
      });
      return { ...slice, branches };
    });
  }

  function confidence(properties, inputs) {
    const reasons = [];
    if (properties.vaporDensity === null) reasons.push('vapor density and molecular-weight fallback unavailable');
    if (properties.vaporPressureKpa === null && properties.state === 'liquid') reasons.push('vapor pressure unavailable for liquid source behavior');
    if (properties.state === 'unknown') reasons.push('physical state unavailable');
    if (properties.state === 'liquid' && finite(inputs.rh) === null) reasons.push('humidity unavailable; liquid persistence modifier not applied');
    if (finite(inputs.terrainElevationM) === null) reasons.push('terrain elevation is being sampled from the active DEM');
    if (!reasons.length) return { level: 'Moderate', reasons: ['Source chemical properties, release inputs, Briggs stability, and terrain samples are available.'] };
    return { level: reasons.length > 1 ? 'Limited' : 'Moderate', reasons };
  }

  return {
    MODEL_VERSION,
    SLICE_FRACTIONS,
    chemicalProperties,
    confidence,
    sigmaZ,
    sourceRateKgPerSecond,
    sourceTermFactor,
    buildVerticalSlices,
    applyUrbanObstacleInteraction,
  };
}));
