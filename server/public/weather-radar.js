(() => {
  const controllers = new WeakMap();
  const DEFAULT_OPACITY = 0.58;
  const REFRESH_MS = 2 * 60 * 1000;
  const FRAME_INTERVAL_MS = 650;

  function firstLayer(map, predicate) {
    return map.getStyle()?.layers?.find(predicate)?.id;
  }

  function createController(map, options = {}) {
    if (controllers.has(map)) return controllers.get(map);
    const registry = window.HazMatRadarProviders;
    const prefix = options.prefix || 'live-weather-radar';
    const ids = { source: `${prefix}-source`, layer: `${prefix}-layer` };
    let enabled = false;
    let selectedProviderId = options.providerId || 'BEST_AVAILABLE';
    let activeProvider = null;
    let opacity = DEFAULT_OPACITY;
    let frames = [];
    let frameIndex = -1;
    let animationTimer = null;
    let refreshTimer = null;
    let requestVersion = 0;
    let animationPlaying = false;
    let fallbackMessage = '';

    const anchor = () => firstLayer(map, (layer) => layer.id === options.beforeLayerId)
      || firstLayer(map, (layer) => layer.id.includes('plume') && layer.type === 'fill')
      || firstLayer(map, (layer) => layer.type === 'symbol');

    function status(extra = {}) {
      const provider = activeProvider || registry?.getProvider(registry?.IDS?.NOAA);
      const timestamp = frameIndex >= 0 ? frames[frameIndex]?.timestamp || null : extra.timestamp || null;
      const state = {
        enabled,
        selectedProviderId,
        providerId: provider?.id || null,
        providerName: provider?.displayName || 'Radar unavailable',
        status: provider ? registry.providerStatus(provider) : 'Provider Not Configured',
        timestamp,
        opacity,
        animationPlaying,
        frameIndex,
        frameCount: frames.length,
        supportsAnimation: Boolean(provider?.supportsAnimation && frames.length > 1),
        attribution: provider?.attribution || '',
        limitations: provider?.limitations || [],
        fallbackMessage,
        ...extra,
      };
      options.onStateChange?.(state);
      window.dispatchEvent(new CustomEvent('hazmatiq:radar-state', { detail: state }));
    }

    function removeLayer() {
      if (map.getLayer(ids.layer)) map.removeLayer(ids.layer);
      if (map.getSource(ids.source)) map.removeSource(ids.source);
    }

    function reorder() {
      const before = anchor();
      if (before && map.getLayer(ids.layer)) map.moveLayer(ids.layer, before);
    }

    function setTiles(layerConfig) {
      const source = map.getSource(ids.source);
      if (source?.setTiles) source.setTiles(layerConfig.tiles);
      else {
        removeLayer();
        map.addSource(ids.source, {
          type: 'raster',
          tiles: layerConfig.tiles,
          tileSize: layerConfig.tileSize || 256,
          minzoom: layerConfig.minzoom ?? 1,
          maxzoom: layerConfig.maxzoom ?? 18,
          attribution: activeProvider.attribution,
        });
        map.addLayer({
          id: ids.layer,
          type: 'raster',
          source: ids.source,
          paint: {
            'raster-opacity': opacity,
            'raster-resampling': 'linear',
            'raster-fade-duration': 250,
          },
        }, anchor());
      }
      reorder();
    }

    function stopAnimation() {
      window.clearInterval(animationTimer);
      animationTimer = null;
      animationPlaying = false;
    }

    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      if (!enabled || animationPlaying) return;
      refreshTimer = window.setTimeout(() => { void refresh(); }, REFRESH_MS);
    }

    async function resolveProvider(providerId) {
      await registry.loadConfiguration();
      if (providerId === 'BEST_AVAILABLE') return registry.bestAvailableProvider();
      return registry.getProvider(providerId);
    }

    async function activate(providerId = selectedProviderId, allowFallback = true) {
      const version = ++requestVersion;
      selectedProviderId = providerId;
      if (allowFallback) fallbackMessage = '';
      stopAnimation();
      const provider = await resolveProvider(providerId);
      if (version !== requestVersion || !enabled) return;
      if (!provider || !provider.supportsTiles || !registry.isConfigured(provider)) {
        removeLayer();
        activeProvider = provider;
        frames = [];
        frameIndex = -1;
        const error = provider?.requiresSelfHosting
          ? 'Self-hosted radar endpoint not configured.'
          : 'Radar provider not configured. Select another provider or use NOAA/NWS fallback.';
        status({ status: provider?.id === registry.IDS.AWN ? registry.providerStatus(provider) : 'Not Configured', error });
        return;
      }
      activeProvider = provider;
      try {
        frames = provider.supportsAnimation ? await provider.getFrames() : [];
        frameIndex = frames.length ? frames.length - 1 : -1;
        const layerConfig = await provider.getLayerConfig(frameIndex >= 0 ? frames[frameIndex] : null);
        if (version !== requestVersion || !enabled) return;
        if (!layerConfig?.tiles?.length) throw new Error('Provider returned no current radar layer.');
        if (!map.isStyleLoaded()) {
          map.once('style.load', () => { if (enabled) void activate(selectedProviderId, allowFallback); });
          return;
        }
        setTiles(layerConfig);
        status({ timestamp: layerConfig.timestamp || null, error: '' });
        options.onAvailability?.(true, provider);
        scheduleRefresh();
      } catch (error) {
        if (allowFallback && provider.id !== registry.IDS.NOAA) {
          fallbackMessage = provider.id === registry.IDS.RAINVIEWER
            ? 'RainViewer radar unavailable. NOAA/NWS fallback available.'
            : `${provider.displayName} unavailable. NOAA/NWS fallback active.`;
          options.onFallback?.(provider, error);
          await activate(registry.IDS.NOAA, false);
          return;
        }
        removeLayer();
        status({ status: 'Unavailable', error: error instanceof Error ? error.message : 'Radar provider unavailable.' });
        options.onAvailability?.(false, provider);
      }
    }

    async function refresh() {
      if (!enabled || document.hidden) {
        scheduleRefresh();
        return;
      }
      await activate(selectedProviderId);
      options.onRefresh?.(new Date(), activeProvider);
    }

    function play() {
      if (!enabled || !activeProvider?.supportsAnimation || frames.length < 2) return;
      stopAnimation();
      animationPlaying = true;
      status();
      animationTimer = window.setInterval(() => {
        setFrame((frameIndex + 1) % frames.length);
      }, FRAME_INTERVAL_MS);
    }

    function setFrame(index) {
      if (!frames.length) return;
      frameIndex = Math.max(0, Math.min(frames.length - 1, Number(index) || 0));
      const frame = frames[frameIndex];
      setTiles({ tiles: frame.tiles });
      status();
    }

    const controller = {
      ids,
      async enable() { enabled = true; await activate(selectedProviderId); },
      disable() {
        enabled = false;
        requestVersion += 1;
        stopAnimation();
        window.clearTimeout(refreshTimer);
        removeLayer();
        status();
      },
      async selectProvider(providerId) { await activate(providerId); },
      async fallback() { await activate(registry.IDS.NOAA, false); },
      setOpacity(value) {
        opacity = Math.min(1, Math.max(0.1, Number(value) || DEFAULT_OPACITY));
        if (map.getLayer(ids.layer)) map.setPaintProperty(ids.layer, 'raster-opacity', opacity);
        status();
      },
      play,
      pause() { stopAnimation(); status(); },
      setFrame,
      reorder,
      refresh,
      ownsSource(sourceId) { return sourceId === ids.source; },
      isEnabled() { return enabled; },
      getState() {
        return {
          enabled,
          selectedProviderId,
          activeProvider,
          opacity,
          frames,
          frameIndex,
          frameCount: frames.length,
          animationPlaying,
        };
      },
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && enabled) void refresh(); });
    map.on('style.load', () => { if (enabled) void activate(selectedProviderId); });
    controllers.set(map, controller);
    return controller;
  }

  window.HazMatWeatherRadar = { createController, DEFAULT_OPACITY, REFRESH_MS, FRAME_INTERVAL_MS };
})();
