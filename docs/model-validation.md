# Plume model validation

**Current state:** `test/plume.test.ts` covers model sanity (non-empty centerline, closed
isopleth polygons, AEGL-1 footprint reaching further than AEGL-2, the disclaimer text is
present) — it does not yet compare against published ALOHA example cases.

**Not yet built:** reproducible Gaussian-plume validation cases (ammonia railcar, chlorine
cylinder, etc.) drawn from published ALOHA examples, each specifying:

- Inputs (chemical, container, release rate, wind, stability class, surface roughness, temperature).
- Expected centerline concentration vs. downwind distance (or AEGL-3 footprint).
- Tolerance (default ±20%).

Until that suite exists, treat `runPlume`'s output as internally self-consistent but
**not independently validated against ALOHA** — the in-app disclaimer ("confirm with
ALOHA for legal/operational decisions") reflects this.
