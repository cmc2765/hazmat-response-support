/* Optional photorealistic Tactical 3D renderer. Loaded only when requested. */
(() => {
  const CESIUM_SCRIPT_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.127/Build/Cesium/Cesium.js';
  const CESIUM_WIDGETS_CSS_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.127/Build/Cesium/Widgets/widgets.css';
  const GOOGLE_TACTICAL_MESSAGE = 'Photorealistic Tactical 3D unavailable — using Satellite.';
  const state = {
    viewer: null,
    tileset: null,
    dataSource: null,
    guideDataSource: null,
    markerEntities: [],
    cesiumPromise: null,
    latestState: null,
    onUnavailable: null,
  };

  function loadStylesheet() {
    if (document.getElementById('cesium-widgets-css')) return;
    const link = document.createElement('link');
    link.id = 'cesium-widgets-css';
    link.rel = 'stylesheet';
    link.href = CESIUM_WIDGETS_CSS_URL;
    document.head.append(link);
  }

  function loadCesium() {
    if (window.Cesium) return Promise.resolve(window.Cesium);
    if (state.cesiumPromise) return state.cesiumPromise;
    window.CESIUM_BASE_URL ||= CESIUM_SCRIPT_URL.slice(0, CESIUM_SCRIPT_URL.lastIndexOf('/') + 1);
    state.cesiumPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-hazmatiq-cesium]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Cesium), { once: true });
        existing.addEventListener('error', () => reject(new Error('CesiumJS could not be loaded.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.async = true;
      script.dataset.hazmatiqCesium = 'true';
      script.src = CESIUM_SCRIPT_URL;
      script.addEventListener('load', () => window.Cesium
        ? resolve(window.Cesium)
        : reject(new Error('CesiumJS loaded without a renderer.')), { once: true });
      script.addEventListener('error', () => reject(new Error('CesiumJS could not be loaded.')), { once: true });
      document.head.append(script);
    }).catch((error) => {
      state.cesiumPromise = null;
      throw error;
    });
    return state.cesiumPromise;
  }

  async function readProviderKey() {
    const configured = window.HazMatIQ?.mapProviderConfig?.googleMapsTileApiKey;
    if (configured) return String(configured).trim();
    const response = await fetch('/api/map/config', { credentials: 'same-origin' });
    if (!response.ok) return '';
    const config = await response.json().catch(() => null);
    return String(config?.googleMapsTileApiKey || '').trim();
  }

  function reportUnavailable(message = GOOGLE_TACTICAL_MESSAGE) {
    state.onUnavailable?.(message);
  }

  function cameraState() {
    if (!state.viewer) return null;
    const camera = state.viewer.camera;
    return {
      heading: camera.heading,
      pitch: camera.pitch,
      roll: camera.roll,
      position: camera.positionWC,
    };
  }

  function setCameraForLocation(location, { duration = 0 } = {}) {
    if (!state.viewer || !location) return;
    const Cesium = window.Cesium;
    const destination = Cesium.Cartesian3.fromDegrees(
      Number(location.lon ?? location.lng),
      Number(location.lat),
      Number(location.height ?? 900),
    );
    const orientation = {
      heading: Cesium.Math.toRadians(Number(location.heading ?? 0)),
      pitch: Cesium.Math.toRadians(Number(location.pitch ?? -48)),
      roll: 0,
    };
    if (duration > 0) state.viewer.camera.flyTo({ destination, orientation, duration });
    else state.viewer.camera.setView({ destination, orientation });
  }

  function removeMarkerEntities() {
    if (!state.viewer) return;
    state.markerEntities.forEach((entity) => state.viewer.entities.remove(entity));
    state.markerEntities = [];
  }

  function addMarker({ location, name, color, glyph }) {
    if (!state.viewer || !location) return;
    const Cesium = window.Cesium;
    const position = Cesium.Cartesian3.fromDegrees(
      Number(location.lon ?? location.lng),
      Number(location.lat),
      Number(location.height ?? 20),
    );
    const entity = state.viewer.entities.add({
      position,
      point: {
        color: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        pixelSize: 12,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: `${glyph} ${name}`,
        font: '700 13px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    state.markerEntities.push(entity);
  }

  function renderMarkers(nextState) {
    removeMarkerEntities();
    addMarker({ location: nextState.releasePoint, name: 'Release Point', color: '#d71920', glyph: 'R' });
    addMarker({ location: nextState.incidentLocation, name: 'Incident', color: '#f6c343', glyph: 'I' });
    (nextState.operationalMarkers || []).forEach((marker) => {
      const layer = String(marker.layer || marker.type || '').toLowerCase();
      const color = layer === 'icp' ? '#55c2ff' : layer === 'staging' ? '#f6c343' : '#75e6a4';
      const glyph = layer === 'icp' ? 'C' : layer === 'staging' ? 'S' : 'M';
      addMarker({ location: marker, name: marker.name || marker.type || 'Monitor', color, glyph });
    });
  }

  async function renderThreatZones(nextState) {
    if (!state.viewer) return;
    const Cesium = window.Cesium;
    if (state.dataSource) {
      state.viewer.dataSources.remove(state.dataSource, true);
      state.dataSource = null;
    }
    if (!nextState.threatZones?.features?.length) return;
    const dataSource = await Cesium.GeoJsonDataSource.load(nextState.threatZones, { clampToGround: true });
    state.dataSource = dataSource;
    state.viewer.dataSources.add(dataSource);
    dataSource.show = nextState.layers?.zones !== false;
    dataSource.entities.values.forEach((entity) => {
      const properties = entity.properties;
      const color = properties?.color?.getValue?.(Cesium.JulianDate.now()) || '#d71920';
      const opacity = Number(properties?.fillOpacity?.getValue?.(Cesium.JulianDate.now()) || 0.24);
      if (entity.polygon) {
        entity.polygon.material = Cesium.Color.fromCssColorString(String(color)).withAlpha(Math.min(0.55, Math.max(0.08, opacity)));
        entity.polygon.outline = true;
        entity.polygon.outlineColor = Cesium.Color.fromCssColorString(String(color)).withAlpha(0.86);
        entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
      }
    });
  }

  async function renderGuides(nextState) {
    if (!state.viewer) return;
    const Cesium = window.Cesium;
    if (state.guideDataSource) {
      state.viewer.dataSources.remove(state.guideDataSource, true);
      state.guideDataSource = null;
    }
    if (!nextState.guideGeoJson?.features?.length) return;
    const dataSource = await Cesium.GeoJsonDataSource.load(nextState.guideGeoJson, { clampToGround: true });
    state.guideDataSource = dataSource;
    state.viewer.dataSources.add(dataSource);
    dataSource.show = nextState.layers?.centerline !== false;
    dataSource.entities.values.forEach((entity) => {
      if (!entity.polyline) return;
      const guideType = entity.properties?.guideType?.getValue?.(Cesium.JulianDate.now());
      entity.polyline.material = Cesium.Color.WHITE.withAlpha(guideType === 'centerline' ? 0.92 : 0.75);
      entity.polyline.width = guideType === 'centerline' ? 3 : 2;
      entity.polyline.clampToGround = true;
    });
  }

  async function sync(nextState = {}) {
    state.latestState = nextState;
    if (!state.viewer) return;
    await renderThreatZones(nextState);
    await renderGuides(nextState);
    renderMarkers(nextState);
    state.viewer.scene.requestRender();
  }

  async function activate(nextState, { onUnavailable, camera } = {}) {
    state.latestState = nextState || {};
    state.onUnavailable = onUnavailable;
    const container = document.getElementById('plume-tactical-3d-map');
    if (!container) throw new Error('Tactical 3D container is unavailable.');
    if (state.viewer) {
      state.viewer.useDefaultRenderLoop = true;
      container.hidden = false;
      state.viewer.resize();
      if (camera?.position) state.viewer.camera.setView({ destination: camera.position, orientation: camera });
      else if (camera?.center) setCameraForLocation({
        lon: camera.center.lng ?? camera.center[0],
        lat: camera.center.lat ?? camera.center[1],
        height: Math.max(500, 22000 / Math.max(1, Number(camera.zoom || 13))),
      });
      await sync(state.latestState);
      return { active: true, reused: true };
    }
    if (!window.WebGLRenderingContext && !window.WebGL2RenderingContext) {
      reportUnavailable();
      throw new Error('WebGL is unavailable.');
    }
    const apiKey = await readProviderKey();
    if (!apiKey) {
      reportUnavailable();
      throw new Error('Google Maps Platform Photorealistic 3D Tiles are not configured.');
    }
    loadStylesheet();
    const Cesium = await loadCesium();
    let viewer = null;
    try {
      viewer = new Cesium.Viewer(container, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        globe: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        vrButton: false,
        requestRenderMode: false,
      });
      viewer.scene.globe.show = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#071522');
      viewer.scene.screenSpaceCameraController.enableRotate = true;
      viewer.scene.screenSpaceCameraController.enableTilt = true;
      viewer.scene.screenSpaceCameraController.enableZoom = true;
      viewer.scene.renderError.addEventListener(() => reportUnavailable());
      const tileset = await Cesium.createGooglePhotorealistic3DTileset(
        { key: apiKey, usingOnlyWithGoogleGeocoder: true },
        { showCreditsOnScreen: true, maximumScreenSpaceError: 8 },
      );
      viewer.scene.primitives.add(tileset);
      state.viewer = viewer;
      state.tileset = tileset;
      container.hidden = false;
      if (camera?.position) viewer.camera.setView({ destination: camera.position, orientation: camera });
      else if (camera?.center) setCameraForLocation({
        lon: camera.center.lng ?? camera.center[0],
        lat: camera.center.lat ?? camera.center[1],
        height: Math.max(500, 22000 / Math.max(1, Number(camera.zoom || 13))),
      });
      else if (nextState.incidentLocation) setCameraForLocation(nextState.incidentLocation);
      await sync(state.latestState);
      return { active: true, reused: false };
    } catch (error) {
      viewer?.destroy?.();
      reportUnavailable();
      throw error;
    }
  }

  function deactivate() {
    if (!state.viewer) return;
    state.viewer.useDefaultRenderLoop = false;
    state.viewer.container.hidden = true;
  }

  function resize() {
    state.viewer?.resize();
  }

  function setLayerVisibility(layerName, visible) {
    if (layerName === 'zones' && state.dataSource) state.dataSource.show = visible;
    if (layerName === 'centerline' && state.guideDataSource) state.guideDataSource.show = visible;
    state.viewer?.scene.requestRender();
  }

  function rotate(degrees) {
    if (!state.viewer) return;
    state.viewer.camera.lookRight(window.Cesium.Math.toRadians(Number(degrees)));
    state.viewer.scene.requestRender();
  }

  function tilt(degrees) {
    if (!state.viewer) return;
    state.viewer.camera.lookUp(window.Cesium.Math.toRadians(Number(degrees)));
    state.viewer.scene.requestRender();
  }

  function resetNorth() {
    if (!state.viewer) return;
    const camera = state.viewer.camera;
    camera.setView({ orientation: { heading: 0, pitch: camera.pitch, roll: camera.roll } });
    state.viewer.scene.requestRender();
  }

  function recenter(kind) {
    const location = kind === 'release'
      ? state.latestState?.releasePoint
      : state.latestState?.incidentLocation;
    if (location) setCameraForLocation(location, { duration: 0.6 });
  }

  function fit() {
    if (!state.viewer) return;
    const positions = [];
    const collect = (location) => {
      if (location) positions.push(window.Cesium.Cartesian3.fromDegrees(Number(location.lon ?? location.lng), Number(location.lat), 0));
    };
    collect(state.latestState?.releasePoint);
    collect(state.latestState?.incidentLocation);
    (state.latestState?.threatZones?.features || []).forEach((feature) => {
      const coordinates = JSON.stringify(feature.geometry?.coordinates || '').match(/-?\d+(?:\.\d+)?/g) || [];
      for (let index = 0; index < coordinates.length; index += 2) {
        const lon = Number(coordinates[index]);
        const lat = Number(coordinates[index + 1]);
        if (Number.isFinite(lon) && Number.isFinite(lat)) collect({ lon, lat });
      }
    });
    if (positions.length) state.viewer.camera.flyToBoundingSphere(window.Cesium.BoundingSphere.fromPoints(positions), { duration: 0.8 });
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.tactical3d = {
    activate,
    cameraState,
    deactivate,
    fit,
    recenter,
    resetNorth,
    resize,
    rotate,
    setLayerVisibility,
    sync,
    tilt,
    unavailableMessage: GOOGLE_TACTICAL_MESSAGE,
  };
})();
