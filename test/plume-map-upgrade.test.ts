import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const plumeStyles = readFileSync(new URL('../server/public/plume-overrides.css', import.meta.url), 'utf8');
const tactical3d = readFileSync(new URL('../server/public/tactical-3d.js', import.meta.url), 'utf8');

describe('Plume Model first-class map upgrade', () => {
  it('provides the requested map modes and separates overlays from mode controls', () => {
    for (const mode of ['satellite', 'tactical', 'street']) {
      expect(html).toContain(`data-plume-map-view="${mode}"`);
    }
    expect(html).toContain('Tactical 3D');
    expect(html).toContain('>Street</button>');
    expect(html).not.toContain('Street / Standard');
    expect(html).toContain('id="plume-tactical-3d-map"');
    expect(html).toContain('class="plume-map-mode-controls"');
    expect(html).toContain('class="plume-map-layer-controls"');
    for (const layer of ['zones', 'centerline', 'distance']) {
      expect(html).toContain(`data-plume-layer="${layer}"`);
    }
  });

  it('keeps MapLibre for standard modes and shares plume state without recalculation', () => {
    expect(script).toContain("const plumeLayerState = { zones: true, centerline: true, distance: false, hazards: false }");
    expect(script).toContain("const plumeTerrainSourceId = 'plume-terrain-dem'");
    expect(script).toContain("plumeMap.setTerrain({ source: plumeTerrainSourceId, exaggeration: 1.05 })");
    expect(script).toContain('const cameraBeforeSwitch = plumeMap ?');
    expect(script).toContain("if (!cameraBeforeSwitch && activeZones?.features?.length)");
    expect(script).not.toContain('plumeMap.setStyle(');
    const setView = script.slice(script.indexOf('async function setPlumeMapView'), script.indexOf('async function clearThreatZones'));
    expect(setView).not.toContain('runBackendPlume(');
    expect(setView).not.toContain('plotPlumeFromControls(');
    expect(setView).toContain('loadTactical3dRenderer()');
    expect(setView).toContain('getTactical3dState()');
    expect(script).toContain('threatZones: currentThreatZoneGeoJson');
    expect(script).toContain('guideGeoJson: currentThreatZoneGuideGeoJson');
    expect(script).toContain('syncTactical3dState();');
  });

  it('uses a distinct photorealistic renderer for Tactical 3D', () => {
    expect(script).toContain("const tactical3dScriptUrl = 'tactical-3d.js?v=photorealistic-1'");
    expect(script).toContain("tactical: { renderer: 'cesium-google-photorealistic'");
    expect(html).not.toContain('tactical-3d.js');
    expect(tactical3d).toContain('new Cesium.Viewer(container');
    expect(tactical3d).toContain('createGooglePhotorealistic3DTileset');
    expect(tactical3d).toContain('usingOnlyWithGoogleGeocoder: true');
    expect(tactical3d).toContain('showCreditsOnScreen: true');
    expect(tactical3d).not.toContain('fill-extrusion');
    expect(tactical3d).not.toMatch(/YOUR_(?:API_)?KEY/);
  });

  it('keeps 3D Terrain separate and provides safe provider fallback', () => {
    expect(script).toContain("type: 'raster-dem'");
    expect(script).toContain("encoding: 'terrarium'");
    expect(script).toContain("type: 'fill-extrusion'");
    expect(script).toContain('fallbackPlumeMapToSatellite');
    expect(tactical3d).toContain('Photorealistic Tactical 3D unavailable — using Satellite.');
    expect(tactical3d).toContain("fetch('/api/map/config'");
    expect(tactical3d).toContain("throw new Error('Google Maps Platform Photorealistic 3D Tiles are not configured.')");
    expect(script).toContain('plumeMap.on(\'error\'');
  });

  it('adds fit and recenter controls without changing release or plume calculations', () => {
    for (const id of ['plume-fit-view-btn', 'plume-recenter-incident-btn', 'plume-recenter-release-btn']) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(script).toContain('async function fitPlumeToView()');
    expect(script).toContain('async function recenterPlumeOnIncident()');
    expect(script).toContain('function recenterPlumeOnRelease()');
    expect(script).toContain('plumeMap.fitBounds(bounds');
    expect(plumeStyles).toContain('.plume-map-control-label');
  });

  it('retains visible provider attribution and local/offline-safe fallback messaging', () => {
    expect(html).toContain('© OpenFreeMap · © OpenMapTiles · Imagery © Esri');
    expect(script).toContain("const plumeMapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'");
    expect(script).toContain("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/");
    expect(html).toContain('id="plume-tactical-attribution"');
    expect(tactical3d).toContain("Photorealistic Tactical 3D unavailable — using Satellite.");
  });

  it('lazy-loads one Cesium viewer, preserves operational markers, and supports camera actions', () => {
    expect(tactical3d).toContain("if (state.viewer)");
    expect(tactical3d).toContain('state.viewer.useDefaultRenderLoop = false');
    expect(tactical3d).toContain('nextState.releasePoint');
    expect(tactical3d).toContain('nextState.incidentLocation');
    expect(tactical3d).toContain('nextState.operationalMarkers');
    for (const action of ['rotate', 'tilt', 'resetNorth', 'recenter', 'fit']) {
      expect(tactical3d).toContain(`function ${action}`);
    }
  });

  it('reports the exact fallback when the Tactical 3D key is missing', async () => {
    const messages: string[] = [];
    const context = {
      fetch: async () => ({ ok: true, json: async () => ({ googleMapsTileApiKey: '' }) }),
      window: { WebGLRenderingContext: {}, HazMatIQ: {} },
      document: { getElementById: () => ({}) },
    } as Record<string, unknown>;
    runInNewContext(tactical3d, context);
    const api = (context.window as {
      HazMatIQ: {
        tactical3d: {
          activate: (nextState: unknown, options?: { onUnavailable?: (message: string) => void }) => Promise<unknown>;
        };
      };
    }).HazMatIQ.tactical3d;
    await expect(api.activate({}, { onUnavailable: (message: string) => messages.push(message) })).rejects.toThrow('not configured');
    expect(messages).toEqual(['Photorealistic Tactical 3D unavailable — using Satellite.']);
  });
});
