(() => {
  let fallbackMap = null;
  let fallbackMarkers = [];

  const detailedStreetStyle = 'https://tiles.openfreemap.org/styles/liberty';
  const mapStateKey = 'hazmatiq_live_map_state';
  const plumeStateKey = 'hazmatiq_latest_plume_overlay';
  let radarController = null;
  let liveMapBasemapFallbackApplied = false;
  const markerTypes = { icp: 'ICP / Command Post', entry: 'Entry Team', decon: 'Decon Corridor', monitors: 'Monitor', staging: 'Staging', medical: 'Medical / Rehab', trafficCams: 'Traffic Camera' };
  const liveMapStyleKey = 'hazmatiq_live_map_style';
  const liveSatelliteStyle = {
    version: 8,
    sources: {
      'live-satellite-basemap': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      },
    },
    layers: [
      { id: 'live-satellite-background', type: 'background', paint: { 'background-color': '#172b36' } },
      { id: 'live-satellite-basemap', type: 'raster', source: 'live-satellite-basemap', paint: { 'raster-opacity': 1 } },
    ],
  };
  const liveMapStyleModes = { street: detailedStreetStyle, satellite: liveSatelliteStyle, terrain3d: detailedStreetStyle };
  const layerGroups = {
    incident: ['plume', 'icp', 'entry', 'decon', 'staging', 'monitors', 'medical'],
    wildfire: ['wildfireFires', 'wildfirePerimeters', 'wildfireSmoke'],
    facilities: ['tier2Facilities'],
    more: ['trafficCams', 'zones'],
  };

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
    Object.entries(layerGroups).forEach(([group, layers]) => {
      const count = layers.filter((layer) => state.activeLayers[layer]).length;
      const parent = document.querySelector(`[data-layer-group="${group}"]`);
      const countElement = document.querySelector(`[data-layer-count="${group}"]`);
      parent?.classList.toggle('active', count > 0);
      if (countElement) countElement.textContent = String(count);
    });
  }

  function closeLayerMenus(except = null) {
    document.querySelectorAll('[data-layer-menu]').forEach((menu) => {
      const open = menu === except;
      menu.hidden = !open;
      const group = menu.dataset.layerMenu;
      document.querySelector(`[data-layer-group="${group}"]`)?.setAttribute('aria-expanded', String(open));
    });
  }

  function bindTacticalControls() {
    document.querySelectorAll('[data-layer-group]').forEach((button) => {
      button.addEventListener('click', () => {
        const menu = document.querySelector(`[data-layer-menu="${button.dataset.layerGroup}"]`);
        if (!menu) return;
        closeLayerMenus(menu.hidden ? menu : null);
      });
    });
    document.querySelector('[data-map-action="layers"]')?.addEventListener('click', () => {
      const incidentButton = document.querySelector('[data-layer-group="incident"]');
      const menu = document.querySelector('[data-layer-menu="incident"]');
      if (incidentButton && menu) {
        closeLayerMenus(menu);
        incidentButton.focus();
      }
    });
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element) || event.target.closest('.live-map-control-groups')) return;
      closeLayerMenus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeLayerMenus();
    });
    document.querySelectorAll('[data-map-style]').forEach((button) => {
      button.addEventListener('click', () => setLiveMapStyle(button.dataset.mapStyle));
    });
    document.querySelectorAll('[data-map-action]').forEach((button) => {
      const action = button.dataset.mapAction;
      if (action === 'layers') return;
      button.addEventListener('click', () => {
        const map = window.hazmatiqLiveMap || fallbackMap;
        if (action === 'fullscreen') {
          const mapView = document.getElementById('map');
          if (document.fullscreenElement) void document.exitFullscreen();
          else void mapView?.requestFullscreen?.();
          return;
        }
        if (!map) return;
        if (action === 'zoom-in') map.zoomIn();
        if (action === 'zoom-out') map.zoomOut();
        if (action === 'compass') map.resetNorthPitch?.();
        if (action === 'recenter') {
          navigator.geolocation?.getCurrentPosition(({ coords }) => map.easeTo({ center: [coords.longitude, coords.latitude], zoom: 15 }));
        }
      });
    });
    document.querySelectorAll('[data-live-layer]').forEach((button) => {
      button.addEventListener('click', () => window.requestAnimationFrame(() => syncLayerControls(readMapState())));
    });
  }

  function updateMapReadout(map) {
    const center = map.getCenter?.();
    if (!center) return;
    const latitude = Math.abs(center.lat).toFixed(4);
    const longitude = Math.abs(center.lng).toFixed(4);
    const coordinates = document.getElementById('live-map-coordinates');
    if (coordinates) coordinates.textContent = `${latitude}° ${center.lat >= 0 ? 'N' : 'S'} / ${longitude}° ${center.lng >= 0 ? 'E' : 'W'}`;
    const scale = document.getElementById('live-map-scale');
    if (scale) scale.textContent = `SCALE 1:${Math.max(1000, Math.round(24000 / Math.pow(2, Math.max(0, map.getZoom?.() - 14 || 0)))) .toLocaleString()}`;
  }

  function setLiveMapStyle(mode = 'street') {
    const selected = liveMapStyleModes[mode] ? mode : 'street';
    document.querySelectorAll('[data-map-style]').forEach((button) => {
      const active = button.dataset.mapStyle === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    try { window.localStorage.setItem(liveMapStyleKey, selected); } catch { /* In-memory mode is sufficient. */ }
    const map = window.hazmatiqLiveMap || fallbackMap;
    if (!map) return;
    const isSatellite = Boolean(map.getStyle?.()?.sources?.['live-satellite-basemap']);
    if (selected === 'terrain3d' && !isSatellite) {
      map.easeTo({ pitch: 52, bearing: -18, duration: 350 });
      return;
    }
    if (selected === 'street') map.easeTo({ pitch: 0, bearing: 0, duration: 350 });
    const currentStyle = map.getStyle?.();
    if ((selected === 'satellite') !== Boolean(currentStyle?.sources?.['live-satellite-basemap'])) {
      map.once('style.load', () => {
        const state = readMapState();
        syncPlumeOverlay(Boolean(state.activeLayers.plume));
        syncRadarOverlay(Boolean(state.activeLayers.weatherRadar));
        renderFallbackMarkers(state);
        if (selected === 'terrain3d') map.easeTo({ pitch: 52, bearing: -18, duration: 350 });
      });
      map.setStyle(liveMapStyleModes[selected]);
    } else if (selected === 'terrain3d') {
      map.easeTo({ pitch: 52, bearing: -18, duration: 350 });
    }
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
      element.textContent = layer === 'trafficCams' ? 'C' : layer === 'medical' ? '+' : layer === 'monitors' ? 'M' : marker.type.charAt(0);
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

  window.addEventListener('hazmatiq:incident-reset', () => {
    window.HazMatIQ.latestPlumeOverlay = null;
    try { window.localStorage.removeItem(plumeStateKey); } catch { /* The active map still clears below. */ }
    fallbackMarkers.forEach((marker) => marker.remove());
    fallbackMarkers = [];
    try { window.localStorage.removeItem(mapStateKey); } catch { /* The active map still clears below. */ }
    const map = window.hazmatiqLiveMap || fallbackMap;
    if (!map?.isStyleLoaded?.()) return;
    ['live-plume-overlay-outline', 'live-plume-overlay-fill'].forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    if (map.getSource('live-plume-overlay')) map.removeSource('live-plume-overlay');
    const status = document.getElementById('live-plume-status');
    if (status) status.textContent = 'Create a plume on the Plume Model page first.';
  });

  function setMessage(message) {
    const loading = document.getElementById('live-map-loading');
    if (loading) loading.textContent = message;
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
      return;
    }
    document.querySelector('.live-map-stage')?.classList.add('radar-enhanced');
    if (!window.HazMatWeatherRadar) {
      setMessage('Weather radar unavailable.');
      return;
    }
    if (!radarController) {
      radarController = window.HazMatWeatherRadar.createController(map, {
        prefix: 'live-weather-radar',
        beforeLayerId: 'live-plume-overlay-fill',
        providerId: 'BEST_AVAILABLE',
        onFallback: () => setMessage('Primary radar unavailable. NOAA/NWS fallback active.'),
      });
      radarController.setOpacity(0.58);
    }
    void radarController.enable();
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
      // Start on the self-contained raster style so a blocked vector-style
      // request can never leave the map console as a blank navy panel.
      style: liveSatelliteStyle,
    });
    window.hazmatiqLiveMap = fallbackMap;
    fallbackMap.on('move', () => updateMapReadout(fallbackMap));
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
      updateMapReadout(fallbackMap);
      fallbackMap.resize();
      try {
        const storedStyle = window.localStorage.getItem(liveMapStyleKey);
        if (storedStyle) setLiveMapStyle(storedStyle);
      } catch { /* Use the street map default. */ }
    });
    fallbackMap.on('error', (event) => {
      if (radarController?.ownsSource(event?.sourceId)) {
        setMessage('Radar tile failed. Switching to NOAA/NWS fallback.');
        if (radarController.getState().activeProvider?.id !== window.HazMatRadarProviders?.IDS?.NOAA) {
          void radarController.fallback();
        }
      }
      else if (!event?.sourceId && !liveMapBasemapFallbackApplied) {
        liveMapBasemapFallbackApplied = true;
        setMessage('Street basemap unavailable. Satellite map restored.');
        try { setLiveMapStyle('satellite'); } catch { /* Keep the readable current map surface. */ }
      } else setMessage(`Map error: ${event?.error?.message || 'Basemap unavailable.'}`);
    });
    navigator.geolocation?.getCurrentPosition(({ coords }) => {
      fallbackMap.jumpTo({ center: [coords.longitude, coords.latitude], zoom: 15 });
      const gpsStatus = document.querySelector('.live-map-status-item:first-child');
      if (gpsStatus) gpsStatus.innerHTML = '<i class="status-dot is-green"></i><b>GPS</b> LIVE';
    });
  }

  const view = document.getElementById('map');
  if (!view) return;
  bindTacticalControls();
  syncLayerControls(readMapState());
  try {
    const storedStyle = window.localStorage.getItem(liveMapStyleKey);
    if (storedStyle && document.querySelector(`[data-map-style="${storedStyle}"]`)) setLiveMapStyle(storedStyle);
  } catch { /* Use the street map default. */ }
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
