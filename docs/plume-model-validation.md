# HazMatIQ plume model validation record

## Release decision

Current gate: **NO-GO for a validated-model claim**.

The application may produce a **HazMatIQ Planning Estimate** when chemical identity,
a verified AEGL endpoint, direct source strength, location, and usable weather are
available. It must not describe that result as ALOHA-equivalent, independently
validated, or operationally precise. Official ALOHA files may be imported and displayed
with the label **Official ALOHA Output Imported — displayed by HazMatIQ** only after the
operator confirms the source. HazMatIQ does not recalculate imported output.

## Implemented model and geometry

- Continuous release: steady-state Gaussian point source with ground reflection.
- Puff release: Gaussian puff at an explicit evaluation time.
- Dispersion coefficients: existing rural/urban Pasquill-Gifford/Briggs functions.
- Toxic endpoints: reviewed, duration-specific EPA final AEGL values linked by exact
  Chemical Companion master record and CAS number.
- Modeled AEGL output: three nested contours, red AEGL-3, orange AEGL-2, yellow AEGL-1.
- Geometry correction: the downwind centerline threshold crossing is solved by
  bisection. The former implementation stopped at the last coarse grid sample, leaving
  a nonzero-width flat tail that could appear box-shaped and under-report the endpoint.

The endpoint refinement changes numerical contour construction only; it does not change
the Gaussian concentration equations or establish scientific validation.

An ERG isolation/protective-action area is deliberately rectangular/downwind plus an
initial-isolation circle. It is labeled **ERG Isolation / Protective Action Overlay —
Not a Plume Model** and must never be presented as an AEGL concentration cone.

## Source-strength status

The current solver accepts a direct operator-provided continuous release rate or puff
mass. It does not derive thermodynamic leak rate, flashing fraction, pool evaporation,
jet momentum, fire, or explosion source terms. Source-strength output records required,
provided, and missing inputs, method, value/units, status, and limitations. Missing
source strength blocks the dispersion calculation; incomplete context restricts it to a
planning estimate.

## Model selection and chemical applicability

The selector records Gaussian neutral gas, heavy/dense gas, continuous, puff, pool,
jet, fire/explosion, ERG-only, or no-model status. Dense-gas chemicals are explicitly
flagged because the current Gaussian equations do not model slumping or dense-gas
behavior. Pool, jet, fire, and explosion source terms are unsupported and require
review; no hidden fallback is treated as validated physics.

## Weather validation

Required weather is positive wind speed, wind-from direction, an identified source,
and observation time unless the operator explicitly selects manual entry. Freshness:

- Current: 0–10 minutes
- Recent / Verify: over 10–30 minutes
- Stale: over 30–60 minutes
- Expired: over 60 minutes
- Time Unknown: missing or invalid timestamp

Current or recent identified live observations are eligible for a future validated
workflow. Manual, stale, expired, or time-unknown conditions never elevate the current
solver above planning/review status. No wind speed blocks calculation.

## AEGL / LOC evidence rules

AEGL values are exposure endpoints, not predicted distances. The plume API accepts only
reviewed endpoint records linked by exact CAS and master chemical identity; it does not
interpolate durations or substitute ERPG, TEEL, IDLH, occupational limits, or guessed
values. If AEGL is unavailable, a source-backed ERG overlay may be shown. If neither is
available, the result is **No Current Data Exists**.

Chemical Profile display grouping into `< 1 Hour`, `1–4 Hours`, `4–8 Hours`, and
`8–12 Hours` is presentation-only. It does not alter the plume endpoint catalog or the
duration-specific AEGL values supplied to the calculation.

## Comparison matrix

| Case | Reference output | Current status | Pass/fail |
|---|---|---|---|
| Ammonia railcar release | Official compatible output unavailable | Skipped | Not counted |
| Chlorine cylinder release | NOAA/EPA ALOHA Example 3 candidate; incompatible heavy-gas/time mapping unresolved | Skipped | Not counted |
| Dense-gas case | Official output unavailable | Skipped | Not counted |
| Neutral-gas case | Official output unavailable | Skipped | Not counted |
| Low-wind stable case | Official output unavailable | Skipped | Not counted |
| Moderate-wind neutral case | Official output unavailable | Skipped | Not counted |
| Urban-roughness case | Official output unavailable | Skipped | Not counted |
| Rural-roughness case | Official output unavailable | Skipped | Not counted |

Configured screening tolerance is 20% after a case is complete and model-compatible.
It is not an accuracy claim. Validation may become `validated` only when all eight cases
have cited reference output, all inputs can be mapped without inference, no case is
skipped, and every case passes.

## Assumptions and limitations

- Level terrain and constant meteorology across the footprint.
- Elevation may be recorded but is not applied to dispersion.
- No terrain channeling, building wake, deposition, chemical reaction, or time-varying
  wind field.
- Rural/urban roughness is a categorical operator selection.
- Input and source-term uncertainty can dominate numerical contour precision.
- A computational boundary can truncate a zone; such distance is a lower bound.
- Output does not replace official modeling, field monitoring, agency SOPs, qualified
  technical review, or Incident Command.

## Field verification and tactical use

Confirm identity, CAS, container, phase, source strength, release height/duration,
weather source/time, wind, and endpoint. Establish actual hot/warm/cold boundaries with
field monitoring and keep prior/current results timestamped when conditions change.
Plume output alone cannot downgrade PPE, respiratory protection, or authorize offensive
tactics. Missing or conflicting evidence must bias Guided Response toward verification,
conservative protection, and defensive posture.
