/* Standalone Weather Intelligence workspace. Weather owns its location and
   environmental layers; it never reads or mutates Incident Command state. */
(() => {
  const weatherLocationStorageKey = 'hazscope_weather_location';
  const alertSourceId = 'weather-alerts';
  const alertFillLayerId = 'weather-alerts-fill';
  const alertLineLayerId = 'weather-alerts-line';
  const alertHighlightSourceId = 'weather-alert-highlight';
  const alertHighlightFillLayerId = 'weather-alert-highlight-fill';
  const alertHighlightLineLayerId = 'weather-alert-highlight-line';
  const windSourceId = 'weather-wind';
  const windLineLayerId = 'weather-wind-line';
  const windArrowLayerId = 'weather-wind-arrow';
  const floodMarkerClass = 'weather-flood-marker';
  const fireSourceIds = { firms: 'weather-fire-firms', perimeters: 'weather-fire-perimeters', smoke: 'weather-fire-smoke' };
  const fireLayerIds = ['weather-fire-firms-points', 'weather-fire-perimeters-fill', 'weather-fire-perimeters-line', 'weather-fire-smoke-fill', 'weather-fire-smoke-line'];
  let initialized = false;
  let weatherMap = null;
  let weatherRadar = null;
  let weatherLocation = null;
  let weatherLocationSource = '';
  let weatherMarker = null;
  let weatherAlerts = [];
  let weatherAlertsStatus = 'Awaiting location';
  let weatherConditionState = null;
  let weatherFireData = { firms: [], perimeters: [], smoke: [] };
  let weatherFireMarkers = [];
  let weatherFirePopup = null;
  let weatherFloodData = { gauges: [], sources: [], retrievedAt: null };
  let weatherFloodMarkers = [];
  let weatherFloodPopup = null;
  let weatherWindPopup = null;
  let weatherWindData = null;
  let weatherWindHour = 0;
  let weatherWindCache = null;
  let weatherFloodCache = null;
  let weatherFireCache = null;
  let weatherWindAbort = null;
  let weatherFloodAbort = null;
  let weatherFireAbort = null;
  let weatherAlertsCache = null;
  let weatherLayerMoveTimer = null;
  let weatherLastLayerBoundsKey = '';
  let weatherRefreshToken = 0;
  let weatherFirePopupFeatureId = null;
  let weatherAlertHighlightTimer = null;
  let windLayerEnabled = false;
  let floodLayerEnabled = false;
  let fireLayerEnabled = false;
  let alertsLayerEnabled = true;

  const service = () => window.HazMatIQ?.weatherService;
  const writeText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  const number = (value, digits = 1, suffix = '') => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? `${Number(value).toFixed(digits)}${suffix}` : 'Unavailable';
  const compass = (value) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(Number(value) / 45) % 8] || 'unknown direction';
  const direction = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? `${Math.round(Number(value))}° ${typeof window.degreesToCompass === 'function' ? window.degreesToCompass(Number(value)) : compass(Number(value))}` : 'Unavailable';
  const boundsKey = (bounds) => bounds ? [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].map((value) => Number(value).toFixed(2)).join(',') : '';
  const currentBounds = () => weatherMap?.getBounds?.() || null;

  function validLocation(value) {
    const lat = Number(value?.lat ?? value?.latitude);
    const lon = Number(value?.lon ?? value?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
      ? { lat, lon, displayAddress: String(value?.displayAddress || value?.address || '').trim(), source: String(value?.source || 'Saved Weather location'), updatedAt: value?.updatedAt || new Date().toISOString() }
      : null;
  }

  function readWeatherLocationState() {
    try { return validLocation(JSON.parse(window.localStorage.getItem(weatherLocationStorageKey) || 'null')); } catch { return null; }
  }

  function saveWeatherLocationState(location) {
    const normalized = validLocation(location);
    if (!normalized) return null;
    normalized.updatedAt = new Date().toISOString();
    weatherLocation = normalized;
    weatherLocationSource = normalized.source;
    try { window.localStorage.setItem(weatherLocationStorageKey, JSON.stringify(normalized)); } catch { /* Session state remains usable. */ }
    return normalized;
  }

  function clearWeatherLocationState() {
    weatherLocation = null;
    weatherLocationSource = '';
    try { window.localStorage.removeItem(weatherLocationStorageKey); } catch { /* Ignore storage restrictions. */ }
  }

  function setLocationStatus(message) { writeText('weather-location-status', message); }
  function updateLocationDisplay(location) {
    writeText('weather-location-display', location?.displayAddress || (location ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : 'Choose a location for this workspace'));
    const input = document.getElementById('weather-location-input');
    if (input && location?.displayAddress) input.value = location.displayAddress;
  }

  function placeWeatherMarker(location) {
    if (!weatherMap || !window.maplibregl || !location) return;
    weatherMarker?.remove();
    const element = document.createElement('div');
    element.className = 'weather-incident-marker';
    element.setAttribute('aria-label', 'Selected Weather Intelligence location');
    element.textContent = '●';
    weatherMarker = new window.maplibregl.Marker({ element }).setLngLat([location.lon, location.lat]).addTo(weatherMap);
  }

  function radarState(state = {}) {
    const frame = document.getElementById('weather-radar-frame');
    const frameTime = document.getElementById('weather-radar-frame-time');
    const sourceStatus = document.getElementById('weather-radar-status');
    const source = document.getElementById('weather-radar-source');
    const play = document.getElementById('weather-radar-play');
    if (source && state.selectedProviderId) source.value = state.selectedProviderId;
    if (frame) {
      frame.max = String(Math.max(0, (state.frameCount || 1) - 1));
      frame.value = String(Math.max(0, state.frameIndex || 0));
      frame.disabled = !state.frameCount || state.frameCount < 2;
    }
    if (frameTime) frameTime.textContent = state.timestamp ? new Date(state.timestamp).toLocaleString() : 'Latest frame unavailable';
    if (play) { play.textContent = state.animationPlaying ? 'Pause Radar' : 'Play Radar'; play.disabled = !state.enabled || !state.supportsAnimation; }
    const status = state.enabled ? `${state.providerName || 'Radar'} · ${state.status || 'Connected'}${state.fallbackMessage ? ` · ${state.fallbackMessage}` : ''}` : 'Radar is off';
    if (sourceStatus) sourceStatus.textContent = status;
    const radarButton = document.getElementById('weather-layer-radar');
    if (radarButton) {
      radarButton.classList.toggle('active', Boolean(state.enabled));
      radarButton.setAttribute('aria-pressed', String(Boolean(state.enabled)));
    }
    writeText('weather-radar-service-status', state.enabled ? (state.error ? 'Unavailable' : 'Connected') : 'Off');
    if (state.error) writeText('weather-map-status', 'Radar temporarily unavailable · basemap remains available.');
  }

  function ensureRadar() {
    if (weatherRadar || !weatherMap || !window.HazMatWeatherRadar) return weatherRadar;
    weatherRadar = window.HazMatWeatherRadar.createController(weatherMap, {
      prefix: 'weather-radar',
      onStateChange: radarState,
      onFallback: () => setLocationStatus('Radar fallback active. Basemap and current weather remain available.'),
      onAvailability: (available) => writeText('weather-radar-service-status', available ? 'Connected' : 'Unavailable'),
    });
    weatherRadar.setOpacity(document.getElementById('weather-radar-opacity')?.value || 0.58);
    return weatherRadar;
  }

  function alertPriority(properties = {}) {
    const severity = String(properties.severity || '').toLowerCase();
    const event = String(properties.event || '').toLowerCase();
    if (severity === 'extreme' || severity === 'severe' || /warning/.test(event)) return 'warning';
    if (severity === 'moderate' || /watch/.test(event)) return 'watch';
    return 'advisory';
  }

  function removeAlertLayers() {
    if (!weatherMap) return;
    if (weatherMap.getLayer(alertFillLayerId)) weatherMap.removeLayer(alertFillLayerId);
    if (weatherMap.getLayer(alertLineLayerId)) weatherMap.removeLayer(alertLineLayerId);
    if (weatherMap.getSource(alertSourceId)) weatherMap.removeSource(alertSourceId);
  }

  function removeAlertHighlight() {
    window.clearInterval(weatherAlertHighlightTimer);
    weatherAlertHighlightTimer = null;
    if (!weatherMap) return;
    if (weatherMap.getLayer(alertHighlightFillLayerId)) weatherMap.removeLayer(alertHighlightFillLayerId);
    if (weatherMap.getLayer(alertHighlightLineLayerId)) weatherMap.removeLayer(alertHighlightLineLayerId);
    if (weatherMap.getSource(alertHighlightSourceId)) weatherMap.removeSource(alertHighlightSourceId);
  }

  function extendAlertBounds(coordinates, bounds) {
    if (!Array.isArray(coordinates)) return false;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') { bounds.extend([coordinates[0], coordinates[1]]); return true; }
    return coordinates.reduce((found, value) => extendAlertBounds(value, bounds) || found, false);
  }

  function alertGeometryBounds(geometry) {
    if (!geometry?.coordinates || !window.maplibregl?.LngLatBounds) return null;
    const bounds = new window.maplibregl.LngLatBounds();
    return extendAlertBounds(geometry.coordinates, bounds) ? bounds : null;
  }

  function flashAlertOnMap(impact) {
    const alert = weatherAlerts.find((feature, index) => String(feature?.id || `alert-${index}`) === String(impact?.alertKey));
    if (!alert?.geometry) { setMapLayerStatus(`${impact?.title || 'Alert'} · no map boundary is available.`); return; }
    if (!weatherMap?.isStyleLoaded?.()) { setMapLayerStatus('Weather map is still loading; alert boundary unavailable.'); return; }
    removeAlertHighlight();
    const feature = { ...alert, properties: { ...(alert.properties || {}), weatherPriority: alertPriority(alert.properties) } };
    weatherMap.addSource(alertHighlightSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [feature] } });
    weatherMap.addLayer({ id: alertHighlightFillLayerId, type: 'fill', source: alertHighlightSourceId, paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.34 } });
    weatherMap.addLayer({ id: alertHighlightLineLayerId, type: 'line', source: alertHighlightSourceId, paint: { 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 1 } });
    const bounds = alertGeometryBounds(alert.geometry);
    if (bounds) weatherMap.fitBounds(bounds, { padding: 56, maxZoom: 10, duration: 550 });
    setMapLayerStatus(`${impact.title} · alert boundary highlighted on map.`);
    let pulse = 0;
    weatherAlertHighlightTimer = window.setInterval(() => {
      if (!weatherMap.getLayer(alertHighlightFillLayerId) || !weatherMap.getLayer(alertHighlightLineLayerId)) { removeAlertHighlight(); return; }
      pulse += 1;
      const visible = pulse % 2 === 1;
      weatherMap.setPaintProperty(alertHighlightFillLayerId, 'fill-opacity', visible ? 0.52 : 0.12);
      weatherMap.setPaintProperty(alertHighlightLineLayerId, 'line-opacity', visible ? 1 : 0.28);
      if (pulse >= 8) { window.clearInterval(weatherAlertHighlightTimer); weatherAlertHighlightTimer = null; weatherMap.setPaintProperty(alertHighlightFillLayerId, 'fill-opacity', 0.26); weatherMap.setPaintProperty(alertHighlightLineLayerId, 'line-opacity', 0.95); }
    }, 220);
  }

  function setLayerButton(layer, active) {
    const button = document.getElementById(`weather-layer-${layer}`);
    if (!button) return;
    button.classList.toggle('active', Boolean(active));
    button.setAttribute('aria-pressed', String(Boolean(active)));
  }

  function setMapLayerStatus(message) {
    writeText('weather-map-status', message);
  }

  function removeWindOverlay() {
    if (!weatherMap) return;
    closeWeatherPopups();
    if (weatherMap.getLayer(windArrowLayerId)) weatherMap.removeLayer(windArrowLayerId);
    if (weatherMap.getLayer(windLineLayerId)) weatherMap.removeLayer(windLineLayerId);
    if (weatherMap.getSource(windSourceId)) weatherMap.removeSource(windSourceId);
    const legend = document.getElementById('weather-wind-legend');
    if (legend) legend.hidden = true;
  }

  function ensureWindLegend() {
    const shell = document.querySelector('.weather-map-shell');
    if (!shell) return null;
    let legend = document.getElementById('weather-wind-legend');
    if (!legend) {
      legend = document.createElement('div'); legend.id = 'weather-wind-legend'; legend.className = 'weather-wind-legend';
      const title = document.createElement('strong'); title.textContent = 'WIND';
      const directionText = document.createElement('span'); directionText.textContent = 'Arrow = direction wind travels';
      const reading = document.createElement('small'); reading.id = 'weather-wind-legend-reading';
      legend.append(title, directionText, reading); shell.append(legend);
    }
    return legend;
  }

  function windCoordinate(origin, bearingDegrees, distance) {
    const bearing = Number(bearingDegrees) * Math.PI / 180;
    const latitude = Number(origin[1]);
    return [
      origin[0] + (Math.sin(bearing) * distance) / Math.max(0.25, Math.cos(latitude * Math.PI / 180)),
      origin[1] + Math.cos(bearing) * distance,
    ];
  }

  function renderWindOverlay() {
    if (!weatherMap?.isStyleLoaded?.()) return;
    removeWindOverlay();
    if (!windLayerEnabled || !weatherWindData?.points?.length) return;
    const features = [];
    weatherWindData.points.forEach((point) => {
      const forecast = point.forecast?.[Math.min(weatherWindHour, Math.max(0, point.forecast.length - 1))];
      const windFrom = Number(forecast?.windFromDeg);
      if (!Number.isFinite(windFrom)) return;
      const windTo = (windFrom + 180) % 360;
      const origin = [Number(point.lon), Number(point.lat)];
      const distance = 0.055;
      const end = windCoordinate(origin, windTo, distance);
      const arrowHeadDistance = distance * 0.28;
      const arrowLeft = windCoordinate(end, windTo + 150, arrowHeadDistance);
      const arrowRight = windCoordinate(end, windTo - 150, arrowHeadDistance);
      const properties = { windSpeedMph: forecast.windSpeedMph, gustMph: forecast.gustMph, windFromDeg: windFrom, windToDeg: windTo };
      features.push({ type: 'Feature', properties: { ...properties, windPart: 'shaft' }, geometry: { type: 'LineString', coordinates: [origin, end] } });
      features.push({ type: 'Feature', properties: { ...properties, windPart: 'arrowhead' }, geometry: { type: 'LineString', coordinates: [end, arrowLeft] } });
      features.push({ type: 'Feature', properties: { ...properties, windPart: 'arrowhead' }, geometry: { type: 'LineString', coordinates: [end, arrowRight] } });
    });
    if (!features.length) return;
    weatherMap.addSource(windSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } });
    weatherMap.addLayer({ id: windLineLayerId, type: 'line', source: windSourceId, filter: ['==', ['get', 'windPart'], 'shaft'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#55c9f4', 'line-width': 2.5, 'line-opacity': 0.86 } });
    weatherMap.addLayer({ id: windArrowLayerId, type: 'line', source: windSourceId, filter: ['==', ['get', 'windPart'], 'arrowhead'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f6c343', 'line-width': 3.8, 'line-opacity': 0.98 } });
    const sample = weatherWindData.points[0]?.forecast?.[Math.min(weatherWindHour, Math.max(0, (weatherWindData.points[0]?.forecast?.length || 1) - 1))];
    const legend = ensureWindLegend();
    if (legend) legend.hidden = false;
    const windTo = Number.isFinite(Number(sample?.windFromDeg)) ? (Number(sample.windFromDeg) + 180) % 360 : null;
    const windReading = `FROM ${direction(sample?.windFromDeg)} · TO ${direction(windTo)} · ${number(sample?.windSpeedMph, 1, ' mph')} · GUST ${number(sample?.gustMph, 1, ' mph')}`;
    writeText('weather-wind-status', `WIND ${weatherWindHour ? `+${weatherWindHour} HR` : 'CURRENT'} · ${windReading}`);
    writeText('weather-wind-legend-reading', windReading);
  }

  function showWindPopup(properties, lngLat) {
    if (!weatherMap || !lngLat) return;
    closeWeatherPopups();
    const content = document.createElement('div');
    content.className = 'weather-wind-popup';
    const title = document.createElement('strong');
    title.textContent = 'WIND VECTOR';
    content.append(title);
    [['Wind from', direction(properties?.windFromDeg)], ['Wind to', direction(properties?.windToDeg)], ['Speed', number(properties?.windSpeedMph, 1, ' mph')], ['Gust', number(properties?.gustMph, 1, ' mph')]].forEach(([label, value]) => {
      const row = document.createElement('small');
      row.textContent = `${label}: ${value}`;
      content.append(row);
    });
    const note = document.createElement('em');
    note.textContent = 'Arrow shows the direction the wind travels.';
    content.append(note);
    weatherWindPopup = new window.maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 14 }).setLngLat(lngLat).setDOMContent(content).addTo(weatherMap);
    weatherWindPopup.on('close', () => { weatherWindPopup = null; });
  }

  function setWindTime(hour) {
    weatherWindHour = Number(hour) || 0;
    document.querySelectorAll('[data-weather-wind-time]').forEach((button) => button.classList.toggle('active', Number(button.dataset.weatherWindTime) === weatherWindHour));
    renderWindOverlay();
  }

  async function loadWindOverlay({ force = false } = {}) {
    if (!weatherMap || !windLayerEnabled) return;
    const bounds = currentBounds();
    const key = boundsKey(bounds);
    if (!bounds || (Number(weatherMap.getZoom?.()) || 0) < 6) { setMapLayerStatus('Wind layer · zoom in to load detailed vectors.'); writeText('weather-wind-service-status', 'Zoom in required'); return; }
    if (!force && weatherWindCache?.key === key && Date.now() - weatherWindCache.fetchedAt < 10 * 60 * 1000) { weatherWindData = weatherWindCache.value; renderWindOverlay(); return; }
    weatherWindAbort?.abort(); weatherWindAbort = new AbortController();
    const token = weatherWindAbort;
    const params = new URLSearchParams({ west: String(bounds.getWest()), south: String(bounds.getSouth()), east: String(bounds.getEast()), north: String(bounds.getNorth()), zoom: String(weatherMap.getZoom?.() || 9) });
    writeText('weather-wind-service-status', 'Loading'); setMapLayerStatus('Wind layer loading · Open-Meteo 10 m forecast grid…');
    try {
      const response = await fetch(`/api/weather/wind?${params}`, { signal: token.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Wind provider unavailable');
      const value = await response.json();
      if (token !== weatherWindAbort || !windLayerEnabled) return;
      weatherWindData = value; weatherWindCache = { key, fetchedAt: Date.now(), value };
      writeText('weather-wind-service-status', 'Ready'); renderWindOverlay(); setMapLayerStatus(`Wind layer active · ${value.points?.length || 0} vectors · arrows point TO; labels show WIND FROM.`);
    } catch (error) { if (error?.name === 'AbortError') return; writeText('weather-wind-service-status', 'Unavailable'); setMapLayerStatus('Wind layer unavailable · basemap and other layers remain available.'); }
  }

  function floodCategoryClass(gauge) {
    const category = String(gauge?.category || '').toLowerCase();
    if (/major|warning/.test(category)) return 'major';
    if (/moderate|minor/.test(category)) return 'minor';
    if (/action|near/.test(category)) return 'action';
    return 'normal';
  }

  function showFloodPopup(gauge) {
    if (!weatherMap) return;
    closeWeatherPopups();
    const content = document.createElement('div'); content.className = 'weather-flood-popup';
    const title = document.createElement('strong'); title.textContent = String(gauge?.name || gauge?.id || 'Flood gauge').toUpperCase(); content.append(title);
    [['Stage', number(gauge.stageFt, 1, ' ft')], ['Flood stage', number(gauge.floodStageFt, 1, ' ft')], ['Forecast crest', number(gauge.forecastCrestFt, 1, ' ft')], ['Flow', number(gauge.flowCfs, 0, ' cfs')], ['Category', gauge.category || 'Official category unavailable'], ['Observed', gauge.observedAt ? new Date(gauge.observedAt).toLocaleString() : 'Unavailable']].forEach(([label, value]) => { const row = document.createElement('small'); row.textContent = `${label}: ${value}`; content.append(row); });
    const source = document.createElement('em'); source.textContent = `${gauge.source} · Retrieved ${weatherFloodData.retrievedAt ? new Date(weatherFloodData.retrievedAt).toLocaleTimeString() : 'Unavailable'}`; content.append(source);
    weatherFloodPopup = new window.maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 16 }).setLngLat([gauge.lon, gauge.lat]).setDOMContent(content).addTo(weatherMap);
  }

  function removeFloodOverlay() {
    weatherFloodMarkers.forEach((marker) => marker.remove()); weatherFloodMarkers = []; closeWeatherPopups();
  }

  function renderFloodOverlay() {
    if (!weatherMap || !floodLayerEnabled) return;
    removeFloodOverlay();
    weatherFloodData.gauges.forEach((gauge) => {
      const marker = document.createElement('button'); marker.type = 'button'; marker.className = `${floodMarkerClass} weather-flood-${floodCategoryClass(gauge)}`; marker.title = gauge.name; marker.setAttribute('aria-label', `Flood gauge ${gauge.name}`); marker.innerHTML = '<span>≈</span>';
      marker.addEventListener('click', (event) => { event.stopPropagation(); showFloodPopup(gauge); });
      weatherFloodMarkers.push(new window.maplibregl.Marker({ element: marker, anchor: 'center' }).setLngLat([gauge.lon, gauge.lat]).addTo(weatherMap));
    });
  }

  async function loadFloodOverlay({ force = false } = {}) {
    if (!weatherMap || !floodLayerEnabled) return;
    const bounds = currentBounds(); const key = boundsKey(bounds);
    if (!bounds || (Number(weatherMap.getZoom?.()) || 0) < 7) { setMapLayerStatus('Flood layer · zoom in to load nearby gauges.'); writeText('weather-flood-service-status', 'Zoom in required'); return; }
    if (!force && weatherFloodCache?.key === key && Date.now() - weatherFloodCache.fetchedAt < 10 * 60 * 1000) { weatherFloodData = weatherFloodCache.value; renderFloodOverlay(); return; }
    weatherFloodAbort?.abort(); weatherFloodAbort = new AbortController(); const token = weatherFloodAbort;
    const params = new URLSearchParams({ west: String(bounds.getWest()), south: String(bounds.getSouth()), east: String(bounds.getEast()), north: String(bounds.getNorth()), zoom: String(weatherMap.getZoom?.() || 9) });
    writeText('weather-flood-service-status', 'Loading'); setMapLayerStatus('Flood layer loading · NOAA NWPS and USGS gauge feeds…');
    try {
      const response = await fetch(`/api/hydrology/flood?${params}`, { signal: token.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Flood provider unavailable');
      const value = await response.json(); if (token !== weatherFloodAbort || !floodLayerEnabled) return;
      weatherFloodData = value; weatherFloodCache = { key, fetchedAt: Date.now(), value }; writeText('weather-flood-service-status', value.gauges?.length ? 'Ready' : 'No gauges in view'); renderFloodOverlay(); setMapLayerStatus(value.gauges?.length ? `Flood layer active · ${value.gauges.length} nearby gauge${value.gauges.length === 1 ? '' : 's'}.` : 'Flood layer active · no nearby gauges returned.');
    } catch (error) { if (error?.name === 'AbortError') return; writeText('weather-flood-service-status', 'Unavailable'); setMapLayerStatus('Flood layer unavailable · basemap and other layers remain available.'); }
  }

  function removeFireOverlay() {
    if (!weatherMap) return;
    weatherFireMarkers.forEach((marker) => marker.remove());
    weatherFireMarkers = [];
    closeWeatherFirePopup();
    fireLayerIds.slice().reverse().forEach((id) => { if (weatherMap.getLayer(id)) weatherMap.removeLayer(id); });
    Object.values(fireSourceIds).forEach((id) => { if (weatherMap.getSource(id)) weatherMap.removeSource(id); });
  }

  function fireType(feature) {
    const source = String(feature?.properties?.source || feature?.source || '').toLowerCase();
    if (source.includes('firms')) return 'NASA FIRMS active fire detection';
    if (source.includes('wfigs') || source.includes('perimeter')) return 'NIFC / WFIGS wildfire perimeter';
    if (source.includes('hms') || source.includes('smoke')) return 'NOAA HMS smoke plume';
    return 'Wildland / fire-related environmental feed';
  }

  function fireFeatureId(feature) {
    const coordinates = feature?.geometry?.coordinates;
    return String(feature?.id || `${coordinates?.[0] || ''}:${coordinates?.[1] || ''}:${feature?.properties?.detectedAt || ''}`);
  }

  function closeWeatherFirePopup() {
    closeWeatherPopups();
  }

  function closeWeatherPopups() {
    weatherFirePopup?.remove?.();
    weatherFloodPopup?.remove?.();
    weatherWindPopup?.remove?.();
    weatherFirePopup = null;
    weatherFloodPopup = null;
    weatherWindPopup = null;
    weatherFirePopupFeatureId = null;
  }

  function fireMarkerElement(feature) {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'weather-fire-marker';
    marker.setAttribute('aria-label', fireType(feature));
    marker.title = fireType(feature);
    marker.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.2 2.2c.9 3.3-.8 4.8-2.3 6.3-1.1 1.1-2.1 2.2-2.1 4.2 0 2.3 1.8 4.1 4.2 4.1 2.8 0 4.8-2.1 4.8-4.9 0-1.5-.7-3-2.1-4.5.1 2-1 2.9-1.9 3.5.2-2.9-.1-5.6-.6-8.7Z"/><path class="weather-fire-marker-core" d="M12.1 11.3c.7 1.1 1 2 1 2.9 0 1.1-.7 1.9-1.8 1.9-1 0-1.8-.8-1.8-1.8 0-.8.4-1.4 1-2 .5-.5 1-1 1.6-2Z"/></svg>';
    marker.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); showFirePopup(feature); });
    return marker;
  }

  function showFirePopup(feature) {
    const coordinates = feature?.geometry?.coordinates;
    if (!weatherMap || !Array.isArray(coordinates)) return;
    const featureId = fireFeatureId(feature);
    if (weatherFirePopup && weatherFirePopupFeatureId === featureId) { closeWeatherFirePopup(); return; }
    closeWeatherPopups();
    weatherFirePopupFeatureId = featureId;
    const properties = feature.properties || {};
    const content = document.createElement('div');
    content.className = 'weather-fire-popup';
    const title = document.createElement('strong'); title.textContent = fireType(feature).toUpperCase();
    const source = document.createElement('span'); source.textContent = `Source: ${properties.source || feature.source || 'Environmental feed'}`;
    content.append(title, source);
    const rows = [];
    if (properties.detectedAt) rows.push(['Detected', new Date(properties.detectedAt).toLocaleString()]);
    if (properties.satellite) rows.push(['Satellite', properties.satellite]);
    if (properties.instrument) rows.push(['Instrument', properties.instrument]);
    if (properties.confidence) rows.push(['Confidence', properties.confidence]);
    if (properties.frp !== null && properties.frp !== undefined) rows.push(['Fire radiative power', `${properties.frp} MW`]);
    if (properties.incidentName) rows.push(['Incident', properties.incidentName]);
    if (properties.acres) rows.push(['Reported acres', Number(properties.acres).toLocaleString()]);
    rows.forEach(([label, value]) => { const row = document.createElement('small'); row.textContent = `${label}: ${value}`; content.append(row); });
    const note = document.createElement('em'); note.textContent = properties.source === 'NASA FIRMS' ? 'SATELLITE THERMAL DETECTION · Not confirmation of a structure fire.' : 'Environmental fire feed; verify conditions in the field.'; content.append(note);
    weatherFirePopup = new window.maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 16 }).setLngLat(coordinates).setDOMContent(content).addTo(weatherMap);
    weatherFirePopup.on('close', () => { if (weatherFirePopupFeatureId === featureId) { weatherFirePopup = null; weatherFirePopupFeatureId = null; } });
  }

  function renderFireMarkers() {
    if (!weatherMap || !fireLayerEnabled) return;
    weatherFireData.firms.forEach((feature) => {
      if (feature?.geometry?.type !== 'Point') return;
      weatherFireMarkers.push(new window.maplibregl.Marker({ element: fireMarkerElement(feature), anchor: 'center' }).setLngLat(feature.geometry.coordinates).addTo(weatherMap));
    });
  }

  function renderFireOverlay() {
    if (!weatherMap?.isStyleLoaded?.()) return;
    removeFireOverlay();
    if (!fireLayerEnabled) return;
    const addSource = (id, features) => {
      if (!features.length) return false;
      weatherMap.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features } });
      return true;
    };
    if (addSource(fireSourceIds.perimeters, weatherFireData.perimeters)) {
      weatherMap.addLayer({ id: 'weather-fire-perimeters-fill', type: 'fill', source: fireSourceIds.perimeters, paint: { 'fill-color': '#ff5a36', 'fill-opacity': 0.12 } });
      weatherMap.addLayer({ id: 'weather-fire-perimeters-line', type: 'line', source: fireSourceIds.perimeters, paint: { 'line-color': '#ffb347', 'line-width': 2, 'line-opacity': 0.9 } });
    }
    if (addSource(fireSourceIds.smoke, weatherFireData.smoke)) {
      weatherMap.addLayer({ id: 'weather-fire-smoke-fill', type: 'fill', source: fireSourceIds.smoke, paint: { 'fill-color': '#b5c2c9', 'fill-opacity': 0.18 } });
      weatherMap.addLayer({ id: 'weather-fire-smoke-line', type: 'line', source: fireSourceIds.smoke, paint: { 'line-color': '#e0e7eb', 'line-width': 1.3, 'line-opacity': 0.6 } });
    }
    renderFireMarkers();
  }

  async function fetchFireFeed(endpoint, bounds, signal) {
    const params = new URLSearchParams({ west: String(bounds.getWest()), east: String(bounds.getEast()), south: String(bounds.getSouth()), north: String(bounds.getNorth()), hours: '24' });
    const response = await fetch(`${endpoint}?${params}`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Fire source unavailable');
    const payload = await response.json();
    return Array.isArray(payload.features) ? payload.features : [];
  }

  async function loadFireOverlay({ force = false } = {}) {
    if (!weatherMap || !fireLayerEnabled) return;
    const bounds = weatherMap.getBounds?.();
    if (!bounds) return;
    const key = boundsKey(bounds);
    if (!force && weatherFireCache?.key === key && Date.now() - weatherFireCache.fetchedAt < 7 * 60 * 1000) { weatherFireData = weatherFireCache.value; renderFireOverlay(); return; }
    setMapLayerStatus('Fire layer loading · FIRMS, WFIGS, and NOAA smoke feeds…');
    writeText('weather-fire-service-status', 'Loading');
    weatherFireAbort?.abort(); weatherFireAbort = new AbortController(); const token = weatherFireAbort;
    const [firms, perimeters, smoke] = await Promise.allSettled([
      fetchFireFeed('/api/wildfire/firms', bounds, token.signal),
      fetchFireFeed('/api/wildfire/perimeters', bounds, token.signal),
      fetchFireFeed('/api/wildfire/smoke', bounds, token.signal),
    ]);
    if (token !== weatherFireAbort || !fireLayerEnabled) return;
    weatherFireData = {
      firms: firms.status === 'fulfilled' ? firms.value : [],
      perimeters: perimeters.status === 'fulfilled' ? perimeters.value : [],
      smoke: smoke.status === 'fulfilled' ? smoke.value : [],
    };
    weatherFireCache = { key, fetchedAt: Date.now(), value: weatherFireData };
    const count = Object.values(weatherFireData).reduce((total, features) => total + features.length, 0);
    renderFireOverlay();
    writeText('weather-fire-service-status', count ? 'Ready' : 'No features in view');
    setMapLayerStatus(count ? `Fire layer active · ${count} feed features in view.` : 'Fire layer active · no feed features in the current map view.');
  }

  function renderAlertPolygons() {
    if (!weatherMap?.isStyleLoaded?.()) return;
    removeAlertLayers();
    if (!alertsLayerEnabled || !weatherAlerts.length) return;
    const features = weatherAlerts.filter((feature) => feature?.geometry).map((feature) => ({ ...feature, properties: { ...(feature.properties || {}), weatherPriority: alertPriority(feature.properties) } }));
    if (!features.length) return;
    weatherMap.addSource(alertSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } });
    weatherMap.addLayer({ id: alertFillLayerId, type: 'fill', source: alertSourceId, paint: { 'fill-color': ['match', ['get', 'weatherPriority'], 'warning', '#d92b38', 'watch', '#e87924', '#f6c343'], 'fill-opacity': 0.18 } });
    weatherMap.addLayer({ id: alertLineLayerId, type: 'line', source: alertSourceId, paint: { 'line-color': ['match', ['get', 'weatherPriority'], 'warning', '#ff5962', 'watch', '#ff9d3d', '#f6c343'], 'line-width': 2.2, 'line-opacity': 0.9 } });
  }

  function createMap(location) {
    if (!window.maplibregl || !location || weatherMap) return weatherMap;
    const infrastructure = window.HazMatIQ?.mapInfrastructure || {};
    const container = document.getElementById('weather-map');
    if (!container) return null;
    weatherMap = new window.maplibregl.Map({ container, center: [location.lon, location.lat], zoom: 9, style: infrastructure.satelliteStyle?.() || 'https://tiles.openfreemap.org/styles/liberty', preserveDrawingBuffer: true });
    weatherMap.addControl(new window.maplibregl.NavigationControl(), 'bottom-right');
    weatherMap.on('load', () => { ensureRadar(); void weatherRadar?.enable(); centerMap(weatherLocation); setMapLayerStatus('Weather map ready · latest radar loading.'); renderAlertPolygons(); renderWindOverlay(); renderFloodOverlay(); if (fireLayerEnabled) void loadFireOverlay(); });
    weatherMap.on('style.load', () => { renderAlertPolygons(); renderWindOverlay(); renderFloodOverlay(); renderFireOverlay(); if (weatherRadar?.isEnabled?.()) void weatherRadar.refresh(); });
    weatherMap.on('click', (event) => {
      const target = event.originalEvent?.target;
      if (target?.closest?.('.weather-fire-marker, .weather-flood-marker')) return;
      const windLayers = [windArrowLayerId, windLineLayerId].filter((id) => weatherMap.getLayer?.(id));
      const windFeature = event.point && windLayers.length ? weatherMap.queryRenderedFeatures?.(event.point, { layers: windLayers })?.[0] : null;
      if (windFeature) {
        showWindPopup(windFeature.properties || {}, event.lngLat);
        return;
      }
      closeWeatherPopups();
    });
    weatherMap.on('moveend', () => { window.clearTimeout(weatherLayerMoveTimer); weatherLayerMoveTimer = window.setTimeout(() => { const nextKey = boundsKey(currentBounds()); if (nextKey === weatherLastLayerBoundsKey) return; weatherLastLayerBoundsKey = nextKey; if (windLayerEnabled) void loadWindOverlay(); if (floodLayerEnabled) void loadFloodOverlay(); if (fireLayerEnabled) void loadFireOverlay(); }, 700); });
    weatherMap.on('error', (event) => { if (event?.error?.message) writeText('weather-map-status', `Basemap notice: ${event.error.message}`); });
    return weatherMap;
  }

  function centerMap(location, { animate = false } = {}) {
    if (!weatherMap || !location) return;
    const method = animate ? 'easeTo' : 'jumpTo';
    weatherMap[method]({ center: [location.lon, location.lat], zoom: Math.max(weatherMap.getZoom?.() || 9, 9) });
    weatherMap.resize(); placeWeatherMarker(location);
    writeText('weather-map-location-readout', `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)} · ${weatherLocationSource || location.source || 'Selected Weather location'}`);
  }

  function renderConditions(state) {
    const current = state?.current;
    const freshness = state?.freshness || service()?.getFreshness?.(current?.observedAt);
    const source = current?.station || current?.source || (state?.openMeteo ? 'Open-Meteo current conditions' : 'Unavailable');
    const windFrom = Number(current?.windDirDeg);
    const feelsLike = number(current?.feelsLikeF, 1, ' °F');
    writeText('weather-temperature', number(current?.temperatureF, 1, ' °F')); writeText('weather-feels-like', `Feels like ${feelsLike === 'Unavailable' ? '— unavailable' : feelsLike}`);
    writeText('weather-wind-from', direction(windFrom)); writeText('weather-wind-speed', `${number(current?.windSpeedMph, 1, ' mph')} · From`); writeText('weather-wind-to', direction(Number.isFinite(windFrom) ? (windFrom + 180) % 360 : null));
    writeText('weather-gusts', number(current?.gustMph, 1, ' mph')); writeText('weather-humidity', `Humidity ${number(current?.rh, 0, '%')}`); writeText('weather-pressure', number(current?.pressureInHg, 2, ' inHg'));
    writeText('weather-cloud-cover', number(current?.cloudCoverPct, 0, '%')); writeText('weather-precipitation', `Precipitation ${number(current?.precipitationIn, 2, ' in')}`); writeText('weather-visibility', number(current?.visibilityMiles, 1, ' mi')); writeText('weather-dew-point', number(current?.dewPointF, 1, ' °F'));
    writeText('weather-source', source); writeText('weather-observation-time', `Observed ${current?.observedAt ? new Date(current.observedAt).toLocaleString() : 'Unavailable'}`); writeText('weather-retrieved-time', `Retrieved ${state?.retrievedAt ? new Date(state.retrievedAt).toLocaleTimeString() : 'Unavailable'}`);
    writeText('weather-visibility-status', Number.isFinite(Number(current?.visibilityMiles)) ? `${source} reported` : 'Not provided by current source');
    const badge = document.getElementById('weather-freshness-badge');
    if (badge) { badge.textContent = freshness?.status?.toUpperCase() || 'UNAVAILABLE'; badge.dataset.state = freshness?.status === 'Current' ? 'current' : freshness?.status?.toLowerCase().replace(/[^a-z]+/g, '-') || 'unavailable'; }
  }

  function forecastItems(state) {
    const forecast = state?.openMeteo?.forecast || [];
    return [1, 6, 12, 24].map((hours) => {
      const target = Date.now() + hours * 60 * 60 * 1000;
      const item = forecast.reduce((best, candidate) => !best || Math.abs(Date.parse(candidate.time) - target) < Math.abs(Date.parse(best.time) - target) ? candidate : best, null);
      return item ? { hours, item } : null;
    }).filter(Boolean);
  }

  function forecastWeatherKind(item) {
    const code = Number(item?.weatherCode);
    const rain = Number(item?.precipitationProbability);
    if (Number.isFinite(code) && code >= 95) return 'storm';
    if (Number.isFinite(code) && [71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ((Number.isFinite(code) && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))) || rain >= 55) return 'rain';
    if (Number.isFinite(code) && [45, 48].includes(code)) return 'fog';
    if (Number.isFinite(code) && code >= 1 && code <= 3) return 'cloud';
    return 'clear';
  }

  function createForecastGraphic(item) {
    const graphic = document.createElement('div');
    graphic.className = 'weather-forecast-card-graphic';
    graphic.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 64');
    svg.setAttribute('focusable', 'false');
    const kind = forecastWeatherKind(item);
    const iconMarkup = {
      clear: '<circle cx="82" cy="22" r="13" fill="#ffd166"/><path d="M82 3v6M82 35v6M63 22h-6M101 22h6M69 9l-4-4M95 35l4 4M95 9l4-4M69 35l-4 4" fill="none" stroke="#ffed9a" stroke-linecap="round" stroke-width="3"/><path d="M12 51h96" fill="none" stroke="#37b4d8" stroke-linecap="round" stroke-width="4"/>',
      cloud: '<circle cx="83" cy="19" r="12" fill="#ffd166"/><path d="M20 48c0-8 6-14 14-14 2 0 4 .3 6 1 3-7 9-11 17-11 9 0 16 6 18 14 2-.6 4-.9 6-.9 8 0 14 5 15 11H20Z" fill="#62c8e5" stroke="#d7f7ff" stroke-width="2"/><path d="M13 56h94" fill="none" stroke="#2d8fb9" stroke-linecap="round" stroke-width="4"/>',
      rain: '<path d="M14 42c0-8 6-14 14-14 2 0 4 .3 6 1 3-7 9-11 17-11 9 0 16 6 18 14 2-.6 4-.9 6-.9 8 0 14 5 15 11H14Z" fill="#388bb6" stroke="#d7f7ff" stroke-width="2"/><path d="M34 48l-5 11M57 48l-5 11M80 48l-5 11" fill="none" stroke="#6ee7ff" stroke-linecap="round" stroke-width="4"/><path d="M99 13v15M91.5 20.5h15" stroke="#bcefff" stroke-linecap="round" stroke-width="2"/>',
      snow: '<path d="M14 42c0-8 6-14 14-14 2 0 4 .3 6 1 3-7 9-11 17-11 9 0 16 6 18 14 2-.6 4-.9 6-.9 8 0 14 5 15 11H14Z" fill="#5b8fc0" stroke="#ecfbff" stroke-width="2"/><path d="M34 50v12M28 56h12M30 52l8 8M38 52l-8 8M62 50v12M56 56h12M58 52l8 8M66 52l-8 8" fill="none" stroke="#b8ecff" stroke-linecap="round" stroke-width="2"/>',
      storm: '<path d="M13 40c0-8 6-14 14-14 2 0 4 .3 6 1 3-7 9-11 17-11 9 0 16 6 18 14 2-.6 4-.9 6-.9 8 0 14 5 15 11H13Z" fill="#42628f" stroke="#d7f7ff" stroke-width="2"/><path d="m61 42-9 13h8l-4 9 15-17h-9l7-5Z" fill="#ffd166" stroke="#fff1a8" stroke-linejoin="round" stroke-width="2"/><path d="M91 49l-4 10M103 49l-4 10" stroke="#69ddff" stroke-linecap="round" stroke-width="3"/>',
      fog: '<path d="M21 29c3-7 9-11 17-11 8 0 15 5 17 13 2-.6 4-.9 6-.9 7 0 13 4 15 10H21Z" fill="#80a9c2" stroke="#ecfbff" stroke-width="2"/><path d="M13 46h94M21 55h78M33 64h55" fill="none" stroke="#d1f6ff" stroke-linecap="round" stroke-width="4"/>'
    }[kind];
    svg.innerHTML = iconMarkup;
    graphic.append(svg);
    return graphic;
  }

  function renderForecast(state) {
    const grid = document.getElementById('weather-forecast-grid'); if (!grid) return;
    grid.replaceChildren(); const items = forecastItems(state);
    if (!items.length) { grid.innerHTML = '<p>Forecast unavailable from the current weather response.</p>'; writeText('weather-forecast-status', 'Unavailable'); return; }
    writeText('weather-forecast-status', `${items.length} horizons`);
    items.forEach(({ hours, item }) => {
      const card = document.createElement('article');
      const time = document.createElement('strong');
      const temp = document.createElement('b');
      const details = document.createElement('small');
      time.textContent = `${hours} HOUR`;
      temp.textContent = number(item.temperatureF, 0, ' °F');
      details.textContent = `${direction(item.windDirDeg)} · gust ${number(item.gustMph, 0, ' mph')} · rain ${number(item.precipitationProbability, 0, '%')}`;
      card.append(time, createForecastGraphic(item), temp, details);
      grid.append(card);
    });
  }

  function alertCategory(feature) { const properties = feature?.properties || {}; const priority = alertPriority(properties); return { priority, label: priority === 'warning' ? 'WARNING' : priority === 'watch' ? 'WATCH' : 'ADVISORY' }; }
  function alertDateTime(value) {
    const date = new Date(value);
    if (!value || !Number.isFinite(date.getTime())) return null;
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '');
    return { date: `${month} ${day} ${year}`, time };
  }
  function formatAlertTimeWindow(properties = {}) {
    const began = alertDateTime(properties.sent || properties.effective || properties.onset);
    const expires = alertDateTime(properties.expires || properties.ends);
    if (began && expires) return began.date === expires.date ? `${began.date} · ${began.time}–${expires.time}` : `${began.date} ${began.time}–${expires.date} ${expires.time}`;
    if (began) return `${began.date} · ${began.time}–EXPIRY UNKNOWN`;
    if (expires) return `BEGIN TIME UNKNOWN · EXPIRES ${expires.date} ${expires.time}`;
    return 'TIME WINDOW UNAVAILABLE';
  }
  function angularDifference(a, b) { const first = Number(a); const second = Number(b); if (!Number.isFinite(first) || !Number.isFinite(second)) return null; return Math.abs(((second - first + 540) % 360) - 180); }
  function forecastAt(state, hours) {
    const forecast = state?.openMeteo?.forecast || [];
    const target = Date.now() + hours * 60 * 60 * 1000;
    return forecast.reduce((best, item) => !best || Math.abs(Date.parse(item.time) - target) < Math.abs(Date.parse(best.time) - target) ? item : best, null);
  }

  function buildOperationalWeatherImpacts(weatherState, alertState = []) {
    const current = weatherState?.current;
    const impacts = [];
    const severityRank = { critical: 0, significant: 1, advisory: 2, informational: 3 };
    const add = (impact) => impacts.push({ category: 'GENERAL OPERATIONS', severity: 'advisory', source: 'Open-Meteo / NWS', ...impact });
    const f1 = forecastAt(weatherState, 1);
    const f3 = forecastAt(weatherState, 3);
    const f6 = forecastAt(weatherState, 6);
    const alertList = Array.isArray(alertState) ? alertState : [];
    const sortImpacts = () => impacts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
    alertList.forEach((alert, alertIndex) => {
      const properties = alert?.properties || {};
      const event = String(properties.event || 'Weather alert').trim();
      const normalized = event.toLowerCase();
      const alertKey = String(alert.id || `alert-${alertIndex}`);
      const category = alertCategory(alert);
      const severe = /tornado|flash flood|severe thunderstorm|hurricane|winter storm|ice storm/.test(normalized);
      const severity = category.priority === 'warning' ? (severe ? 'critical' : 'significant') : category.priority === 'watch' ? 'advisory' : 'informational';
      let summary = 'Review exposed operations, shelter options, and access conditions.';
      if (/flash flood|flood/.test(normalized)) summary = 'Low-lying access routes and drainage areas may become compromised.';
      else if (/tornado|severe thunderstorm|wind/.test(normalized)) summary = 'Strong winds may affect exposed operations and scene stability.';
      else if (/winter|ice|snow/.test(normalized)) summary = 'Cold, ice, or snow may affect access, equipment, and responder endurance.';
      add({ id: `alert-${alertKey}`, alertKey, category: 'ALERTS', severity, title: event.toUpperCase(), summary, detail: properties.description || properties.instruction || properties.headline || 'Review the active NWS alert for full details.', values: `${properties.areaDesc || 'Area unavailable'} · ${category.label}`, timeWindow: formatAlertTimeWindow(properties), alert: true });
    });
    if (!current) return impacts.length ? sortImpacts() : [{ id: 'weather-data-required', category: 'GENERAL OPERATIONS', severity: 'informational', title: 'WEATHER DATA REQUIRED', summary: 'Choose a Weather location to calculate operational impacts.', detail: 'Weather remains independent from Incident Command and requires an explicit workspace location.', values: 'Awaiting current conditions' }];

    const currentWind = Number(current.windDirDeg);
    const forecastWind = Number(f3?.windDirDeg);
    const shift = angularDifference(currentWind, forecastWind);
    if (shift !== null && shift >= 30) add({ id: 'wind-shift', category: 'HAZMAT', severity: 'significant', title: 'WIND SHIFT EXPECTED', summary: 'Reassess downwind control zones and monitoring locations before the shift.', detail: 'Operational weather heuristic. Use the current and near-term forecast together; this is not a plume-model result.', values: `Current ${Math.round(currentWind)}° ${compass(currentWind)} → ${Math.round(forecastWind)}° ${compass(forecastWind)} · Shift ${Math.round(shift)}°`, source: 'Open-Meteo forecast' });

    const sustained = Number(current.windSpeedMph);
    const gust = Number(current.gustMph);
    if (Number.isFinite(sustained) && Number.isFinite(gust) && gust - sustained >= 15) add({ id: 'gust-variability', category: 'RESPONDER SAFETY', severity: gust >= 35 ? 'significant' : 'advisory', title: 'SIGNIFICANT GUST VARIABILITY', summary: 'Gusts are substantially above sustained wind and may affect exposed operations.', detail: 'Review aircraft, apparatus, ladders, tents, signage, and loose equipment against agency and manufacturer limits.', values: `Wind ${Math.round(sustained)} mph · Gust ${Math.round(gust)} mph` });
    else if (gust >= 25 || sustained >= 25) add({ id: 'high-wind', category: 'FIRE / SMOKE', severity: gust >= 35 ? 'significant' : 'advisory', title: 'HIGH WIND', summary: 'Wind may increase smoke movement and change scene conditions rapidly.', detail: 'Fire behavior and smoke movement require field confirmation; no structural-fire tactical order is implied.', values: `Wind ${number(sustained, 0, ' mph')} · Gust ${number(gust, 0, ' mph')}` });

    const rainForecast = [f1, f3, f6].find((item) => Number(item?.precipitationProbability) >= 60 || Number(item?.precipitationIn) >= 0.05);
    const currentRain = Number(current.precipitationIn) >= 0.05;
    if (currentRain || rainForecast) add({ id: 'rain-runoff', category: 'HAZMAT', severity: Number(rainForecast?.precipitationProbability) >= 80 ? 'significant' : 'advisory', title: currentRain ? 'RAIN / RUNOFF CONCERN' : 'RAIN BEGINNING SOON', summary: 'Review runoff, storm drains, decon containment, access routes, and electrical equipment.', detail: 'Rain effects depend on local drainage and site conditions; confirm observations at the scene.', values: currentRain ? `Current precipitation ${number(current.precipitationIn, 2, ' in')}` : `Forecast probability ${number(rainForecast?.precipitationProbability, 0, '%')}` });

    const temperature = Number(current.temperatureF);
    const humidity = Number(current.rh);
    if (temperature >= 90 && humidity >= 50) add({ id: 'heat-stress', category: 'RESPONDER SAFETY', severity: temperature >= 100 ? 'significant' : 'advisory', title: 'RESPONDER HEAT STRESS', summary: 'Heat and humidity may increase responder heat load and endurance concerns.', detail: 'Review rehab, hydration, work-rest cycles, and PPE burden using agency guidance.', values: `Temperature ${number(temperature, 0, ' °F')} · Humidity ${number(humidity, 0, '%')}` });
    else if (temperature <= 32) add({ id: 'cold-stress', category: 'RESPONDER SAFETY', severity: 'advisory', title: 'COLD STRESS', summary: 'Low temperature may affect responder endurance, decon, and equipment performance.', detail: 'Consider freezing conditions and field shelter requirements.', values: `Temperature ${number(temperature, 0, ' °F')}` });

    if (Number(current.visibilityMiles) < 3) add({ id: 'low-visibility', category: 'UAS / AVIATION', severity: 'significant', title: 'LOW VISIBILITY', summary: 'Reduced visibility may affect driving, apparatus placement, and aerial observation.', detail: 'Review aircraft and agency visibility requirements; no flight restriction is inferred.', values: `Visibility ${number(current.visibilityMiles, 1, ' mi')}` });
    if (Number(current.rh) <= 30 && Number(f3?.windSpeedMph) > sustained + 5) add({ id: 'wildland-spread', category: 'WILDLAND', severity: 'advisory', title: 'DRY, INCREASING WIND', summary: 'The environment may support increased fire spread and smoke transport.', detail: 'Use weather-supported observations with current fire behavior and local intelligence.', values: `Humidity ${number(current.rh, 0, '%')} · Wind trend ${number(sustained, 0, ' → ')}${number(f3?.windSpeedMph, 0, ' mph')}` });
    if (Number(current.weatherCode) >= 95 || Number(f1?.weatherCode) >= 95) add({ id: 'thunderstorm-signal', category: 'RESPONDER SAFETY', severity: 'significant', title: 'THUNDERSTORM CONDITIONS', summary: 'Review exposed operations, accountability, and shelter options.', detail: 'Lightning is not inferred from this signal; use an authoritative lightning feed when available.', values: 'Provider reports thunderstorm conditions' });

    sortImpacts();
    return impacts.length ? impacts : [{ id: 'no-significant-impact', category: 'GENERAL OPERATIONS', severity: 'informational', title: 'NO SIGNIFICANT OPERATIONAL WEATHER IMPACTS IDENTIFIED', summary: 'Conditions appear generally stable from the current data.', detail: 'Continue monitoring current observations, near-term forecast changes, and active alerts.', values: 'No prioritized weather heuristic triggered' }];
  }

  function renderOperationalImpacts(weatherState) {
    const list = document.getElementById('weather-impact-list');
    if (!list) return;
    const impacts = buildOperationalWeatherImpacts(weatherState, weatherAlerts);
    const moreButton = document.getElementById('weather-impact-more');
    const expanded = moreButton?.dataset.expanded === 'true';
    const visible = expanded ? impacts : impacts.slice(0, 5);
    list.replaceChildren(...visible.map((impact) => {
      const item = document.createElement('li'); item.className = `weather-impact-row weather-impact-${impact.severity}`;
      const icon = document.createElement('span'); icon.className = 'weather-impact-icon'; icon.textContent = impact.severity === 'critical' ? '!' : impact.category === 'HAZMAT' ? '◈' : impact.category === 'RESPONDER SAFETY' ? '✚' : impact.category === 'UAS / AVIATION' ? '↑' : impact.category === 'WILDLAND' ? '△' : '•';
      const body = document.createElement('div'); body.className = 'weather-impact-body'; const heading = document.createElement('div'); heading.className = 'weather-impact-heading'; const title = document.createElement('strong'); title.textContent = impact.title; const badge = document.createElement('span'); badge.textContent = impact.severity.toUpperCase(); heading.append(title); if (impact.alert) { const timeWindow = document.createElement('time'); timeWindow.className = 'weather-impact-time'; timeWindow.setAttribute('aria-label', `Alert time window: ${impact.timeWindow || 'unavailable'}`); timeWindow.textContent = impact.timeWindow || 'TIME WINDOW UNAVAILABLE'; heading.append(timeWindow); } heading.append(badge); if (impact.alert) { const mapHint = document.createElement('span'); mapHint.className = 'weather-impact-map-hint'; mapHint.textContent = 'MAP'; mapHint.setAttribute('aria-hidden', 'true'); heading.append(mapHint); item.classList.add('weather-impact-map-target'); item.setAttribute('role', 'button'); item.setAttribute('tabindex', '0'); item.setAttribute('aria-label', `${impact.title}. Click to highlight this alert on the map.`); item.title = 'Click to highlight this alert on the map'; const highlight = () => { document.querySelectorAll('.weather-impact-map-target.is-selected').forEach((selected) => selected.classList.remove('is-selected')); item.classList.add('is-selected'); flashAlertOnMap(impact); }; item.addEventListener('click', (event) => { if (!event.target.closest('details')) highlight(); }); item.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); highlight(); } }); } const summary = document.createElement('p'); summary.textContent = impact.summary; body.append(heading, summary); if (impact.values) { const values = document.createElement('small'); values.textContent = impact.values; body.append(values); } if (impact.detail) { const details = document.createElement('details'); const summaryNode = document.createElement('summary'); summaryNode.textContent = impact.alert ? 'VIEW ALERT' : 'WHY?'; const detail = document.createElement('p'); detail.textContent = impact.detail; details.append(summaryNode, detail); body.append(details); } item.append(icon, body); return item;
    }));
    if (moreButton) { moreButton.hidden = impacts.length <= 5; moreButton.textContent = expanded ? 'SHOW LESS' : `+ ${impacts.length - 5} MORE`; }
    writeText('weather-impact-status', weatherState?.current ? `${impacts.length} IMPACTS` : 'Awaiting data');
    renderSendToCommandAction();
  }

  function renderAlerts(alerts = []) {
    weatherAlerts = Array.isArray(alerts) ? alerts : [];
    const counts = { warning: 0, watch: 0, advisory: 0 };
    weatherAlerts.forEach((alert) => { counts[alertCategory(alert).priority] += 1; });
    writeText('weather-warning-count', String(counts.warning)); writeText('weather-watch-count', String(counts.watch)); writeText('weather-advisory-count', String(counts.advisory)); writeText('weather-nws-status', weatherAlertsStatus); writeText('weather-alert-status', weatherAlerts.length ? `${weatherAlerts.length} active NWS alert${weatherAlerts.length === 1 ? '' : 's'}` : 'No active NWS alerts');
    const button = document.getElementById('weather-layer-alerts'); if (button) { button.disabled = false; button.classList.toggle('active', alertsLayerEnabled); button.setAttribute('aria-pressed', String(alertsLayerEnabled)); button.title = weatherAlerts.some((feature) => feature.geometry) ? 'Toggle NWS alert polygons' : 'NWS alerts are available in Operational Impacts; this feed has no polygon geometry.'; }
    renderAlertPolygons(); renderOperationalImpacts(weatherConditionState);
  }

  function renderSendToCommandAction() {
    const button = document.getElementById('weather-send-to-command');
    if (!button) return;
    const incident = window.HazMatIQ?.incidentCommandLegacy?.getActiveIncident?.();
    button.hidden = !incident;
    button.title = incident ? `Send this weather assessment to ${incident.incidentName || 'the active incident'}` : 'Start an incident to send an assessment.';
  }

  function buildWeatherAssessmentRecord() {
    const current = weatherConditionState?.current;
    const impacts = buildOperationalWeatherImpacts(weatherConditionState, weatherAlerts);
    const createdAt = new Date().toISOString();
    const windFromDeg = current?.windDirDeg;
    const forecastWindow = [1, 3, 6].map((hours) => { const item = forecastAt(weatherConditionState, hours); return item ? { hours, temperatureF: item.temperatureF, windSpeedMph: item.windSpeedMph, windDirDeg: item.windDirDeg, gustMph: item.gustMph, precipitationProbability: item.precipitationProbability, weatherCode: item.weatherCode } : null; }).filter(Boolean);
    return {
      id: `weather-brief-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      incidentId: window.HazMatIQ?.incidentCommandLegacy?.getActiveIncident?.()?.incidentId || null,
      createdAt,
      createdBy: 'Weather Intelligence',
      weatherLocation: weatherLocation ? { lat: weatherLocation.lat, lon: weatherLocation.lon, displayAddress: weatherLocation.displayAddress, source: weatherLocation.source } : null,
      currentConditions: current ? { temperatureF: current.temperatureF, feelsLikeF: current.feelsLikeF, humidity: current.rh, pressureInHg: current.pressureInHg, windFromDeg, windToDeg: Number.isFinite(Number(windFromDeg)) ? (Number(windFromDeg) + 180) % 360 : null, windSpeedMph: current.windSpeedMph, gustMph: current.gustMph, visibilityMi: current.visibilityMiles, precipitation: current.precipitationIn, dewPointF: current.dewPointF, source: current.station || current.source, observedAt: current.observedAt } : null,
      operationalImpacts: impacts.slice(0, 5).map(({ id, category, severity, title, summary, values, source }) => ({ id, category, severity, title, summary, values, source })),
      activeAlerts: weatherAlerts.slice(0, 5).map((alert) => ({ id: alert.id, event: alert.properties?.event || 'Weather alert', severity: alert.properties?.severity || '', area: alert.properties?.areaDesc || '', sent: alert.properties?.sent || null, expires: alert.properties?.expires || null })),
      forecastSummary: forecastWindow,
      sourceSummary: ['Open-Meteo forecast', weatherConditionState?.nws ? 'NWS observation' : null, weatherAlerts.length ? 'NWS active alerts' : null].filter(Boolean),
      observationTime: current?.observedAt || null,
      retrievedAt: weatherConditionState?.retrievedAt || createdAt,
      acknowledgedAt: null,
    };
  }

  function sendWeatherAssessmentToCommand() {
    const api = window.HazMatIQ?.incidentCommandLegacy;
    const incident = api?.getActiveIncident?.();
    const status = document.getElementById('weather-send-status');
    if (!incident || !weatherConditionState?.current) { if (status) status.textContent = 'No active incident or current weather assessment is available.'; return; }
    const record = buildWeatherAssessmentRecord();
    const top = record.operationalImpacts[0];
    const text = [`WEATHER BRIEF · ${new Date(record.createdAt).toLocaleTimeString()}`, `Wind from ${number(record.currentConditions.windFromDeg, 0, '°')} at ${number(record.currentConditions.windSpeedMph, 0, ' mph')} · Gust ${number(record.currentConditions.gustMph, 0, ' mph')}`, top?.title ? `${top.title}: ${top.summary}` : 'No significant operational weather impacts identified.', `Source: ${record.sourceSummary.join(' / ') || 'Weather source unavailable'}`].join('\n');
    const notes = Array.isArray(incident.incidentNotes) ? incident.incidentNotes : [];
    const briefs = Array.isArray(incident.weatherBriefs) ? incident.weatherBriefs : [];
    const next = { ...incident, incidentNotes: [...notes, { createdAt: record.createdAt, text, source: 'Weather Intelligence', weatherBriefId: record.id }], weatherBriefs: [...briefs, record], latestCommandWeatherBrief: record, updatedAt: record.createdAt };
    const incidents = api.readIncidents?.() || [];
    api.writeIncidents?.(incidents.map((item) => item.incidentId === incident.incidentId ? next : item));
    api.renderIncidentCommandDashboard?.();
    window.dispatchEvent(new CustomEvent('hazmatiq:weather-brief-received', { detail: { brief: record, incident: next } }));
    if (status) status.textContent = `Weather assessment sent to ${incident.incidentName || 'the active incident'}.`;
  }

  function renderWeatherState(state) { weatherConditionState = state; renderConditions(state); renderForecast(state); renderOperationalImpacts(state); renderWindOverlay(); writeText('weather-forecast-service-status', state?.openMeteo?.forecast?.length ? 'Available' : 'Unavailable'); }

  async function fetchAlerts(location) {
    const key = `${Number(location.lat).toFixed(3)},${Number(location.lon).toFixed(3)}`;
    if (weatherAlertsCache?.key === key && Date.now() - weatherAlertsCache.fetchedAt < 3 * 60 * 1000) { weatherAlertsStatus = 'Cached'; return weatherAlertsCache.value; }
    try { const response = await fetch(`/api/weather/alerts?lat=${encodeURIComponent(location.lat)}&lon=${encodeURIComponent(location.lon)}`, { cache: 'no-store' }); if (!response.ok) throw new Error('NWS alert feed unavailable'); const payload = await response.json(); weatherAlertsStatus = 'Connected'; const value = Array.isArray(payload.features) ? payload.features : []; weatherAlertsCache = { key, fetchedAt: Date.now(), value }; return value; } catch { weatherAlertsStatus = 'Unavailable'; writeText('weather-alert-status', 'NWS alert feed unavailable'); return []; }
  }

  async function refreshWeather({ requestGps = false, locationOverride = null } = {}) {
    const refreshToken = ++weatherRefreshToken;
    let location = locationOverride || weatherLocation;
    if (!location && requestGps) { const getCurrentGps = window.HazMatIQ?.locationTools?.getCurrentGps || window.getCurrentGps; try { const gps = await getCurrentGps?.(); location = validLocation({ ...gps, source: 'Current device GPS' }); } catch { /* Prompt remains visible. */ } }
    if (!location) { setLocationStatus('Enter a location or use Current GPS to begin.'); writeText('weather-map-status', 'Weather map awaits a location.'); renderWeatherState(null); return; }
    closeWeatherFirePopup(); location = saveWeatherLocationState(location); updateLocationDisplay(location); setLocationStatus(`${location.source} · Loading weather intelligence…`); createMap(location); centerMap(location);
    const [weatherResult, alertResult] = await Promise.allSettled([service()?.fetch?.(location.lat, location.lon, { force: true }), fetchAlerts(location)]);
    if (refreshToken !== weatherRefreshToken) return;
    const state = weatherResult.status === 'fulfilled' ? service()?.getState?.() || weatherResult.value : null; renderAlerts(alertResult.status === 'fulfilled' ? alertResult.value : []); renderWeatherState(state);
    setLocationStatus(`${state?.current?.source || 'Weather source unavailable'} · ${state?.freshness?.status || 'Verify data'}. Weather location is independent from Incident Command.`); if (weatherRadar?.isEnabled?.()) void weatherRadar.refresh();
  }

  async function useManualLocation(value) {
    const text = String(value || '').trim(); if (!text) { setLocationStatus('Enter an address or latitude, longitude.'); return; }
    const tools = window.HazMatIQ?.locationTools || {}; let location = typeof tools.parseGpsCoordinate === 'function' ? tools.parseGpsCoordinate(text) : null;
    if (!location && typeof tools.geocodePlumeAddress === 'function') { try { location = await tools.geocodePlumeAddress(text); } catch { location = null; } }
    if (!location) { setLocationStatus('Location not found. Enter an address or latitude, longitude.'); return; }
    await refreshWeather({ locationOverride: { ...location, displayAddress: location.address || text, source: 'Manual Weather location' } });
  }

  function bind() {
    document.getElementById('weather-location-form')?.addEventListener('submit', (event) => { event.preventDefault(); void useManualLocation(document.getElementById('weather-location-input')?.value); });
    document.getElementById('weather-use-gps-btn')?.addEventListener('click', () => void refreshWeather({ requestGps: true }));
    document.getElementById('weather-map-fullscreen-btn')?.addEventListener('click', () => { const target = document.getElementById('weather-map'); if (document.fullscreenElement) void document.exitFullscreen(); else void target?.requestFullscreen?.(); });
    document.querySelectorAll('[data-weather-map-style]').forEach((button) => button.addEventListener('click', () => { if (!weatherMap) return; closeWeatherFirePopup(); const style = button.dataset.weatherMapStyle === 'street' ? window.HazMatIQ?.mapInfrastructure?.streetStyle : window.HazMatIQ?.mapInfrastructure?.satelliteStyle?.(); if (style) weatherMap.setStyle(style); document.querySelectorAll('[data-weather-map-style]').forEach((item) => item.classList.toggle('active', item === button)); }));
    document.querySelector('[data-weather-layer="radar"]')?.addEventListener('click', () => { const radar = ensureRadar(); if (!radar) return; if (radar.isEnabled()) radar.disable(); else void radar.enable(); });
    document.querySelector('[data-weather-layer="alerts"]')?.addEventListener('click', () => { alertsLayerEnabled = !alertsLayerEnabled; setLayerButton('alerts', alertsLayerEnabled); renderAlertPolygons(); setMapLayerStatus(alertsLayerEnabled ? (weatherAlerts.some((feature) => feature.geometry) ? 'Alerts layer active · NWS polygons shown.' : 'Alerts layer selected · this feed has no polygon geometry; see Weather Impacts.') : 'Alerts layer hidden.'); });
    document.querySelector('[data-weather-layer="wind"]')?.addEventListener('click', () => { windLayerEnabled = !windLayerEnabled; setLayerButton('wind', windLayerEnabled); const controls = document.getElementById('weather-wind-controls'); if (controls) controls.hidden = !windLayerEnabled; if (windLayerEnabled) void loadWindOverlay(); else { weatherWindAbort?.abort(); removeWindOverlay(); writeText('weather-wind-service-status', 'Off until selected'); writeText('weather-wind-status', 'Wind layer is off'); setMapLayerStatus('Wind layer hidden.'); } });
    document.querySelector('[data-weather-layer="flood"]')?.addEventListener('click', () => { floodLayerEnabled = !floodLayerEnabled; setLayerButton('flood', floodLayerEnabled); if (floodLayerEnabled) void loadFloodOverlay(); else { weatherFloodAbort?.abort(); removeFloodOverlay(); writeText('weather-flood-service-status', 'Off until selected'); setMapLayerStatus('Flood layer hidden.'); } });
    document.querySelector('[data-weather-layer="fire"]')?.addEventListener('click', () => { fireLayerEnabled = !fireLayerEnabled; setLayerButton('fire', fireLayerEnabled); if (fireLayerEnabled) void loadFireOverlay(); else { weatherFireAbort?.abort(); removeFireOverlay(); writeText('weather-fire-service-status', 'Off until selected'); setMapLayerStatus('Fire layer hidden.'); } });
    document.getElementById('weather-impact-more')?.addEventListener('click', (event) => { const button = event.currentTarget; button.dataset.expanded = String(button.dataset.expanded !== 'true'); renderOperationalImpacts(weatherConditionState); });
    document.getElementById('weather-send-to-command')?.addEventListener('click', sendWeatherAssessmentToCommand);
    window.addEventListener('hazmatiq:incident-command-updated', renderSendToCommandAction);
    window.addEventListener('hazmatiq:incident-reset', renderSendToCommandAction);
    document.getElementById('weather-radar-source')?.addEventListener('change', (event) => void ensureRadar()?.selectProvider(event.target.value));
    document.getElementById('weather-radar-play')?.addEventListener('click', () => { const radar = ensureRadar(); if (!radar) return; if (radar.getState().animationPlaying) radar.pause(); else if (!radar.isEnabled()) void radar.enable(); else radar.play(); });
    document.getElementById('weather-radar-refresh')?.addEventListener('click', () => void ensureRadar()?.refresh());
    document.getElementById('weather-radar-frame')?.addEventListener('input', (event) => ensureRadar()?.setFrame(event.target.value)); document.getElementById('weather-radar-opacity')?.addEventListener('input', (event) => ensureRadar()?.setOpacity(event.target.value));
    document.querySelectorAll('[data-weather-wind-time]').forEach((button) => button.addEventListener('click', () => setWindTime(button.dataset.weatherWindTime)));
    window.addEventListener('hazmatiq:radar-state', (event) => radarState(event.detail || {}));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeWeatherFirePopup(); });
  }

  function initializeWeatherPage() {
    if (!initialized) { bind(); initialized = true; }
    const saved = readWeatherLocationState();
    if (saved) { weatherLocation = saved; weatherLocationSource = saved.source; void refreshWeather({ locationOverride: saved }); }
    else { updateLocationDisplay(null); setLocationStatus('Enter a location or use Current GPS to begin.'); writeText('weather-map-status', 'Weather map awaits a location.'); writeText('weather-radar-service-status', 'Awaiting location'); }
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.weatherLocation = { readWeatherLocationState, saveWeatherLocationState, clearWeatherLocationState };
  window.HazMatIQ.initializeWeatherPage = initializeWeatherPage;
})();
