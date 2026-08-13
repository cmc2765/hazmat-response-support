export const MODEL_VERSION = "0.1.0-plume-skeleton";
export const PLUME_MODEL_NAME = "HazMatIQ Gaussian plume/puff screening model";
export const PLUME_FORMULA_REFERENCE =
  "Gaussian plume and puff equations: NOAA Technical Memorandum ERL ARL-205, equation 2.3 and following Gaussian puff equation (https://www.arl.noaa.gov/wp_arl/wp-content/uploads/2017/08/ARL-205.pdf)";
export const PLUME_MODEL_LIMITATIONS = [
  "Screening model only: assumes an idealized point source, Gaussian dispersion, level terrain, and constant meteorology.",
  "Does not model dense-gas behavior, terrain channeling, buildings, deposition, chemical reaction, fire, or thermodynamic source terms.",
] as const;
export const PLUME_DISCLAIMER =
  "Calculated estimate using a screening Gaussian plume/puff model. Results depend on source-data quality and documented model limitations; confirm with an approved operational model such as ALOHA before safety decisions.";
