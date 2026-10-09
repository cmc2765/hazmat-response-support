(() => {
  const IDS = Object.freeze({
    PRIMARY: 'RAINVIEWER_VISUAL_PROTOTYPE',
    RAINVIEWER: 'RAINVIEWER_VISUAL_PROTOTYPE',
    NOAA: 'NOAA_MRMS_OFFICIAL_FALLBACK',
  });
  const NOAA_SERVICE = 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer';
  const RAINVIEWER_METADATA = 'https://api.rainviewer.com/public/weather-maps.json';
  const configuration = { defaultProviderId: IDS.NOAA, providers: {} };
  let configurationPromise = null;

  async function rainViewerFrames() {
    const response = await fetch(RAINVIEWER_METADATA, { cache: 'no-store' });
    if (!response.ok) throw new Error(`RainViewer metadata unavailable (${response.status}).`);
    const metadata = await response.json();
    let host = '';
    try {
      const url = new URL(metadata?.host);
      if (url.protocol === 'https:') host = url.toString().replace(/\/$/, '');
    } catch {
      host = '';
    }
    if (!host) throw new Error('RainViewer metadata returned an invalid tile host.');
    return [...(metadata?.radar?.past || []), ...(metadata?.radar?.nowcast || [])]
      .filter((frame) => Number.isFinite(frame?.time) && typeof frame?.path === 'string' && frame.path.startsWith('/'))
      .map((frame) => ({
        timestamp: new Date(frame.time * 1000).toISOString(),
        tiles: [`${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`],
      }));
  }

  const providers = {
    [IDS.PRIMARY]: {
      id: IDS.PRIMARY,
      displayName: 'Primary Visual Radar',
      status: 'Disabled',
      providerType: 'RainViewer Metadata-Driven Raster',
      requiresApiKey: false,
      requiresBackendProxy: false,
      requiresSelfHosting: false,
      supportsTiles: true,
      supportsAnimation: true,
      supportsOpacity: true,
      supportsTimestamps: true,
      attribution: 'RainViewer',
      limitations: ['Visual radar for situational awareness. Verify licensing before production use.'],
      getMetadataUrl: () => RAINVIEWER_METADATA,
      getTileUrl: (frame) => frame?.tiles?.[0] || null,
      getFrames: rainViewerFrames,
      async getLatestFrame() {
        const frames = await rainViewerFrames();
        return frames.at(-1) || null;
      },
      async getLayerConfig(frame) {
        const selected = frame || await this.getLatestFrame();
        return selected ? { tiles: selected.tiles, tileSize: 256, minzoom: 1, maxzoom: 7, timestamp: selected.timestamp } : null;
      },
    },
    [IDS.NOAA]: {
      id: IDS.NOAA,
      displayName: 'NOAA/NWS Official Fallback',
      status: 'Official Fallback',
      providerType: 'Official MRMS ImageServer Raster',
      requiresApiKey: false,
      requiresBackendProxy: false,
      requiresSelfHosting: false,
      supportsTiles: true,
      supportsAnimation: false,
      supportsOpacity: true,
      supportsTimestamps: false,
      attribution: 'NOAA / National Weather Service',
      limitations: ['Official radar fallback for situational awareness.'],
      getMetadataUrl: () => NOAA_SERVICE,
      getTileUrl: () => `${NOAA_SERVICE}/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=1024,1024&format=png32&transparent=true&f=image`,
      getFrames: async () => [],
      getLatestFrame: async () => null,
      getLayerConfig() {
        return { tiles: [this.getTileUrl()], tileSize: 512, minzoom: 2, maxzoom: 17, timestamp: new Date().toISOString() };
      },
    },
  };

  async function loadConfiguration() {
    if (!configurationPromise) configurationPromise = fetch('/api/radar/providers', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Radar configuration unavailable (${response.status}).`);
        return response.json();
      })
      .then((value) => {
        configuration.defaultProviderId = value.defaultProviderId || IDS.NOAA;
        configuration.providers = value.providers || {};
        return configuration;
      })
      .catch(() => configuration);
    return configurationPromise;
  }

  function providerStatus(provider) {
    return configuration.providers[provider.id]?.status || provider.status;
  }

  function isConfigured(provider) {
    return provider.id === IDS.NOAA || Boolean(configuration.providers[provider.id]?.configured);
  }

  window.HazMatRadarProviders = {
    IDS,
    providers,
    loadConfiguration,
    providerStatus,
    isConfigured,
    bestAvailableProvider: () => providers[configuration.defaultProviderId] || providers[IDS.NOAA],
    getProvider: (id) => providers[id] || null,
    getConfiguration: () => configuration,
  };
})();
