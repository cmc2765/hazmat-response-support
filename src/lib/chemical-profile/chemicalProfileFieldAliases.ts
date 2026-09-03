export const CHEMICAL_PROFILE_FIELD_ALIASES = {
  idlh: ['idlh', 'nioshIdlh', 'niosh_idlh', 'immediatelyDangerousToLifeOrHealth', 'immediately_dangerous_to_life_or_health', 'exposureLimits.idlh', 'exposure_limits.idlh', 'IDLH'],
  aegl: ['aegl', 'aegls', 'aeglValues', 'aegl_values', 'AEGL', 'AEGL-1', 'AEGL-2', 'AEGL-3', 'aegl1', 'aegl2', 'aegl3', 'exposureLimits.aegl'],
  pel: ['pel', 'oshaPel', 'osha_pel', 'permissibleExposureLimit', 'exposureLimits.pel', 'PEL'],
  rel: ['rel', 'nioshRel', 'niosh_rel', 'recommendedExposureLimit', 'exposureLimits.rel', 'REL'],
  ergGuide: ['erg', 'ergGuide', 'ergGuideNumber', 'erg_guide', 'guideNumber', 'emergencyResponseGuide', 'ERG Guide'],
  isolationDistance: ['isolationDistance', 'initialIsolationDistance', 'initial_isolation_distance', 'ergInitialIsolation', 'initialIsolation', 'isolation'],
  protectiveActionDistance: ['protectiveActionDistance', 'protective_action_distance', 'protectiveActionDistanceDay', 'protectiveActionDistanceNight', 'protectiveAction', 'padDay', 'padNight', 'dayProtectiveAction', 'nightProtectiveAction', 'ergProtectiveAction', 'PAD'],
  vaporDensity: ['vaporDensity', 'vapor_density', 'relativeVaporDensity', 'gasDensity'],
  vaporPressure: ['vaporPressure', 'vapor_pressure'],
  specificGravity: ['specificGravity', 'specific_gravity', 'relativeDensity', 'liquidSpecificGravity'],
  molecularWeight: ['molecularWeight', 'molecular_weight', 'formulaWeight', 'mw'],
  boilingPoint: ['boilingPoint', 'boiling_point', 'bp'],
  flashPoint: ['flashPoint', 'flash_point'],
  lel: ['lel', 'lowerExplosiveLimit', 'lowerFlammableLimit', 'LEL'],
  uel: ['uel', 'upperExplosiveLimit', 'upperFlammableLimit', 'UEL'],
  nfpaHealth: ['nfpa.health', 'nfpa704.health', 'nfpaHealth', 'nfpa_health', 'healthRating', 'nfpa704Health'],
  nfpaFire: ['nfpa.fire', 'nfpa704.fire', 'nfpaFire', 'nfpa_fire', 'flammability', 'fireRating', 'nfpa704Fire', 'nfpa704Flammability'],
  nfpaReactivity: ['nfpa.reactivity', 'nfpa704.reactivity', 'nfpaInstability', 'nfpa_reactivity', 'nfpa_instability', 'reactivity', 'instability', 'reactivityRating', 'nfpa704Reactivity'],
  nfpaSpecial: ['nfpa.special', 'nfpa704.special', 'nfpaSpecial', 'nfpa_special', 'special', 'specialHazard', 'nfpa704Special'],
} as const;

export type ChemicalProfileField = keyof typeof CHEMICAL_PROFILE_FIELD_ALIASES;