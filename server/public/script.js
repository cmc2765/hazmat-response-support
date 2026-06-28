const buttons = document.querySelectorAll('.module-btn');
const views = document.querySelectorAll('.view');

const tacticalAlertMessage = document.getElementById('tactical-alert-message');
const notificationWeather = document.getElementById('notification-weather');
const notificationMonitoring = document.getElementById('notification-monitoring');
const notificationUpdated = document.getElementById('notification-updated');

function updateNotificationCenter(update = {}) {
  if (Object.prototype.hasOwnProperty.call(update, 'tactical') && tacticalAlertMessage) {
    tacticalAlertMessage.textContent = update.tactical;
  }
  if (Object.prototype.hasOwnProperty.call(update, 'weather') && notificationWeather) {
    notificationWeather.textContent = update.weather;
  }
  if (Object.prototype.hasOwnProperty.call(update, 'monitoring') && notificationMonitoring) {
    notificationMonitoring.textContent = update.monitoring;
  }

  if (notificationUpdated) {
    const updatedAt = update.timestamp ? new Date(update.timestamp) : new Date();
    const safeUpdatedAt = Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt;
    notificationUpdated.dateTime = safeUpdatedAt.toISOString();
    notificationUpdated.textContent = `Updated ${safeUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}

window.HazMatIQ = window.HazMatIQ || {};
window.HazMatIQ.updateNotifications = updateNotificationCenter;

document.addEventListener('hazmatiq:telemetry', (event) => {
  updateNotificationCenter(event.detail || {});
});

const monitorReadingElements = document.querySelectorAll('[data-monitor-reading]');

function syncMonitorNotification() {
  const readingSummary = Array.from(monitorReadingElements)
    .map((element) => `${element.dataset.monitorReading} ${element.textContent.trim()}`)
    .join(' · ');

  if (readingSummary) updateNotificationCenter({ monitoring: readingSummary });
}

if (monitorReadingElements.length) {
  const monitorObserver = new MutationObserver(syncMonitorNotification);
  monitorReadingElements.forEach((element) => {
    monitorObserver.observe(element, { childList: true, characterData: true, subtree: true });
  });
  syncMonitorNotification();
}

function showView(targetId) {
  buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === targetId));
  views.forEach((view) => view.classList.toggle('active', view.id === targetId));
}

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.view) {
      showView(button.dataset.view);
    }
  });

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      button.click();
    }
  });
});

const incidentTaskButtons = document.querySelectorAll('.incident-task-btn');
const incidentFocusLabel = document.getElementById('incident-focus-label');
const incidentFocusDetail = document.getElementById('incident-focus-detail');

const incidentTaskDetails = {
  identify: {
    label: 'Identify the product and confirm the verified source before action.',
    detail: '<strong>Active workflow:</strong> Chemical identification and reference review.'
  },
  erg: {
    label: 'Pull the ERG guidance and confirm immediate isolation and hazard information.',
    detail: '<strong>Active workflow:</strong> Emergency Response Guidebook reference and hazard summary.'
  },
  plume: {
    label: 'Run the plume model and review the predictive hazard footprint.',
    detail: '<strong>Active workflow:</strong> Plume modeling and downwind hazard planning.'
  },
  zones: {
    label: 'Define hot zone, warm zone, and public protection boundaries.',
    detail: '<strong>Active workflow:</strong> Zone management and scene control.'
  },
  entry: {
    label: 'Prepare the entry plan and verify access, accountability, and monitoring needs.',
    detail: '<strong>Active workflow:</strong> Entry operations and access control.'
  },
  decon: {
    label: 'Set the decontamination corridor and isolate contaminated runoff.',
    detail: '<strong>Active workflow:</strong> Decon setup and contamination control.'
  },
  monitoring: {
    label: 'Check environmental monitoring and detector information before entry.',
    detail: '<strong>Active workflow:</strong> Air monitoring and atmospheric assessment.'
  },
  evacuation: {
    label: 'Review protective actions for the public and notify exposed populations.',
    detail: '<strong>Active workflow:</strong> Evacuation and sheltering coordination.'
  },
  ics: {
    label: 'Open the ICS report package and documentation workflow.',
    detail: '<strong>Active workflow:</strong> Incident documentation and command reporting.'
  }
};

function setIncidentTask(taskName) {
  incidentTaskButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.task === taskName);
  });

  const task = incidentTaskDetails[taskName] || incidentTaskDetails.identify;
  if (incidentFocusLabel) incidentFocusLabel.textContent = task.label;
  if (incidentFocusDetail) incidentFocusDetail.innerHTML = task.detail;
}

incidentTaskButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const taskName = button.dataset.task || 'identify';
    setIncidentTask(taskName);
    if (button.dataset.view) {
      showView(button.dataset.view);
    }
  });
});

setIncidentTask('identify');

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.view) {
      showView(button.dataset.view);
    }
  });

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      button.click();
    }
  });
});

// ─── Chemical lookup/card: backed by the real API (207-chemical dataset, NPG, thresholds) ───

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parseJsonField(value, fallback) {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatThresholdGroup(thresholdRows, kind) {
  const rows = thresholdRows.filter((t) => t.kind === kind).sort((a, b) => a.level - b.level);
  if (!rows.length) return 'Not available for this chemical';
  return rows.map((t) => `${kind}-${t.level} ${Number(t.valuePpm).toLocaleString()} ppm`).join(' / ');
}

function chemicalRecordFromApi(chem, npg, thresholdRows) {
  const synonyms = parseJsonField(chem.synonyms, []);
  const cas = parseJsonField(chem.cas, []) || [];
  const un = parseJsonField(chem.un, []) || [];
  const hazardClass = parseJsonField(chem.hazardClass, []) || [];
  const ppe = parseJsonField(chem.ppe, []) || [];
  const isolation = parseJsonField(chem.isolation, {}) || {};
  const firstAid = parseJsonField(chem.firstAid, []) || [];
  const reactivity = parseJsonField(chem.reactivity, []) || [];
  const incompatibilities = parseJsonField(chem.incompatibilities, []) || [];
  const sources = parseJsonField(chem.sources, []) || [];

  const exposureLimits = npg ? parseJsonField(npg.exposureLimits, {}) : {};
  const physical = npg ? parseJsonField(npg.physical, {}) : {};
  const health = npg ? parseJsonField(npg.health, {}) : {};

  const actions = [isolation.initial, isolation.protective, ...ppe, ...firstAid].filter(Boolean);

  return {
    name: chem.name,
    aliases: synonyms,
    summary: hazardClass.length
      ? `Hazard class ${hazardClass.join('/')}. ${health.symptoms?.length ? 'Symptoms: ' + health.symptoms.slice(0, 3).join(', ') + '.' : `Refer to ERG Guide ${chem.ergGuide || 'N/A'}.`}`
      : `Refer to ERG Guide ${chem.ergGuide || 'N/A'} for hazard summary.`,
    primaryHazard: hazardClass.join(' / ') || 'See ERG guide',
    immediateActions: actions.slice(0, 6).join(' · ') || `Refer to ERG Guide ${chem.ergGuide || 'N/A'}`,
    ergGuide: chem.ergGuide || 'N/A',
    dotClass: hazardClass.join(' / ') || 'N/A',
    physicalState: physical.bp ? `Boiling point ${physical.bp} (see physical data)` : 'Not modeled in this dataset',
    idlh: exposureLimits.idlh || 'Not in NIOSH dataset',
    aeGL: formatThresholdGroup(thresholdRows, 'AEGL'),
    erpg: formatThresholdGroup(thresholdRows, 'ERPG'),
    pac: formatThresholdGroup(thresholdRows, 'TEEL'),
    majorConcern: health.targetOrgans?.length ? `Target organs: ${health.targetOrgans.join(', ')}` : (reactivity[0] || 'Refer to SDS'),
    recommendedMode: 'HazMat Technician Operations',
    actions: actions.length ? actions : ['Refer to ERG guide and department SOPs'],
    advanced: [
      ['CAS', cas[0] || 'N/A'],
      ['UN', un[0] || 'N/A'],
      ['Molecular Weight', chem.molecularWeight ? `${chem.molecularWeight} g/mol` : (physical.mw ? `${physical.mw} g/mol` : 'N/A')],
      ['Boiling Point', physical.bp || 'N/A'],
      ['Flash Point', physical.flPt || 'N/A'],
      ['LEL / UEL', (physical.lel || physical.uel) ? `${physical.lel || '—'} / ${physical.uel || '—'}` : 'N/A'],
      ['IDLH', exposureLimits.idlh || 'N/A'],
      ['AEGL', formatThresholdGroup(thresholdRows, 'AEGL')],
      ['ERPG', formatThresholdGroup(thresholdRows, 'ERPG')],
      ['TEEL (PAC basis)', formatThresholdGroup(thresholdRows, 'TEEL')],
      ['Reactivity', reactivity.join('; ') || 'N/A'],
      ['Incompatibilities', incompatibilities.join(', ') || 'N/A'],
      ['PPE References', ppe.join(', ') || 'N/A'],
      ['Decon References', `Per ERG Guide ${chem.ergGuide || '—'} and department SOPs`],
    ],
    sources: sources.length
      ? sources.map((s) => (typeof s === 'string' ? s : s.source || JSON.stringify(s)))
      : ['CAMEO Chemicals', 'ERG 2024'],
  };
}

async function buildFullChemicalRecord(chem) {
  const [npg, thresholdsData] = await Promise.all([
    fetchJson(`/api/npg/${encodeURIComponent(chem.id)}`),
    fetchJson(`/api/thresholds?chemicalId=${encodeURIComponent(chem.id)}`),
  ]);
  const thresholdRows = (thresholdsData?.thresholds || []).map((t) => ({ ...t, valuePpm: Number(t.valuePpm) }));
  return chemicalRecordFromApi(chem, npg && !npg.error ? npg : null, thresholdRows);
}

let defaultChemicalRecordPromise = null;
function getDefaultChemicalRecord() {
  if (!defaultChemicalRecordPromise) {
    defaultChemicalRecordPromise = fetchJson('/api/chemicals/ammonia').then((chem) =>
      chem && !chem.error ? buildFullChemicalRecord(chem) : null,
    );
  }
  return defaultChemicalRecordPromise;
}

async function findChemicalRecord(value) {
  const query = String(value || '').trim();
  if (!query) return getDefaultChemicalRecord();

  const data = await fetchJson(`/api/chemicals?q=${encodeURIComponent(query)}`);
  const chem = data?.chemicals?.[0];
  if (!chem) return getDefaultChemicalRecord();
  return buildFullChemicalRecord(chem);
}

function updateChemicalCard(record) {
  if (!record) return;

  document.getElementById('chemical-name').textContent = record.name;
  document.getElementById('chemical-summary').textContent = record.summary;
  document.getElementById('chemical-primary-hazard').textContent = record.primaryHazard;
  document.getElementById('chemical-immediate-actions').textContent = record.immediateActions;
  document.getElementById('chemical-erg-guide').textContent = record.ergGuide;
  document.getElementById('chemical-major-concern').textContent = record.majorConcern;
  document.getElementById('chemical-recommended-mode').textContent = record.recommendedMode;

  const actionsList = document.getElementById('chemical-actions-list');
  actionsList.innerHTML = record.actions.map((item) => `<li>${item}</li>`).join('');

  const advancedList = document.getElementById('chemical-advanced-list');
  advancedList.innerHTML = record.advanced.map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join('');

  const sourceList = document.getElementById('chemical-source-list');
  sourceList.innerHTML = record.sources.map((item) => `<li>${item}</li>`).join('');

  const lookupSource = document.getElementById('lookup-verified-source');
  const lookupUn = document.getElementById('lookup-un');
  const lookupErg = document.getElementById('lookup-erg-guide');
  const lookupDot = document.getElementById('lookup-dot-class');
  const lookupPhysical = document.getElementById('lookup-physical-state');
  const lookupIdlh = document.getElementById('lookup-idlh');
  const lookupPpe = document.getElementById('lookup-ppe-decon');

  if (lookupSource) lookupSource.textContent = 'ERG · NIOSH · SDS · E-Plan';
  if (lookupUn) lookupUn.textContent = record.advanced.find(([label]) => label === 'UN')?.[1] || 'N/A';
  if (lookupErg) lookupErg.textContent = record.ergGuide;
  if (lookupDot) lookupDot.textContent = record.dotClass;
  if (lookupPhysical) lookupPhysical.textContent = record.physicalState;
  if (lookupIdlh) lookupIdlh.textContent = `${record.idlh} · ${record.aeGL} · ${record.pac}`;
  if (lookupPpe) lookupPpe.textContent = `${record.actions[1]} · decon corridor · EMS coordination`;
}

async function lookupChemical() {
  const searchInput = document.getElementById('chemical-search');
  const record = await findChemicalRecord(searchInput?.value || '');
  updateChemicalCard(record);
  showView('card');
}

const lookupButton = document.getElementById('chemical-lookup-btn');
if (lookupButton) {
  lookupButton.addEventListener('click', lookupChemical);
}

let currentPlumeMode = 'street';
let currentScenario = 'quick';

function parseGpsCoordinate(value) {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?)\s*[,/ ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return { lat: 33.2862, lon: -86.7900 };
  }

  return {
    lat: Number(match[1]),
    lon: Number(match[2]),
  };
}

function getScenarioProfile(scenarioName = currentScenario) {
  const profiles = {
    quick: {
      label: 'Quick model',
      distance: 750,
      zone: 'Initial hot zone and isolation perimeter',
      decon: 'Crosswind/upwind side of the release',
      concern: 'Rapid screening for immediate protective actions',
      side: 'upwind/crosswind',
    },
    advanced: {
      label: 'Advanced model',
      distance: 1200,
      zone: 'Extended isolation and downwind receptor review',
      decon: 'Crosswind/upwind side with a clear access corridor',
      concern: 'More detailed receptor and terrain evaluation',
      side: 'Bravo/Charlie side',
    },
    alohac: {
      label: 'ALOHA-compatible output',
      distance: 1100,
      zone: 'ALOHA-style footprint with hazard buffer',
      decon: 'Crosswind/upwind side with public-protection review',
      concern: 'Compatible with ALOHA-style modeling assumptions',
      side: 'upwind/crosswind',
    },
    toxic: {
      label: 'Toxic plume',
      distance: 1300,
      zone: 'Toxic inhalation exposure envelope',
      decon: 'Crosswind/upwind side and respiratory-protection corridor',
      concern: 'Focused on toxic exposure and sheltering thresholds',
      side: 'Bravo/Charlie side',
    },
    flammable: {
      label: 'Flammable plume',
      distance: 1500,
      zone: 'Flammable vapor cloud buffer',
      decon: 'Crosswind/upwind side with ignition-source control',
      concern: 'Accounts for vapor cloud ignition potential',
      side: 'upwind/crosswind',
    },
    fire: {
      label: 'Fire model',
      distance: 1700,
      zone: 'Thermal exposure and fire spread perimeter',
      decon: 'Crosswind/upwind side with remote staging',
      concern: 'Includes fire growth and thermal effects',
      side: 'upwind/crosswind',
    },
    bleve: {
      label: 'BLEVE model',
      distance: 2200,
      zone: 'Fragment and thermal blast consideration',
      decon: 'Crosswind/upwind side with evacuation buffer',
      concern: 'Addresses BLEVE-related overpressure and fragment hazards',
      side: 'Bravo/Charlie side',
    },
    vce: {
      label: 'Vapor cloud explosion model',
      distance: 2400,
      zone: 'Blast overpressure perimeter',
      decon: 'Crosswind/upwind side with remote operations',
      concern: 'Focused on vapor cloud explosion consequences',
      side: 'upwind/crosswind',
    },
    'wind-shift': {
      label: 'Wind shift forecast',
      distance: 1400,
      zone: 'Shift-aware hot and warm zone planning',
      decon: 'Crosswind/upwind side and avoid projected wind-shift corridors',
      concern: 'Accounts for a forecast wind change and alternate plume path',
      side: 'upwind/crosswind',
    },
    realtime: {
      label: 'Real-time sensor update',
      distance: 1050,
      zone: 'Dynamic hazard envelope with frequent reassessment',
      decon: 'Crosswind/upwind side and alternate route review',
      concern: 'Continuously updated with the latest weather and observations',
      side: 'upwind/crosswind',
    },
    export: {
      label: 'Export to KML / GeoJSON / PDF',
      distance: 1000,
      zone: 'Export-ready plume and mapping package',
      decon: 'Crosswind/upwind side with package-ready route notes',
      concern: 'Prepared for KML, GeoJSON, and PDF export',
      side: 'upwind/crosswind',
    },
  };

  return profiles[scenarioName] || profiles.quick;
}

// Scenarios that are genuine toxic vapor dispersion (what the Gaussian plume model computes).
// fire/bleve/vce are thermal/blast phenomena and flammable is LEL-based — none of those are
// represented by this model, so they keep the rough placeholder distance rather than being
// mislabeled as real model output.
const MODELED_SCENARIOS = new Set(['quick', 'advanced', 'alohac', 'toxic', 'wind-shift', 'realtime']);

const COMPASS_TO_DEGREES = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

function parseWind(windText) {
  const match = String(windText || '').match(/(\d+(?:\.\d+)?)\s*mph\s*([NSEW]{1,3})/i);
  const speedMph = match ? Number(match[1]) : 8;
  const dirDeg = match ? (COMPASS_TO_DEGREES[match[2].toUpperCase()] ?? 270) : 270;
  return { speedMph, windSpeedMps: speedMph * 0.44704, windDirDeg: dirDeg };
}

function parseStabilityClass(stabilityText) {
  const text = String(stabilityText || '').toLowerCase();
  if (text.includes('unstable')) return 'B';
  if (text.includes('very stable')) return 'F';
  if (text.includes('stable')) return 'E';
  return 'D';
}

let plumeRequestToken = 0;

async function runRealPlumeModel(scenarioName) {
  const chemNameInput = document.getElementById('chemical-name-input');
  const windInput = document.getElementById('wind');
  const stabilityInput = document.getElementById('stability');
  const releaseDetailsInput = document.getElementById('release-details');

  const chemQuery = chemNameInput?.value || 'ammonia';
  const chemMatch = await fetchJson(`/api/chemicals?q=${encodeURIComponent(chemQuery)}`);
  const chemicalId = chemMatch?.chemicals?.[0]?.id || 'ammonia';

  const { windSpeedMps, windDirDeg } = parseWind(windInput?.value);
  const stabilityClass = parseStabilityClass(stabilityInput?.value);
  const releaseKind = /instantaneous/i.test(releaseDetailsInput?.value || '') ? 'puff' : 'plume';

  const result = await (async () => {
    const res = await fetch('/api/plume/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chemicalId,
        releaseKind,
        windSpeedMps,
        windDirDeg,
        stabilityClass,
        tempC: 20,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  })();

  if (!result) return null;

  const maxDownwindM = Math.max(0, ...result.isopleths.map((i) => i.maxDownwindM));
  return {
    distanceFt: Math.round(maxDownwindM * 3.28084),
    modelVersion: result.modelVersion,
    disclaimer: result.disclaimer,
    chemicalId,
  };
}

async function updatePlumeOutputs() {
  const gpsInput = document.getElementById('gps-location');
  const titleInput = document.getElementById('incident-location');
  const titleEl = document.getElementById('plume-map-title');
  const subtitleEl = document.getElementById('plume-map-subtitle');
  const statusEl = document.getElementById('plume-map-status');
  const gpsSummaryEl = document.getElementById('plume-gps-summary');
  const weatherStatus = document.getElementById('weather-status');
  const stationSelect = document.getElementById('weather-station');
  const windInput = document.getElementById('wind');
  const stabilityInput = document.getElementById('stability');
  const weatherSummaryEl = document.getElementById('scenario-weather-summary');
  const scenarioNameEl = document.getElementById('scenario-name');
  const scenarioBadgeEl = document.getElementById('scenario-badge');
  const zoneDistanceEl = document.getElementById('zone-distance');
  const zoneSummaryEl = document.getElementById('zone-summary');
  const deconSummaryEl = document.getElementById('decon-summary');
  const receptorSummaryEl = document.getElementById('receptor-summary');
  const recommendationEl = document.getElementById('plume-recommendation');

  const { lat, lon } = parseGpsCoordinate(gpsInput?.value || '33.2862, -86.7900');
  const incidentLabel = titleInput?.value || 'Incident location';
  const mapModeLabel = currentPlumeMode === 'satellite' ? 'Satellite' : 'Street';
  const safeLat = Number.isFinite(lat) ? lat : 33.2862;
  const safeLon = Number.isFinite(lon) ? lon : -86.7900;
  const profile = getScenarioProfile(currentScenario);
  const windValue = windInput?.value || '8 mph SW';
  const stabilityValue = stabilityInput?.value || 'Neutral / inversion possible';
  const stationValue = stationSelect?.value || 'North Gate Station';
  const windMatch = String(windValue).match(/(\d+)\s*mph\s*([NSEW]{1,2})/i);
  const speed = windMatch ? Number(windMatch[1]) : 8;
  const weatherText = `${stationValue} · ${windValue} · ${stabilityValue}`;

  updateNotificationCenter({ weather: weatherText });

  const token = ++plumeRequestToken;
  let distanceFt = profile.distance + (speed * 18);
  let modelNote = 'Placeholder estimate — this scenario type is not yet covered by the dispersion model.';
  if (MODELED_SCENARIOS.has(currentScenario)) {
    const modeled = await runRealPlumeModel(currentScenario);
    if (token !== plumeRequestToken) return; // a newer input event superseded this run
    if (modeled) {
      distanceFt = modeled.distanceFt;
      modelNote = `${modeled.disclaimer} (model ${modeled.modelVersion})`;
    } else {
      modelNote = 'Model unavailable — showing placeholder estimate.';
    }
  }

  if (titleEl) titleEl.textContent = incidentLabel;
  if (subtitleEl) subtitleEl.textContent = `GPS ${safeLat.toFixed(4)}, ${safeLon.toFixed(4)} · Google Maps base showing homes, businesses, and nearby structures`;
  if (gpsSummaryEl) gpsSummaryEl.textContent = `${safeLat.toFixed(4)}, ${safeLon.toFixed(4)}`;
  if (statusEl) statusEl.textContent = `Basemap: ${mapModeLabel}`;
  if (weatherSummaryEl) weatherSummaryEl.textContent = weatherText;
  if (scenarioNameEl) scenarioNameEl.textContent = profile.label;
  if (scenarioBadgeEl) scenarioBadgeEl.textContent = profile.label;
  if (zoneDistanceEl) zoneDistanceEl.textContent = `Establish the hot zone from the release point to ${distanceFt} feet downwind. ${modelNote}`;
  if (zoneSummaryEl) zoneSummaryEl.textContent = `${profile.zone} with zonal buffers based on the current weather and surface conditions.`;
  if (deconSummaryEl) deconSummaryEl.textContent = `Position decon ${profile.decon} and keep the ${profile.side} side clear for access.`;
  if (receptorSummaryEl) receptorSummaryEl.textContent = `Nearby homes, businesses, and infrastructure should be reviewed in the Google map view for receptor impact.`;
  if (weatherStatus) weatherStatus.textContent = `Live weather: ${stationValue} · latest update 2 min ago`;
  if (recommendationEl) {
    recommendationEl.innerHTML = `<strong>Recommendation</strong><p>Based on current inputs, establish the hot zone from the release point to ${distanceFt} feet downwind. Position decon ${profile.decon} and keep the ${profile.side} side clear for access. Avoid staging in the projected wind-shift area. Reassess every 10 minutes or with any wind change. Use AI and verified sources from NIOSH, Emergency Response Plans, SDS datasheets, and HazMat Specialists and Technician best practices to determine the best tactical operations.</p><p class="muted">${modelNote}</p>`;
  }

  const mapFrame = document.getElementById('plume-gis-map');
  if (mapFrame) {
    const mapType = currentPlumeMode === 'satellite' ? 'k' : 'm';
    mapFrame.src = `https://www.google.com/maps?q=${safeLat},${safeLon}&t=${mapType}&z=16&output=embed`;
  }
}

