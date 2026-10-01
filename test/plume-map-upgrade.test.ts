import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const plumeStyles = readFileSync(new URL('../server/public/plume-overrides.css', import.meta.url), 'utf8');

describe('Plume Model Tactical 3D map restoration', () => {
  it('provides the requested map modes and one shared map surface', () => {
    for (const mode of ['satellite', 'tactical', 'street', 'terrain3d']) {
      expect(html).toContain(`data-plume-map-view="${mode}"`);
    }
    expect(html).toContain('Tactical 3D');
    expect(html).toContain('>Street</button>');
    expect(html).not.toContain('Street / Standard');
    expect(html).toContain('id="plume-gis-map"');
    expect(html).not.toContain('id="plume-tactical-3d-map"');
    expect(html).toContain('class="plume-map-mode-controls"');
    expect(html).toContain('class="plume-map-layer-controls"');
    for (const layer of ['zones', 'centerline', 'distance']) {
      expect(html).toContain(`data-plume-layer="${layer}"`);
    }
  });

  it('restores the historical Liberty Tactical 3D camera on the current MapLibre instance', () => {
    expect(script).toContain("const plumeMapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'");
    expect(script).toContain("tactical: { style: plumeMapStyleUrl, pitch: 28, bearing: 0 }");
    expect(script).toContain("let plumeMapStyleMode = 'base'");
    expect(script).toContain('buildTacticalPlumeMapStyle');
    expect(script).toContain('desaturatePlumeMapColor');
    expect(script).toContain("setText('plume-terrain-status', 'Tactical 3D · desaturated basemap')");
  });

  it('switches modes without recalculating or replacing plume geometry', () => {
    const setView = script.slice(script.indexOf('async function setPlumeMapView'), script.indexOf('async function clearThreatZones'));
    expect(setView).not.toContain('runBackendPlume(');
    expect(setView).not.toContain('plotPlumeFromControls(');
    expect(setView).toContain('setPlumeMapStyle(buildTacticalPlumeMapStyle(), targetMode)');
    expect(setView).toContain('restorePlumeMapOverlays();');
    expect(script).toContain('const plumeLayerState = { zones: true, centerline: true, distance: false, hazards: false }');
    expect(script).toContain("const plumeSatelliteSourceId = 'plume-satellite-basemap'");
    expect(script).toContain("const plumeTerrainSourceId = 'plume-terrain-dem'");
    expect(script).toContain('plumeMap.setTerrain({ source: plumeTerrainSourceId, exaggeration: 1.05 })');
    expect(script).toContain('currentThreatZoneGeoJson = activeZones;');
    expect(script).toContain('plumeSourceMarker');
  });

  it('keeps Satellite, Street, and 3D Terrain basemap paths separate from Tactical', () => {
    expect(script).toContain("const targetMode = viewName === 'tactical' ? 'tactical' : 'base'");
    expect(script).toContain("activePlumeMapView === 'tactical') return;");
    expect(script).toContain("activePlumeMapView === 'street' ? 'none' : 'visible'");
    expect(script).toContain("type: 'raster-dem'");
    expect(script).toContain("encoding: 'terrarium'");
    expect(script).toContain("type: 'fill-extrusion'");
    expect(script).toContain('fallbackPlumeMapToSatellite');
    expect(script).not.toContain('tactical3d.js');
    expect(script).not.toContain('new Cesium.Viewer');
  });

  it('keeps the release point, overlay controls, and camera actions on the shared map', () => {
    for (const id of ['plume-fit-view-btn', 'plume-recenter-incident-btn', 'plume-recenter-release-btn']) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(script).toContain('async function fitPlumeToView()');
    expect(script).toContain('async function recenterPlumeOnIncident()');
    expect(script).toContain('function recenterPlumeOnRelease()');
    expect(script).toContain('plumeMap.fitBounds(bounds');
    expect(script).toContain('plumeMap.easeTo({ center: [release.lng, release.lat]');
    expect(plumeStyles).toContain('.plume-map-control-label');
  });

  it('retains visible attribution and dark field-ready controls', () => {
    expect(html).toContain('© OpenFreeMap · © OpenMapTiles · Imagery © Esri');
    expect(script).toContain("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/");
    expect(html).not.toContain('plume-tactical-attribution');
    expect(plumeStyles).toContain('#plume.view.active .plume-v2-input-column');
    expect(plumeStyles).toContain('background: linear-gradient(180deg, #0b2943, #061a2e);');
  });
});
