# Plume model validation

This directory will hold reproducible Gaussian-plume validation cases (ammonia railcar,
chlorine cylinder, etc.) drawn from published ALOHA examples.

Each fixture should specify:

- Inputs (chemical, container, release rate, wind, stability class, surface roughness, temperature).
- Expected centerline concentration vs. downwind distance (or AEGL-3 footprint).
- Tolerance (default ±20%).

The acceptance gate: `npm run test` runs every fixture against `runPlume` and fails
the build if any case exceeds its tolerance.
