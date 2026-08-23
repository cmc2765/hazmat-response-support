# Plume model validation

## Validation status

**Status: not independently validated.**

`test/plume.test.ts` covers internal model sanity: non-empty centerlines, closed
isopleth polygons, threshold ordering, puff execution, and disclaimer presence. It does
not compare HazMatIQ output with published ALOHA expected-distance cases.

One official NOAA/EPA chlorine-cylinder comparison candidate is registered. It is not
directly runnable: ALOHA treats the release as an instantaneous heavy-gas direct source,
while the current Gaussian puff implementation requires an evaluation time that the
published case does not supply. The published 60-minute AEGL averaging duration is not
a cloud evaluation time and is not substituted for one. No compatible ammonia-railcar
expected-distance case has been registered.

Additional plume-model complexity, including terrain correction, remains blocked until
the flat-ground baseline has reproducible, model-compatible published comparison cases.

## Enforceable validation framework

The offline framework is implemented in:

- `src/lib/model/validation.ts`
- `test/model-validation/plume-validation.test.ts`
- `test/model-validation/plume-validation-cases.example.json`

The fixture contains eight required categories:

1. ammonia railcar release
2. chlorine cylinder release
3. dense-gas case
4. neutral-gas case
5. low-wind stable case
6. moderate-wind neutral case
7. urban-roughness case
8. rural-roughness case

Every case supports chemical identity, release type, container, quantity or release
rate, weather, stability, surface roughness, threshold, expected distance, published
source, tolerance, actual output, and pass/fail status.

Seven fixtures are source-empty placeholders and contain a blocking warning:

> Do not use this case for validation until published expected distances and source references are added.

The chlorine fixture retains its published expected lower-bound distance and citation,
but is also `skipped` because its source/model mapping is unresolved. Cases missing any
required input, expected result, source, or compatibility mapping can never count as
passed.

Run `npm --prefix server run plume:validation` for the JSON summary. CI or a release
gate can use `npm --prefix server run plume:validation:gate`, which returns a nonzero
exit status until the status is `validated`.

## Current validation summary

| Metric | Count |
|---|---:|
| Total validation cases | 8 |
| Runnable validation cases | 0 |
| Published candidates blocked on compatibility | 1 |
| Source-empty placeholder cases | 7 |
| Total skipped cases | 8 |
| Passed cases | 0 |
| Failed cases | 0 |

Validation status remains `not-independently-validated`. It can become `validated` only
when every fixture is runnable from a cited published source, no fixture is skipped, and
all cases pass within their configured tolerance.

## Adding a real validation case

1. Obtain an openly available or otherwise authorized published case.
2. Archive a stable citation and document units, assumptions, and model/version.
3. Transcribe inputs without filling undocumented values by inference.
4. Add the published expected distance and tolerance.
5. Have a second reviewer verify the transcription.
6. Run the offline test suite and retain both passing and failing results.

Until those steps are complete, treat `runPlume` as internally self-consistent but not
independently validated against ALOHA.
