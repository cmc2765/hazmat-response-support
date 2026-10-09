/* Dedicated Weather Intelligence workspace. It consumes the shared weather
   service and the existing MapLibre/radar provider infrastructure. */
(() => {
  let initialized = false;
  let weatherMap = null;
  let weatherRadar = null;
  let weatherLocation = null;
  let weatherLocationSource = '';
  let weatherIncidentId = null;
  let weatherFollowsIncident = false;
  let weatherMarker = null;

  const incidentApi = () => window.HazMatIQ?.incidentCommandLegacy;
  const activeIncident = () => incidentApi()?.getActiveIncident?.() || null;
  const service = () => window.HazMatIQ?.weatherService;
  const number = (value, digits = 1, suffix = '') => Number.isFinite(Number(value)) ? `${Number(value).toFixed(digits)}${suffix}` : 'Unavailable';
  const compass = (value) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(Number(value) / 45) % 8] || 'unknown direction';
  const direction = (value) => {
    if (!Number.isFinite(Number(value))) return 'Unavailable';
    const degrees = Math.round(Number(value));
    const label = typeof window.degreesToCompass === 'function' ? window.degreesToCompass(Number(value)) : compass(Number(value));
    return `${degrees}° ${label}`;
  };

  function incidentLocation(incident) {
    const lat = Number(incident?.latitude);
    const lon = Number(incident?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
      ? { lat, lon, address: incident.address || '', source: 'Active incident' }
      : null;
  }

  async function resolveLocation({ preferIncident = true, requestGps = true } = {}) {
    const incident = activeIncident();
    const tools = window.HazMatIQ?.locationTools || {};
    if (preferIncident && incident) {
      const saved = incidentLocation(incident);
      if (saved) return saved;

      // Command incidents can legitimately have an address before latitude/
      // longitude have been persisted. Weather must still follow the incident
      // instead of falling through to an empty GPS-only state.
      const address = [incident.address, incident.city, incident.state, incident.zip]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(', ');
      if (address && typeof tools.geocodePlumeAddress === 'function') {
        try {
          const match = await tools.geocodePlumeAddress(address);
          if (match && Number.isFinite(Number(match.lat)) && Number.isFinite(Number(match.lon))) {
            return {
              lat: Number(match.lat),
              lon: Number(match.lon),
              address,
              source: 'Active incident address',
            };
          }
        } catch {
          // Continue to the shared incident-coordinate/GPS fallbacks.
        }
      }

      if (typeof tools.getIncidentCoordinates === 'function') {
        try {
          const resolved = await tools.getIncidentCoordinates({ requestGps: false });
          if (resolved && Number.isFinite(Number(resolved.lat)) && Number.isFinite(Number(resolved.lon))) {
            return {
              lat: Number(resolved.lat),
              lon: Number(resolved.lon),
              address,
              source: resolved.source || 'Active incident',
            };
          }
        } catch {
          // Device GPS/manual location may still recover the workspace.
        }
      }
    }

    if (weatherLocation && !requestGps) return weatherLocation;

    const getCurrentGps = tools.getCurrentGps || window.getCurrentGps;
    if (requestGps && typeof getCurrentGps === 'function') {
      try {
        const gps = await getCurrentGps();
        if (Number.isFinite(Number(gps?.lat)) && Number.isFinite(Number(gps?.lon))) {
          return { lat: Number(gps.lat), lon: Number(gps.lon), address: '', source: 'Current device GPS' };
        }
      } catch {
        // Manual location remains available when GPS is unavailable.
      }
    }
    return weatherLocation;
  }

  function setLocationStatus(message) {
    const node = document.getElementById('weather-location-status');
    if (node) node.textContent = message;
  }

  function placeIncidentMarker(location, incident) {
    if (!weatherMap || !window.maplibregl || !location) return;
    weatherMarker?.remove();
    const element = document.createElement('div');
    element.className = 'weather-incident-marker';
    element.setAttribute('aria-label', incident ? `Active incident: ${incident.incidentName || 'incident'}` : 'Selected weather location');
    element.textContent = incident ? 'IC' : '●';
    weatherMarker = new window.maplibregl.Marker({ element })
      .setLngLat([location.lon, location.lat])
      .addTo(weatherMap);
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
    if (frameTime) frameTime.textContent = state.timestamp ? new Date(state.timestamp).toLocaleString() : 'Current / time unavailable';
    if (play) play.textContent = state.animationPlaying ? 'Pause animation' : 'Play animation';
    if (sourceStatus) sourceStatus.textContent = state.enabled
      ? `${state.providerName || 'Radar'} · ${state.status || 'Status unavailable'}${state.fallbackMessage ? ` · ${state.fallbackMessage}` : ''}`
      : 'Radar is off. Enable it with the Play animation or Refresh radar control.';
  }

  function ensureRadar() {
    if (weatherRadar || !weatherMap || !window.HazMatWeatherRadar) return weatherRadar;
    weatherRadar = window.HazMatWeatherRadar.createController(weatherMap, {
      prefix: 'weather-radar',
      onStateChange: radarState,
      onFallback: () => setLocationStatus('Radar fallback active. Current weather data is unchanged.'),
    });
    weatherRadar.setOpacity(document.getElementById('weather-radar-opacity')?.value || 0.58);
    return weatherRadar;
  }

  function createMap(location) {
    if (!window.maplibregl || !location || weatherMap) return weatherMap;
    const infrastructure = window.HazMatIQ?.mapInfrastructure || {};
    const container = document.getElementById('weather-map');
    if (!container) return null;
    weatherMap = new window.maplibregl.Map({
      container,
      center: [location.lon, location.lat],
      zoom: 10,
      style: infrastructure.satelliteStyle?.() || 'https://tiles.openfreemap.org/styles/liberty',
      preserveDrawingBuffer: true,
    });
    weatherMap.addControl(new window.maplibregl.NavigationControl(), 'bottom-right');
    weatherMap.on('load', () => {
      ensureRadar();
      setText('weather-map-status', 'Weather map ready.');
    });
    weatherMap.on('style.load', () => {
      if (weatherRadar?.isEnabled?.()) void weatherRadar.refresh();
    });
    weatherMap.on('error', (event) => {
      if (event?.error?.message) setText('weather-map-status', `Map notice: ${event.error.message}`);
    });
    return weatherMap;
  }

  function centerMap(location, { animate = false } = {}) {
    if (!weatherMap || !location) return;
    const method = animate ? 'easeTo' : 'jumpTo';
    weatherMap[method]({ center: [location.lon, location.lat], zoom: Math.max(weatherMap.getZoom?.() || 10, 10) });
    weatherMap.resize();
    placeIncidentMarker(location, activeIncident());
    setText('weather-map-location-readout', `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)} · ${weatherLocationSource || location.source || 'Selected location'}`);
  }

  function renderConditions(state) {
    const current = state?.current;
    const freshness = state?.freshness || service()?.getFreshness?.(current?.observedAt);
    const source = current?.source || (state?.nws && current === state.nws ? state.nws.station : state?.openMeteo ? 'Open-Meteo current conditions' : 'Unavailable');
    const windFrom = Number(current?.windDirDeg);
    const windTo = Number.isFinite(windFrom) ? (windFrom + 180) % 360 : null;
    setText('weather-temperature', number(current?.temperatureF, 1, ' °F'));
    setText('weather-feels-like', `Feels like ${number(current?.feelsLikeF, 1, ' °F')}`);
    setText('weather-wind-from', direction(windFrom));
    setText('weather-wind-speed', `${number(current?.windSpeedMph, 1, ' mph')} · From`);
    setText('weather-wind-to', direction(windTo));
    setText('weather-gusts', number(current?.gustMph, 1, ' mph'));
    setText('weather-humidity', `Humidity ${number(current?.rh, 0, '%')}`);
    setText('weather-pressure', number(current?.pressureInHg, 2, ' inHg'));
    setText('weather-stability', 'Stability derived in Plume when available');
    setText('weather-cloud-cover', number(current?.cloudCoverPct, 0, '%'));
    setText('weather-precipitation', `Precipitation ${number(current?.precipitationIn, 2, ' in')}`);
    setText('weather-source', source);
    setText('weather-observation-time', `Observed ${current?.observedAt ? new Date(current.observedAt).toLocaleString() : 'Unavailable'}`);
    setText('weather-retrieved-time', `Retrieved ${state?.retrievedAt ? new Date(state.retrievedAt).toLocaleTimeString() : 'Unavailable'}`);
    const badge = document.getElementById('weather-freshness-badge');
    if (badge) {
      badge.textContent = freshness?.status?.toUpperCase() || 'UNAVAILABLE';
      badge.dataset.state = freshness?.status === 'Current' ? 'current' : freshness?.status?.toLowerCase().replace(/[^a-z]+/g, '-') || 'unavailable';
    }
    const arrow = document.getElementById('weather-wind-arrow');
    if (arrow) arrow.style.transform = Number.isFinite(windTo) ? `rotate(${windTo}deg)` : 'rotate(0deg)';
  }

  function forecastItems(state) {
    const forecast = state?.openMeteo?.forecast || [];
    const now = Date.now();
    return [1, 3, 6, 12, 24].map((hours) => {
      const target = now + hours * 60 * 60 * 1000;
      return forecast.reduce((best, item) => !best || Math.abs(Date.parse(item.time) - target) < Math.abs(Date.parse(best.time) - target) ? item : best, null);
    }).filter(Boolean);
  }

  function renderForecast(state) {
    const grid = document.getElementById('weather-forecast-grid');
    if (!grid) return;
    grid.replaceChildren();
    const items = forecastItems(state);
    if (!items.length) {
      grid.innerHTML = '<p>Forecast unavailable from the current weather response.</p>';
      setText('weather-forecast-status', 'Unavailable');
      return;
    }
    setText('weather-forecast-status', `${items.length} horizons`);
    items.forEach((item) => {
      const card = document.createElement('article');
      const time = document.createElement('strong');
      const temp = document.createElement('b');
      const details = document.createElement('small');
      const hours = Math.max(1, Math.round((Date.parse(item.time) - Date.now()) / 3600000));
      time.textContent = `${hours} hr`;
      temp.textContent = number(item.temperatureF, 0, ' °F');
      details.textContent = `${direction(item.windDirDeg)} · gust ${number(item.gustMph, 0, ' mph')} · rain ${number(item.precipitationProbability, 0, '%')}`;
      card.append(time, temp, details);
      grid.append(card);
    });
  }

  function renderImpacts(state) {
    const list = document.getElementById('weather-impact-list');
    if (!list) return;
    const current = state?.current;
    const impacts = [];
    const forecast = forecastItems(state);
    if (current && Number.isFinite(Number(current.windDirDeg)) && forecast[0]?.windDirDeg !== undefined && Math.abs(Number(forecast[0].windDirDeg) - Number(current.windDirDeg)) > 30) impacts.push('Wind shift expected in the near-term forecast.');
    if (Number(current?.gustMph) >= 25 || Number(current?.gustMph) >= Number(current?.windSpeedMph) * 1.5) impacts.push('Strong gust potential is present in the current observation.');
    if (Number(current?.precipitationIn) >= 0.1) impacts.push('Precipitation is present in the current observation.');
    if (Number(current?.weatherCode) >= 95) impacts.push('Thunderstorm conditions are reported by the weather provider.');
    if (Number(current?.temperatureF) >= 95) impacts.push('High heat conditions may affect responder endurance.');
    if (Number(current?.temperatureF) <= 20) impacts.push('Cold conditions may affect responder endurance and equipment.');
    if (!impacts.length) impacts.push(current ? 'No significant weather impact detected from the current source data.' : 'Current weather impacts are unavailable.');
    list.replaceChildren(...impacts.map((message) => { const item = document.createElement('li'); item.textContent = message; return item; }));
    setText('weather-impact-status', current ? 'Data-supported observations' : 'Awaiting data');
    setText('weather-severe-status', Number(current?.weatherCode) >= 95 ? 'Thunderstorm reported' : current ? 'No severe condition reported' : 'Unavailable');
  }

  function renderWeatherState(state) {
    renderConditions(state);
    renderForecast(state);
    renderImpacts(state);
  }

  async function refreshWeather({ requestGps = true, preferIncident = true, locationOverride = null } = {}) {
    const incident = activeIncident();
    const location = locationOverride || await resolveLocation({ preferIncident, requestGps });
    if (!location) {
      setLocationStatus('No incident location or device GPS is available. Enter an address or coordinates.');
      renderWeatherState(null);
      return;
    }
    weatherLocation = location;
    weatherLocationSource = location.source || '';
    weatherFollowsIncident = Boolean(preferIncident && incident);
    weatherIncidentId = preferIncident ? incident?.incidentId || null : null;
    setLocationStatus(`${incident && preferIncident ? 'Using active incident location' : 'Using selected weather location'} · Loading current conditions…`);
    createMap(location);
    centerMap(location);
    const weatherService = service();
    if (!weatherService?.fetch) {
      renderWeatherState(null);
      setLocationStatus('Weather service is not initialized. Reload the application and try again.');
      return;
    }
    try {
      const result = await weatherService.fetch(location.lat, location.lon, { force: true });
      const state = weatherService.getState?.() || { ...result, retrievedAt: new Date().toISOString() };
      renderWeatherState(state);
      setLocationStatus(`${state.current?.source || 'Weather source'} · ${state.freshness?.status || 'Time unknown'}. Browsing this location does not change the incident location.`);
    } catch (error) {
      console.error('WEATHER INTELLIGENCE LOAD ERROR', error);
      renderWeatherState(weatherService.getState?.() || null);
      setLocationStatus(`Weather data could not be refreshed${error?.message ? `: ${error.message}` : '.'}`);
    }
  }

  async function useManualLocation(value) {
    const text = String(value || '').trim();
    if (!text) return refreshWeather({ requestGps: true, preferIncident: true });
    const tools = window.HazMatIQ?.locationTools || {};
    let location = typeof tools.parseGpsCoordinate === 'function' ? tools.parseGpsCoordinate(text) : null;
    if (!location && typeof tools.geocodePlumeAddress === 'function') {
      try { location = await tools.geocodePlumeAddress(text); } catch { location = null; }
    }
    if (!location) {
      setLocationStatus('Location not found. Enter an address or latitude, longitude.');
      return;
    }
    await refreshWeather({ requestGps: false, preferIncident: false, locationOverride: location });
  }

  function bind() {
    document.getElementById('weather-location-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      void useManualLocation(document.getElementById('weather-location-input')?.value);
    });
    document.getElementById('weather-use-gps-btn')?.addEventListener('click', () => void refreshWeather({ requestGps: true, preferIncident: false }));
    document.getElementById('weather-use-incident-btn')?.addEventListener('click', () => void refreshWeather({ requestGps: false, preferIncident: true }));
    document.getElementById('weather-map-fullscreen-btn')?.addEventListener('click', () => {
      const target = document.getElementById('weather-map');
      if (document.fullscreenElement) void document.exitFullscreen();
      else void target?.requestFullscreen?.();
    });
    document.querySelectorAll('[data-weather-map-style]').forEach((button) => button.addEventListener('click', () => {
      if (!weatherMap) return;
      const mode = button.dataset.weatherMapStyle;
      const style = mode === 'street' ? window.HazMatIQ?.mapInfrastructure?.streetStyle : window.HazMatIQ?.mapInfrastructure?.satelliteStyle?.();
      if (style) weatherMap.setStyle(style);
      document.querySelectorAll('[data-weather-map-style]').forEach((item) => item.classList.toggle('active', item === button));
    }));
    document.getElementById('weather-radar-source')?.addEventListener('change', (event) => void ensureRadar()?.selectProvider(event.target.value));
    document.getElementById('weather-radar-play')?.addEventListener('click', () => {
      const radar = ensureRadar();
      if (!radar) return;
      if (radar.getState().animationPlaying) radar.pause();
      else if (!radar.isEnabled()) void radar.enable();
      else radar.play();
    });
    document.getElementById('weather-radar-refresh')?.addEventListener('click', () => void ensureRadar()?.refresh());
    document.getElementById('weather-radar-frame')?.addEventListener('input', (event) => ensureRadar()?.setFrame(event.target.value));
    document.getElementById('weather-radar-opacity')?.addEventListener('input', (event) => ensureRadar()?.setOpacity(event.target.value));
    window.addEventListener('hazmatiq:radar-state', (event) => radarState(event.detail || {}));
    window.addEventListener('hazmatiq:weather-updated', (event) => {
      if (document.getElementById('weather')?.classList.contains('active')) renderWeatherState(event.detail);
    });
  }

  function initializeWeatherPage() {
    if (!initialized) { bind(); initialized = true; }
    const incident = activeIncident();
    const context = document.getElementById('weather-incident-context');
    const saved = incidentLocation(incident);
    if (context) context.hidden = !incident;
    setText('weather-incident-name', incident?.incidentName || 'No active incident');
    setText('weather-incident-location', saved ? [incident.address, incident.city, incident.state].filter(Boolean).join(', ') || `${saved.lat.toFixed(4)}, ${saved.lon.toFixed(4)}` : 'Incident location unavailable');
    if (!weatherLocation || (weatherFollowsIncident && weatherIncidentId !== incident?.incidentId)) void refreshWeather({ requestGps: true, preferIncident: true });
    else { createMap(weatherLocation); centerMap(weatherLocation); renderWeatherState(service()?.getState?.()); }
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.initializeWeatherPage = initializeWeatherPage;
})();
