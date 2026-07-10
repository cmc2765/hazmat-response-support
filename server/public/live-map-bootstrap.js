(() => {
  let fallbackMap = null;
  let fallbackMarkers = [];

  const detailedStreetStyle = 'https://tiles.openfreemap.org/styles/liberty';
  const mapStateKey = 'hazmatiq_live_map_state';
  const plumeStateKey = 'hazmatiq_latest_plume_overlay';
  let radarController = null;
  const markerTypes = { icp: 'ICP / Command Post', entry: 'Entry Team', decon: 'Decon Corridor', monitors: 'Monitor', staging: 'Staging', medical: 'Medical / Rehab', trafficCams: 'Traffic Camera' };

  function readMapState() {
    try {
      const state = JSON.parse(window.localStorage.getItem(mapStateKey) || '{}');
      return { ...state, activeLayers: state.activeLayers || {}, markers: state.markers || [], monitors: state.monitors || [] };
    } catch {
      return { activeLayers: {}, markers: [], monitors: [] };
    }
  }

  function writeMapState(state) {
    state.lastUpdated = new Date().toISOString();
    window.localStorage.setItem(mapStateKey, JSON.stringify(state));
  }

  function syncLayerControls(state) {
    document.querySelectorAll('[data-live-layer]').forEach((button) => {
      const enabled = Boolean(state.activeLayers[button.dataset.liveLayer]);
      button.classList.toggle('active', enabled);
      button.setAttribute('aria-pressed', String(enabled));
      const panel = document.querySelector(`[data-live-panel="${button.dataset.liveLayer}"]`);
      if (panel) panel.hidden = !enabled;
    });
  }

  function ensureMarker(state, layer, map) {
    const type = markerTypes[layer];
    if (!type) return;
    const existing = [...state.markers, ...state.monitors].some((marker) => (marker.type === 'Medical / Rehab' ? 'medical' : marker.layer) === layer);
    if (existing) return;
    const center = map.getCenter();
    const marker = { id: `marker-${Date.now()}`, type, name: type, layer, lat: center.lat, lng: center.lng, status: 'Active', timestamp: new Date().toISOString() };
    (layer === 'monitors' ? state.monitors : state.markers).push(marker);
  }

  function renderFallbackMarkers(state) {
    const map = window.hazmatiqLiveMap || fallbackMap;
    if (!map) return;
    fallbackMarkers.forEach((marker) => marker.remove());
    fallbackMarkers = [];
    [...state.markers, ...state.monitors].forEach((marker) => {
      const layer = marker.type === 'Medical / Rehab' ? 'medical' : marker.layer;
      if (!state.activeLayers[layer]) return;
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'live-map-marker';
      element.dataset.layer = layer;
      element.textContent = layer === 'trafficCams' ? '📷' : layer === 'medical' ? '+' : layer === 'monitors' ? 'M' : marker.type.charAt(0);
      element.title = `${marker.name || marker.type} — drag to move`;
      const mapMarker = new window.maplibregl.Marker({ element, draggable: true }).setLngLat([marker.lng, marker.lat]).addTo(map);
      mapMarker.on('dragend', () => {
        const position = mapMarker.getLngLat();
        marker.lng = position.lng;
        marker.lat = position.lat;
        writeMapState(state);
      });
      fallbackMarkers.push(mapMarker);
    });
  }

  function syncPlumeOverlay(enabled) {
    const map = window.hazmatiqLiveMap || fallbackMap;
    if (!map?.isStyleLoaded()) return;
    const sourceId = 'live-plume-overlay';
    const fillId = 'live-plume-overlay-fill';
    const outlineId = 'live-plume-overlay-outline';
    if (!enabled) {
      if (map.getLayer(outlineId)) map.removeLayer(outlineId);
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }
    let overlay = window.HazMatIQ?.latestPlumeOverlay || null;
    try { overlay ||= JSON.parse(window.localStorage.getItem(plumeStateKey) || 'null'); } catch { /* Show the existing empty-state message below. */ }
    const status = document.getElementById('live-plume-status');
    if (!overlay?.plumeGeometry?.features?.length) {
      if (status) status.textContent = 'Create a plume on the Plume Model page first.';
      return;
    }
    if (status) status.textContent = 'Plume Overlay Active';
    if (map.getSource(sourceId)) return map.getSource(sourceId).setData(overlay.plumeGeometry);
    map.addSource(sourceId, { type: 'geojson', data: overlay.plumeGeometry });
    const before = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
    map.addLayer({ id: fillId, type: 'fill', source: sourceId, paint: { 'fill-color': ['coalesce', ['get', 'color'], '#d71920'], 'fill-opacity': 0.2 } }, before);
    map.addLayer({ id: outlineId, type: 'line', source: sourceId, paint: { 'line-color': ['coalesce', ['get', 'color'], '#d71920'], 'line-width': 3, 'line-opacity': 0.9 } }, before);
    radarController?.reorder();
  }

  function setMessage(message) {
    const loading = document.getElementById('live-map-loading');
    if (loading) loading.textContent = message;
  }

  function setRadarUnavailable(unavailable) {
    const status = document.getElementById('live-radar-status');
    const fallback = document.getElementById('live-radar-fallback');
    if (status) status.hidden = unavailable;
    if (fallback) fallback.hidden = !unavailable;
  }

  function removeRadarOverlay(map) {
    radarController?.disable();
    document.querySelector('.live-map-stage')?.classList.remove('radar-enhanced');
  }

  function syncRadarOverlay(enabled) {
    const map = window.hazmatiqLiveMap || fallbackMap;
    if (!map) return;
    if (!map.isStyleLoaded()) {
      map.once('style.load', () => syncRadarOverlay(enabled));
      return;
    }
    if (!enabled) {
      removeRadarOverlay(map);
      setRadarUnavailable(false);
      return;
    }
    setRadarUnavailable(false);
    document.querySelector('.live-map-stage')?.classList.add('radar-enhanced');
    if (!window.HazMatWeatherRadar) {
      setRadarUnavailable(true);
      return;
    }
    radarController ||= window.HazMatWeatherRadar.createController(map, {
      prefix: 'nws-radar',
      beforeLayerId: 'live-plume-overlay-fill',
      onAvailability: () => setRadarUnavailable(false),
    });
    radarController.enable();
  }

  function startFallbackMap() {
    const view = document.getElementById('map');
    const container = document.getElementById('live-gis-map');
    if (!view?.classList.contains('active') || !container || container.querySelector('.maplibregl-canvas')) return;
    if (!window.maplibregl) {
      setMessage('Map library unavailable.');
      return;
    }
    setMessage('Starting map…');
    fallbackMap = new window.maplibregl.Map({
      container: 'live-gis-map',
      center: [-86.81, 33.29],
      zoom: 14,
      style: detailedStreetStyle,
    });
    window.hazmatiqLiveMap = fallbackMap;
    fallbackMap.addControl(new window.maplibregl.NavigationControl(), 'bottom-right');
    fallbackMap.on('style.load', () => {
      const state = readMapState();
      Object.keys(markerTypes).forEach((layer) => {
        if (state.activeLayers[layer]) ensureMarker(state, layer, fallbackMap);
      });
      writeMapState(state);
      syncLayerControls(state);
      syncRadarOverlay(Boolean(state.activeLayers.weatherRadar));
      syncPlumeOverlay(Boolean(state.activeLayers.plume));
      renderFallbackMarkers(state);
      document.querySelector('.live-map-stage')?.classList.add('map-ready');
      fallbackMap.resize();
    });
    fallbackMap.on('error', (event) => {
      if (radarController?.ownsSource(event?.sourceId)) setRadarUnavailable(true);
      else setMessage(`Map error: ${event?.error?.message || 'Basemap unavailable.'}`);
    });
    navigator.geolocation?.getCurrentPosition(({ coords }) => {
      fallbackMap.jumpTo({ center: [coords.longitude, coords.latitude], zoom: 15 });
    });
  }

  const view = document.getElementById('map');
  if (!view) return;
  const radarButton = document.querySelector('[data-live-layer="weatherRadar"]');
  let radarWasEnabled = false;
  radarButton?.addEventListener('click', () => {
    radarWasEnabled = radarButton.getAttribute('aria-pressed') === 'true';
  }, { capture: true });
  radarButton?.addEventListener('click', () => {
    let enabled = radarButton.getAttribute('aria-pressed') === 'true';
    // Handle the toggle here when the main Live Map script did not attach its listener.
    if (enabled === radarWasEnabled) {
      enabled = !enabled;
      radarButton.classList.toggle('active', enabled);
      radarButton.setAttribute('aria-pressed', String(enabled));
      const panel = document.querySelector('[data-live-panel="weatherRadar"]');
      if (panel) panel.hidden = !enabled;
    }
    const state = readMapState();
    state.activeLayers.weatherRadar = enabled;
    writeMapState(state);
    syncRadarOverlay(enabled);
  });
  document.querySelectorAll('[data-live-layer]:not([data-live-layer="weatherRadar"])').forEach((button) => {
    let wasEnabled = false;
    button.addEventListener('click', () => {
      wasEnabled = button.getAttribute('aria-pressed') === 'true';
    }, { capture: true });
    button.addEventListener('click', () => {
      let enabled = button.getAttribute('aria-pressed') === 'true';
      if (enabled !== wasEnabled) return;
      enabled = !enabled;
      const layer = button.dataset.liveLayer;
      button.classList.toggle('active', enabled);
      button.setAttribute('aria-pressed', String(enabled));
      const panel = document.querySelector(`[data-live-panel="${layer}"]`);
      if (panel) panel.hidden = !enabled;
      const state = readMapState();
      state.activeLayers[layer] = enabled;
      const map = window.hazmatiqLiveMap || fallbackMap;
      if (enabled && map) ensureMarker(state, layer, map);
      writeMapState(state);
      if (layer === 'plume') syncPlumeOverlay(enabled);
      renderFallbackMarkers(state);
    });
  });
  window.addEventListener('hazmatiq:plume-updated', (event) => {
    if (event.detail?.plumeGeometry?.features?.length) {
      window.HazMatIQ ||= {};
      window.HazMatIQ.latestPlumeOverlay = event.detail;
    }
    const state = readMapState();
    if (state.activeLayers.plume) syncPlumeOverlay(true);
  });
  const scheduleFallbackMap = () => window.setTimeout(startFallbackMap, 300);
  new MutationObserver(() => {
    if (view.classList.contains('active')) scheduleFallbackMap();
  }).observe(view, { attributes: true, attributeFilter: ['class'] });
  if (view.classList.contains('active')) scheduleFallbackMap();
})();
