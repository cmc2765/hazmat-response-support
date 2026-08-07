# Terrain-modeling readiness gate

## Status

Terrain-aware plume calculations are deferred. The current model is the **baseline
flat-ground model** and is not independently validated against published ALOHA cases.
No terrain correction, DEM data, or terrain API is part of the current implementation.

Terrain work must not begin until all baseline validation fixtures have cited published
expected distances and pass within approved tolerances.

## Future terrain requirements

Before implementation, approve:

1. **Elevation/DEM source** — authority, resolution, vertical datum, license, geographic coverage.
2. **Offline caching** — regional selection, tile/chunk format, size limits, revision, expiry.
3. **Model effect** — documented equations for slope, channeling, ridges/valleys, and
   interaction with stability and urban/rural roughness.
4. **Model versioning** — preserve the flat-ground version and identify terrain-aware
   outputs with a new model/version and explicit input provenance.
5. **Flat-ground regression** — terrain-disabled output must continue to pass every
   baseline published case.
6. **Terrain-aware validation** — obtain separately published or peer-reviewed terrain
   cases; do not derive expected results from HazMatIQ itself.

## Version boundary

- Current: baseline flat-ground Gaussian plume/puff model.
- Future: separately versioned terrain-aware model, only after validation and review.

Displaying weather-station elevation does not mean elevation affects dispersion.