function updatePlumeMap(mode = currentPlumeMode) {
  currentPlumeMode = mode;
  updatePlumeOutputs();
}

const plumeButton = document.getElementById('open-plume-btn');
if (plumeButton) {
  plumeButton.addEventListener('click', () => {
    showView('plume');
    updatePlumeMap(currentPlumeMode);
  });
}

document.querySelectorAll('.plume-mode-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.plume-mode-btn').forEach((item) => item.classList.toggle('active', item === button));
    updatePlumeMap(button.dataset.mapMode || 'street');
  });
});

document.querySelectorAll('.scenario-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.scenario-btn').forEach((item) => item.classList.toggle('active', item === button));
    currentScenario = button.dataset.scenario || 'quick';
    updatePlumeOutputs();
  });
});

document.querySelectorAll('.tool-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach((item) => item.classList.toggle('active', item === button));
  });
});

['gps-location', 'incident-location', 'map-pin', 'terrain', 'chemical-name-input', 'release-rate', 'container', 'release-details', 'wind', 'stability', 'weather-station', 'weather-notes'].forEach((id) => {
  const element = document.getElementById(id);
  if (!element) return;

  element.addEventListener('input', () => updatePlumeMap(currentPlumeMode));
  element.addEventListener('change', () => updatePlumeMap(currentPlumeMode));
});

