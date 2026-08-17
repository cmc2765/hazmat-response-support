# Plume model scientific validation and operational status

## Decision

**Current status: NO-GO for an independently validated or operational-model claim.**

HazMatIQ may display a **Planning Estimate** when chemical identity, a reviewed EPA
AEGL endpoint, required release inputs, location, and usable weather are present. It
must display **Needs Verification** for stale/recent or manually entered weather and
must block a toxic endpoint plot when identity, AEGL, release, location, or weather
requirements are absent.

No result is “Validated for this chemical/release scenario.” The validation runner
currently reports zero runnable comparison cases and four skipped cases. Skipped cases
do not count as passed.

## Model and formula approach

- Model: `HazMatIQ Baseline Plume Planning Model`
- Implementation version: `0.1.0-plume-skeleton`
- Continuous release: steady-state Gaussian point-source plume with ground reflection.
- Instantaneous release: Gaussian puff evaluated at an explicit operator-supplied time.
- Dispersion coefficients: Pasquill-Gifford/Briggs rural or urban parameterizations in
  `src/lib/model/briggs.ts`.
- Endpoint geometry: sampled concentration isopleths calculated from a selected,
  duration-specific EPA AEGL value.

This work did not change the plume or puff equations. Internal tests verify arithmetic
and structural invariants; those tests are not independent scientific validation.

## Source requirements

Chemical identity must resolve to a numeric Chemical Companion master record with a CAS
number. That CAS must exactly match a canonical chemical record and a reviewed EPA AEGL
catalog entry. Loose names, canonical slugs submitted without a master link, and
transportation identifiers do not establish identity.

The reviewed endpoint catalog currently contains only final EPA AEGL tables transcribed
for:

- Ammonia, CAS 7664-41-7
- Chlorine, CAS 7782-50-5

Supported durations are 10, 30, 60, 240, and 480 minutes for these two records. The UI
defaults to the 60-minute endpoint because that duration exists in both reviewed tables.
AEGL-1, AEGL-2, and AEGL-3 values are used directly; values are never interpolated,
extrapolated, or calculated from ERPG, TEEL, IDLH, or occupational limits.

## Required model inputs

The current calculation requires:

- verified Chemical Companion master ID and exact CAS linkage;
- reviewed EPA AEGL record and selected supported duration;
- continuous release rate, or puff total mass plus puff evaluation time;
- incident/planning coordinates;
- positive wind speed, wind-from direction from 0 through 360 degrees, air temperature,
  stability class, and rural/urban surface roughness;
- molecular weight from the linked canonical chemical record.

Container type, phase, and pressure condition are retained as planning context but are
not source-term calculations in the current formula. The operator-entered release rate
or mass therefore remains a major uncertainty.

## Weather handling

Weather priority is: configured/current Columbia Weather Station, nearest complete NWS
observation, current Open-Meteo observation, then confirmed manual entry. No Columbia
live endpoint is configured in this repository, so it cannot silently supply data.

Freshness labels are: Current (0–10 minutes), Recent / verify (>10–30), Stale (>30–60),
Expired (>60), and Time Unknown (missing/unparseable timestamp). Expired or time-unknown
live data blocks plotting. Recent, stale, imported, or manual weather cannot elevate the
result above Needs Verification. Manual weather requires an observation time.

## AEGL zone meaning

- Red: AEGL-3
- Orange: AEGL-2
- Yellow: AEGL-1

This mapping is used only for verified AEGL endpoints. The plotting path does not relabel
generic PAC, ERPG, or TEEL values as AEGL.

AEGL values are exposure endpoints, not predicted plume distances. Linking a verified
endpoint does not validate the release estimate, weather, or dispersion result.

## Known limitations

- Idealized point source, Gaussian dispersion, level terrain, and constant meteorology.
- No dense-gas/slumping behavior, terrain channeling, building wakes, deposition,
  chemical reaction, fire, or thermodynamic source-term model.
- Fixed sampling range and resolution can truncate or quantize reported extent.
- Surface roughness is a rural/urban selection; elevation is displayed but is not yet
  used in the dispersion equations.
- Stability class is currently a supported model input but the UI uses its existing
  planning default; it is not inferred from live observations.
- Output does not replace field monitoring, official modeling, agency SOPs, or Incident
  Command.

NOAA documents that ALOHA can select Gaussian or heavy-gas behavior and has limitations
from input quality, terrain, buildings, and atmospheric variability. HazMatIQ does not
claim ALOHA equivalence.

## Comparison cases and evidence gaps

| Case | Release scenario | Weather inputs | Selected endpoint | Expected distance/source | Tolerance | Actual | Result |
|---|---|---|---|---|---:|---:|---|
| Ammonia railcar | Continuous | Missing | AEGL-3 value missing in fixture | Missing | 20% configured | Not run | Skipped |
| Chlorine cylinder | Instantaneous heavy-gas ALOHA example | Present | AEGL-3, 60 min, 20 ppm | Published lower bound exists in NOAA/EPA ALOHA Example 3 | 20% configured | Not run | Skipped: no compatible puff evaluation time/model mapping |
| Published continuous release | Continuous | Missing | Missing | Missing | 20% configured | Not run | Skipped |
| Published puff release | Puff | Missing | Missing | Missing | 20% configured | Not run | Skipped |

The configured 20% screening tolerance is enforced only after a case is complete and
model-compatible. It is not evidence that 20% accuracy has been achieved. A published
minimum-distance case passes only if the modeled distance is no lower than the source
minimum after tolerance; an exact-distance case uses absolute fractional difference.

## Validation work required before GO

1. Obtain authorized, reproducible comparison cases for ammonia railcar, chlorine
   cylinder, continuous, and puff releases with all source-term and weather inputs.
2. Document whether each reference used Gaussian or dense-gas behavior and map inputs
   without inference.
3. Establish and review scenario-appropriate tolerance criteria before execution.
4. Run all cases; require no skipped or failed cases.
5. Review sampling-range sensitivity, unit conversions, low-wind behavior, stability and
   roughness coefficients, and source-term applicability.
6. Retain source/version evidence and an independent reviewer sign-off.

Until all required cases are runnable and pass, the validation gate must remain closed
and all calculated output remains a Planning Estimate or Needs Verification.
