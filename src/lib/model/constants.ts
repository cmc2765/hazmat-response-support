export const MODEL_VERSION = "0.1.1-plume-screening";
export const PLUME_MODEL_NAME = "HazMatIQ Gaussian plume/puff screening model";
export const PLUME_FORMULA_REFERENCE =
  "Gaussian plume and puff equations: NOAA Technical Memorandum ERL ARL-205, equation 2.3 and following Gaussian puff equation (https://www.arl.noaa.gov/wp_arl/wp-content/uploads/2017/08/ARL-205.pdf)";
export const PLUME_MODEL_LIMITATIONS = [
  "Screening model only: assumes an idealized point source, Gaussian dispersion, level terrain, and constant meteorology.",
  "Does not model dense-gas behavior, terrain channeling, buildings, deposition, chemical reaction, fire, or thermodynamic source terms.",
] as const;
export const BASELINE_PLUME_MODEL_METADATA = {
  modelName: "HazMatIQ Baseline Plume Planning Model",
  modelStatus: "Planning Estimate",
  validationStatus: "Not independently validated",
  formulaStatus: "Existing application plume calculation",
  formulaReference: PLUME_FORMULA_REFERENCE,
  limitations: [
    "Planning estimate only",
    "Not independently validated against published ALOHA comparison cases",
    "Weather source and observation time must be verified",
    "Does not replace field monitoring",
    "Does not replace official modeling",
    "Incident Command must verify tactical decisions",
    ...PLUME_MODEL_LIMITATIONS,
  ],
} as const;
export const PLUME_DISCLAIMER =
  "Calculated estimate using a screening Gaussian plume/puff model. Results depend on source-data quality and documented model limitations; confirm with an approved operational model such as ALOHA before safety decisions.";