updatePlumeMap(currentPlumeMode);

const chemicalSearchInput = document.getElementById('chemical-search');
if (chemicalSearchInput) {
  chemicalSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      lookupChemical();
    }
  });
}

// ─── Tier II facilities: backed by the real /api/facilities data ───

let tier2FacilitiesPromise = null;
function getTier2Facilities() {
  if (!tier2FacilitiesPromise) {
    tier2FacilitiesPromise = fetchJson('/api/facilities').then((data) => data?.facilities || []);
  }
  return tier2FacilitiesPromise;
}

async function getFacilityChemicalNames(facilityId) {
  const detail = await fetchJson(`/api/facilities/${encodeURIComponent(facilityId)}`);
  const rows = detail?.chemicals || [];
  const names = await Promise.all(
    rows.map(async (fc) => {
      const chem = await fetchJson(`/api/chemicals/${encodeURIComponent(fc.chemicalId)}`);
      return chem?.name || fc.chemicalId;
    }),
  );
  return names;
}

async function renderTier2Results(query = '') {
  const resultsContainer = document.getElementById('tier2-results');
  const detailContainer = document.getElementById('tier2-detail');
  if (!resultsContainer || !detailContainer) return;

  const facilities = await getTier2Facilities();
  const normalized = query.toLowerCase().trim();
  const filtered = facilities.filter((facility) => {
    if (!normalized) return true;
    return [facility.name, facility.address].some((value) => value.toLowerCase().includes(normalized));
  });

  resultsContainer.innerHTML = '';
  detailContainer.innerHTML = '';

  if (!filtered.length) {
    resultsContainer.innerHTML = '<p class="muted">No facilities matched that term.</p>';
    return;
  }

  filtered.forEach((facility) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tier2-result-btn';
    button.innerHTML = `<strong>${facility.name}</strong>${facility.address}`;
    button.addEventListener('click', async () => {
      detailContainer.innerHTML = '<p class="muted">Loading facility chemicals…</p>';
      const chemNames = await getFacilityChemicalNames(facility.id);
      detailContainer.innerHTML = `
        <strong>${facility.name}</strong>
        <p>${facility.address}</p>
        <p><strong>Tier II chemicals:</strong> ${chemNames.join(', ') || 'None on file'}</p>
        <p>Source: ${facility.source} · Last updated ${facility.lastUpdated}</p>
      `;
    });
    resultsContainer.appendChild(button);
  });
}

