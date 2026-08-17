# Live Map radar strategy

HazMatIQ intentionally keeps the working Live Map radar path to two sources:

1. **Primary visual radar:** RainViewer metadata-driven raster, enabled locally with `VITE_ENABLE_RAINVIEWER_RADAR=true`.
2. **Official fallback:** NOAA/NWS MRMS, selected automatically when the primary is disabled or fails.

The working UI has one **Weather Radar** toggle. It does not expose provider selection, provider configuration, opacity, animation, weather details, or a radar information box. The overlay uses a fixed 58% opacity.

RainViewer frames are read only from `https://api.rainviewer.com/public/weather-maps.json`. HazMatIQ uses only the host, path, and timestamp values returned by that metadata. It does not fabricate frames. RainViewer remains subject to licensing and continuity review before production use.

NOAA/NWS uses the existing official MRMS `radar_base_reflectivity_time` ImageServer and remains available without credentials.

Radar is inserted below plume geometry and operational markers. It has no click handler, so map markers remain clickable and plume geometry remains visible.

Unused RadrView, LibreWXR, Tomorrow.io, Xweather, Mapbox Weather, and AWN provider templates are not present in the active UI, browser registry, or backend provider response. Reintroducing a provider requires a deliberate code change and operational review.
