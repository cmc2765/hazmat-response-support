(() => {
  const controllers = new WeakMap();
  const SERVICE_URL = 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer/export';
  const TILE_SIZE = 512;
  const IMAGE_SIZE = 1024;
  const REFRESH_MS = 2 * 60 * 1000;

  function firstLayer(map, predicate) {
    return map.getStyle()?.layers?.find(predicate)?.id;
  }

  function createController(map, options = {}) {
    if (controllers.has(map)) return controllers.get(map);
    const prefix = options.prefix || 'nws-radar';
    const ids = {
      reflectivitySource: `${prefix}-reflectivity`,
      boundarySource: `${prefix}-boundary`,
      reflectivityLayer: `${prefix}-reflectivity-layer`,
      boundaryLayer: `${prefix}-boundary-layer`,
    };
    let enabled = false;
    let refreshTimer = null;
    let refreshVersion = Math.floor(Date.now() / REFRESH_MS);

    const tiles = (layer, version = refreshVersion) => `${SERVICE_URL}?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=${IMAGE_SIZE},${IMAGE_SIZE}&format=png32&transparent=true&layers=show:${layer}&f=image&_radar=${version}`;
    const anchor = () => firstLayer(map, (layer) => layer.id === options.beforeLayerId)
      || firstLayer(map, (layer) => layer.id.includes('plume') && layer.type === 'fill')
      || firstLayer(map, (layer) => layer.type === 'symbol');

    function reorder() {
      const before = anchor();
      if (!before) return;
      for (const id of [ids.reflectivityLayer, ids.boundaryLayer]) {
        if (map.getLayer(id)) map.moveLayer(id, before);
      }
    }

    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      if (!enabled) return;
      refreshTimer = window.setTimeout(refresh, REFRESH_MS);
    }

    function refresh() {
      if (!enabled || document.hidden || !map.isStyleLoaded()) {
        scheduleRefresh();
        return;
      }
      const nextVersion = Math.floor(Date.now() / REFRESH_MS);
      if (nextVersion !== refreshVersion) {
        refreshVersion = nextVersion;
        // Updating existing sources preserves map state, plume geometry, markers, and layer order.
        map.getSource(ids.reflectivitySource)?.setTiles([tiles(3)]);
        map.getSource(ids.boundarySource)?.setTiles([tiles(1)]);
        options.onRefresh?.(new Date());
      }
      scheduleRefresh();
    }

    function add() {
      if (!map.isStyleLoaded()) {
        map.once('style.load', () => enabled && add());
        return;
      }
      if (!map.getSource(ids.reflectivitySource)) map.addSource(ids.reflectivitySource, {
        type: 'raster', tiles: [tiles(3)], tileSize: TILE_SIZE, minzoom: 2, maxzoom: 17,
        attribution: 'NOAA / National Weather Service',
      });
      if (!map.getSource(ids.boundarySource)) map.addSource(ids.boundarySource, {
        type: 'raster', tiles: [tiles(1)], tileSize: TILE_SIZE, minzoom: 2, maxzoom: 17,
        attribution: 'NOAA / National Weather Service',
      });
      const before = anchor();
      if (!map.getLayer(ids.reflectivityLayer)) map.addLayer({
        id: ids.reflectivityLayer, type: 'raster', source: ids.reflectivitySource,
        paint: {
          'raster-opacity': 0.78,
          'raster-resampling': 'linear',
          'raster-contrast': 0.28,
          'raster-saturation': 0.36,
          'raster-brightness-min': 0.04,
          'raster-brightness-max': 1,
          'raster-fade-duration': 350,
        },
      }, before);
      if (!map.getLayer(ids.boundaryLayer)) map.addLayer({
        id: ids.boundaryLayer, type: 'raster', source: ids.boundarySource,
        paint: {
          'raster-opacity': 1,
          'raster-resampling': 'linear',
          'raster-contrast': 0.62,
          'raster-saturation': 0,
          'raster-brightness-min': 0,
          'raster-brightness-max': 1,
          'raster-fade-duration': 350,
        },
      }, before);
      reorder();
      options.onAvailability?.(true);
      scheduleRefresh();
    }

    function remove() {
      window.clearTimeout(refreshTimer);
      for (const id of [ids.boundaryLayer, ids.reflectivityLayer]) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [ids.boundarySource, ids.reflectivitySource]) if (map.getSource(id)) map.removeSource(id);
    }

    const controller = {
      ids,
      enable() { enabled = true; add(); },
      disable() { enabled = false; remove(); },
      reorder,
      refresh,
      ownsSource(sourceId) { return sourceId === ids.reflectivitySource || sourceId === ids.boundarySource; },
      isEnabled() { return enabled; },
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && enabled) refresh(); });
    map.on('style.load', () => { if (enabled) add(); });
    controllers.set(map, controller);
    return controller;
  }

  window.HazMatWeatherRadar = { createController, IMAGE_SIZE, TILE_SIZE, REFRESH_MS };
})();