const tier2SearchButton = document.getElementById('tier2-search-btn');
const tier2SearchInput = document.getElementById('tier2-search');
if (tier2SearchButton && tier2SearchInput) {
  tier2SearchButton.addEventListener('click', () => renderTier2Results(tier2SearchInput.value));
  tier2SearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      renderTier2Results(tier2SearchInput.value);
    }
  });
}

renderTier2Results();
getDefaultChemicalRecord().then(updateChemicalCard);

const homeButtons = document.querySelectorAll('#home .primary-btn');
homeButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    const viewNames = ['incident', 'lookup', 'plume', 'map'];
    const target = viewNames[index];
    document.querySelector(`[data-view="${target}"]`).click();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('module-btn')) {
    event.preventDefault();
    document.activeElement.click();
  }
});

// Placement below is a relative-position approximation from real lat/lng (normalized into
// the visible placeholder area), not a real map projection. A proper OpenStreetMap/MapLibre
// view with accurate placement is planned (see PLAN notes) — this just keeps real facility
// data visible until that lands.
async function renderTier2Facilities() {
  const container = document.getElementById('tier2-facility-layer');
  const card = document.getElementById('tier2-facility-card');
  if (!container || !card) return;

  const facilities = (await getTier2Facilities()).filter((f) => f.lat != null && f.lng != null);
  container.innerHTML = '';
  if (!facilities.length) return;

  const lats = facilities.map((f) => Number(f.lat));
  const lngs = facilities.map((f) => Number(f.lng));
  const latRange = [Math.min(...lats), Math.max(...lats)];
  const lngRange = [Math.min(...lngs), Math.max(...lngs)];
  const spread = (value, [min, max]) => (max === min ? 50 : ((value - min) / (max - min)) * 70 + 15);

  facilities.forEach((facility) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tier2-facility-pin';
    button.textContent = facility.name;
    button.style.left = `${spread(Number(facility.lng), lngRange)}%`;
    button.style.top = `${100 - spread(Number(facility.lat), latRange)}%`;
    button.addEventListener('click', async () => {
      card.innerHTML = `<h4>${facility.name}</h4><p>${facility.address}</p><p>Loading Tier II chemicals…</p>`;
      card.hidden = false;
      const chemNames = await getFacilityChemicalNames(facility.id);
      card.innerHTML = `
        <h4>${facility.name}</h4>
        <p>${facility.address}</p>
        <p>Tier II chemicals: ${chemNames.join(', ') || 'None on file'}</p>
      `;
    });
    container.appendChild(button);
  });
}

