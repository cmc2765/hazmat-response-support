# Plume validation source review

## Registered comparison candidate

NOAA/EPA, *ALOHA Example Scenarios* (September 2016), Example 3, pages 40–47:
https://response.restoration.noaa.gov/sites/default/files/ALOHA_Examples.pdf

- Chlorine: three damaged 150-pound cylinders, entered as one instantaneous
  450-pound direct source at ground level.
- Weather: 6 mph from east, 3 m measurement height, 72 °F, stability C,
  80% relative humidity, rural/open-country roughness.
- Threshold/result: 60-minute AEGL-3, 20 ppm, extending at least 1,484 yards.
- Repository conversion: 204.1165665 kg, 2.68224 m/s, 22.2222222 °C, and
  1,356.9696 m. These are unit conversions only.

## Compatibility disposition

Status: **blocked; not a validation run**.

ALOHA's documented case uses an instantaneous heavy-gas direct-source model. The
HazMatIQ puff implementation is Gaussian and requires an evaluation time. The source
does not publish a cloud evaluation time, and its 60-minute value describes AEGL
exposure averaging. Substituting that value would be an unsupported model/input
mapping. The fixture therefore preserves the source evidence but deliberately skips
execution.

An official ammonia railcar expected-distance case with all inputs needed for a direct
comparison was not located in the reviewed NOAA/EPA materials. The ammonia railcar
fixture remains a placeholder. A qualified model owner must approve a reproducible
cross-model mapping or provide a directly compatible benchmark before this gate can
pass.