const draggableMarkers = document.querySelectorAll('.map-placeholder .map-marker.command, .map-placeholder .map-marker.staging');
let activeDrag = null;

draggableMarkers.forEach((marker) => {
  marker.addEventListener('pointerdown', (event) => {
    const rect = marker.getBoundingClientRect();
    activeDrag = {
      marker,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    marker.classList.add('dragging');
    marker.setPointerCapture(event.pointerId);
  });

  marker.addEventListener('pointerup', (event) => {
    if (activeDrag && activeDrag.marker === marker) {
      activeDrag = null;
    }
    marker.classList.remove('dragging');
    marker.releasePointerCapture(event.pointerId);
  });
});

document.addEventListener('pointermove', (event) => {
  if (!activeDrag) return;

  const container = activeDrag.marker.parentElement;
  const rect = container.getBoundingClientRect();
  const left = Math.min(Math.max(event.clientX - rect.left - activeDrag.offsetX, 8), rect.width - activeDrag.marker.offsetWidth - 8);
  const top = Math.min(Math.max(event.clientY - rect.top - activeDrag.offsetY, 8), rect.height - activeDrag.marker.offsetHeight - 8);

  activeDrag.marker.style.left = `${left}px`;
  activeDrag.marker.style.top = `${top}px`;
});

document.addEventListener('pointerup', () => {
  if (activeDrag) {
    activeDrag.marker.classList.remove('dragging');
    activeDrag = null;
  }
});

renderTier2Facilities();
