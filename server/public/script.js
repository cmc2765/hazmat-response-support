const buttons = document.querySelectorAll('.module-btn');
const views = document.querySelectorAll('.view');

const tacticalAlertMessage = document.getElementById('tactical-alert-message');
const notificationWeather = document.getElementById('notification-weather');
const notificationMonitoring = document.getElementById('notification-monitoring');
const notificationUpdated = document.getElementById('notification-updated');

let tacticalClockTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let tacticalClockUsesGpsTimeZone = false;

function renderTacticalClock() {
  if (!notificationUpdated) return;

  const now = new Date();
  notificationUpdated.dateTime = now.toISOString();
  notificationUpdated.textContent = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: tacticalClockTimeZone,
    timeZoneName: 'short',
  });
  const source = tacticalClockUsesGpsTimeZone ? 'GPS location' : 'device timezone';
  notificationUpdated.title = `Current time from ${source} (${tacticalClockTimeZone})`;
}

async function setTacticalClockTimeZoneFromCoordinates({ lat, lon }) {
  const parameters = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    forecast_days: '1',
    current: 'temperature_2m',
  });
  const locationData = await fetchJson(`https://api.open-meteo.com/v1/forecast?${parameters}`);
  if (locationData?.timezone) {
    tacticalClockTimeZone = locationData.timezone;
    tacticalClockUsesGpsTimeZone = true;
  }
  renderTacticalClock();
}

async function initializeTacticalClock() {
  renderTacticalClock();
  window.setInterval(renderTacticalClock, 1000);

  try {
    const gps = await getCurrentGps();
    await setTacticalClockTimeZoneFromCoordinates(gps);
  } catch {
    // The live clock remains useful with the device timezone if GPS is unavailable.
  }
}

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

const incidentBriefStorageKey = 'hazmatiq.incidentBrief';
const incidentBriefFieldIds = [
  'incident-address-input',
  'incident-city',
  'incident-state',
  'incident-coordinates-input',
  'incident-product',
  'incident-placard',
  'incident-notes',
];

function getIncidentAddressValue() {
  return ['incident-address-input', 'incident-city', 'incident-state']
    .map((id) => document.getElementById(id)?.value.trim())
    .filter(Boolean)
    .join(', ');
}

function setIncidentStatus(message) {
  const status = document.getElementById('incident-location-status');
  if (status) status.textContent = message;
}

function readIncidentBrief() {
  return Object.fromEntries(incidentBriefFieldIds.map((id) => [id, document.getElementById(id)?.value.trim() || '']));
}

function saveIncidentBrief({ quiet = false } = {}) {
  const brief = readIncidentBrief();
  try {
    window.localStorage.setItem(incidentBriefStorageKey, JSON.stringify({ ...brief, savedAt: new Date().toISOString() }));
    if (!quiet) setIncidentStatus('Incident brief saved on this device. Use Update Scene to refresh the map and live conditions.');
  } catch {
    if (!quiet) setIncidentStatus('This browser could not save the incident brief locally.');
  }
}

function restoreIncidentBrief() {
  try {
    const brief = JSON.parse(window.localStorage.getItem(incidentBriefStorageKey) || 'null');
    if (!brief) return;
    incidentBriefFieldIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element && typeof brief[id] === 'string') element.value = brief[id];
    });
    setIncidentStatus('Saved incident brief restored from this device.');
  } catch {
    // Ignore missing or malformed local-only drafts.
  }
}

document.getElementById('save-incident-brief-btn')?.addEventListener('click', () => saveIncidentBrief());
document.getElementById('clear-incident-brief-btn')?.addEventListener('click', () => {
  incidentBriefFieldIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });
  try {
    window.localStorage.removeItem(incidentBriefStorageKey);
  } catch {
    // The visible form can still be cleared if browser storage is unavailable.
  }
  setActiveChemical(null);
  setIncidentStatus('Incident brief cleared.');
});

restoreIncidentBrief();

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

let ergGuideLibraryPromise;

function fetchErgGuideLibrary() {
  if (!ergGuideLibraryPromise) {
    ergGuideLibraryPromise = fetchJson('/data/erg-guides-2024.json').then((data) => data?.guides || {});
  }
  return ergGuideLibraryPromise;
}

function isGenericErgReference(value) {
  return /^\s*(?:refer to|per) ERG Guide/i.test(String(value || ''));
}

function chemicalRecordFromApi(chem, npg, thresholdRows, guideData, ergTable) {
  const synonyms = parseJsonField(chem.synonyms, []);
  const cas = parseJsonField(chem.cas, []) || [];
  const un = parseJsonField(chem.un, []) || [];
  const hazardClass = parseJsonField(chem.hazardClass, []) || [];
  const ppe = parseJsonField(chem.ppe, []) || [];
  const isolation = parseJsonField(chem.isolation, {}) || {};
  const reactivity = parseJsonField(chem.reactivity, []) || [];
  const incompatibilities = parseJsonField(chem.incompatibilities, []) || [];
  const sources = parseJsonField(chem.sources, []) || [];

  const exposureLimits = npg ? parseJsonField(npg.exposureLimits, {}) : {};
  const physical = npg ? parseJsonField(npg.physical, {}) : {};
  const health = npg ? parseJsonField(npg.health, {}) : {};
  const npgPpe = npg ? parseJsonField(npg.ppe, {}) : {};

  const guideNumber = chem.ergGuide || 'N/A';
  const fallbackHazards = reactivity.length ? reactivity : [`DOT hazard class: ${hazardClass.join(' / ') || 'not assigned'}.`];
  const responderGuide = guideData || {
    guide: guideNumber,
    title: hazardClass.length ? `Hazard Class ${hazardClass.join(' / ')}` : 'Material-specific response information',
    potentialHazards: {
      fireOrExplosion: fallbackHazards,
      health: health.symptoms?.length ? health.symptoms : ['No ERG health summary is available in this dataset.'],
    },
    publicSafety: {
      general: ['Keep unauthorized personnel away.', 'Stay upwind, uphill and/or upstream.'],
      protectiveClothing: ppe.length ? ppe : ['Use incident-specific PPE and respiratory protection.'],
      evacuation: [isolation.initial, isolation.protective].filter((value) => value && !isGenericErgReference(value)),
    },
    emergencyResponse: {
      fire: reactivity.length ? reactivity : ['Use response tactics appropriate to the confirmed material and container.'],
      spillOrLeak: ['Do not touch or walk through spilled material.', 'Stop the leak only if it can be done without risk.'],
    },
  };
  const guideIsolation = responderGuide.publicSafety.evacuation.find((item) => /^Isolate spill or leak area/i.test(item));
  const hasGreenTable = ergTable && (Number(ergTable.tih) === 1 || Number(ergTable.isWaterReactive) === 1);
  const initialIsolation = hasGreenTable
    ? `Small spill — day ${Number(ergTable.smallInitialDayFt).toLocaleString()} ft / night ${Number(ergTable.smallInitialNightFt).toLocaleString()} ft; Large spill — day ${Number(ergTable.largeInitialDayFt).toLocaleString()} ft / night ${Number(ergTable.largeInitialNightFt).toLocaleString()} ft`
    : (!isGenericErgReference(isolation.initial) && isolation.initial) || guideIsolation || 'Not listed in the available ERG data';
  const guideProtectiveAction = responderGuide.publicSafety.evacuation.find((item) => /protective action|downwind direction/i.test(item));
  const protectiveAction = hasGreenTable
    ? 'Use the green ERG Table 1 distances shown above for spill size and day/night conditions.'
    : (!isGenericErgReference(isolation.protective) && isolation.protective) || guideProtectiveAction || 'Establish from monitoring and incident conditions.';

  return {
    name: chem.name,
    aliases: synonyms,
    summary: `Operational response summary for ${chem.name}, organized from the available ERG, CAMEO, and NIOSH records.`,
    ergGuide: guideNumber,
    un: un[0] || 'N/A',
    initialIsolation,
    protectiveAction,
    commandFacts: {
      initialIsolation: initialIsolation === 'Not listed in the available ERG data' ? null : initialIsolation,
      protectiveAction: protectiveAction === 'Establish from monitoring and incident conditions.' ? null : protectiveAction,
      isolationSource: hasGreenTable ? 'ERG 2024 Table 1 backend record' : 'ERG/CAMEO backend record',
      idlh: exposureLimits.idlh || null,
    },
    ppeReference: ppe,
    ppeSources: [
      {
        id: 'erg',
        label: 'PHMSA ERG',
        items: guideData?.publicSafety?.protectiveClothing || [],
      },
      {
        id: 'niosh',
        label: 'NIOSH NPG',
        items: [
          ...(npgPpe.skin || []).map((item) => `Skin: ${item}`),
          ...(npgPpe.eye || []).map((item) => `Eye: ${item}`),
          ...(npgPpe.respiratory || []).map((item) => `Respiratory: ${item}`),
        ],
      },
      { id: 'osha', label: 'OSHA', items: [] },
      { id: 'epa', label: 'EPA', items: [] },
      { id: 'comptox', label: 'EPA CompTox', items: [] },
      { id: 'kappler', label: 'Kappler HazMatch', items: [] },
    ],
    responderGuide,
    ergTable: hasGreenTable ? ergTable : null,
    dotClass: hazardClass.join(' / ') || 'N/A',
    physicalState: physical.bp ? `Boiling point ${formatTempFahrenheit(physical.bp)} (see physical data)` : 'Not modeled in this dataset',
    idlh: exposureLimits.idlh || 'Not in NIOSH dataset',
    aeGL: formatThresholdGroup(thresholdRows, 'AEGL'),
    erpg: formatThresholdGroup(thresholdRows, 'ERPG'),
    pac: formatThresholdGroup(thresholdRows, 'TEEL'),
    advanced: [
      ['UN', un[0] || 'N/A'],
      ['CAS', cas[0] || 'N/A'],
      ['DOT Hazard Class', hazardClass.join(' / ') || 'N/A'],
      ['Placard', chem.placard || 'N/A'],
      ['ERG Guide', guideNumber],
      ['ERG Hazard Profile', responderGuide.title],
      ['Initial Isolation', initialIsolation],
      ['Protective Action', protectiveAction],
      ['Formula', npg?.formula || 'N/A'],
      ['Molecular Weight', chem.molecularWeight ? `${chem.molecularWeight} g/mol` : (physical.mw ? `${physical.mw} g/mol` : 'N/A')],
      ['Melting Point', physical.mp ? formatTempFahrenheit(physical.mp) : 'N/A'],
      ['Boiling Point', physical.bp ? formatTempFahrenheit(physical.bp) : 'N/A'],
      ['Vapor Pressure', physical.vpMmHg ? `${formatTempFahrenheit(physical.vpMmHg)} mmHg` : 'N/A'],
      ['Specific Gravity', physical.sg ? formatTempFahrenheit(physical.sg) : 'N/A'],
      ['Flash Point', physical.flPt ? formatTempFahrenheit(physical.flPt) : 'N/A'],
      ['LEL / UEL', (physical.lel || physical.uel) ? `${physical.lel || '—'} / ${physical.uel || '—'}` : 'N/A'],
      ['NIOSH REL', exposureLimits.rel || 'N/A'],
      ['OSHA PEL', exposureLimits.pel || 'N/A'],
      ['IDLH', exposureLimits.idlh || 'N/A'],
      ['AEGL', formatThresholdGroup(thresholdRows, 'AEGL')],
      ['ERPG', formatThresholdGroup(thresholdRows, 'ERPG')],
      ['TEEL (PAC basis)', formatThresholdGroup(thresholdRows, 'TEEL')],
      ['Reactivity', reactivity.join('; ') || 'N/A'],
      ['Incompatibilities', incompatibilities.join(', ') || 'N/A'],
      ['PPE', responderGuide.publicSafety.protectiveClothing.join('; ') || ppe.join(', ') || 'N/A'],
      ['Decon References', `Per ERG Guide ${chem.ergGuide || '—'} and department SOPs`],
    ],
    sources: sources.length
      ? sources.map((s) => (typeof s === 'string' ? s : s.source || JSON.stringify(s)))
      : ['CAMEO Chemicals', 'ERG 2024'],
  };
}

async function buildFullChemicalRecord(chem) {
  const un = parseJsonField(chem.un, [])?.[0];
  const guideNumber = String(chem.ergGuide || '').replace(/P$/i, '');
  const [npg, thresholdsData, guideLibrary, ergTable] = await Promise.all([
    fetchJson(`/api/npg/${encodeURIComponent(chem.id)}`),
    fetchJson(`/api/thresholds?chemicalId=${encodeURIComponent(chem.id)}`),
    fetchErgGuideLibrary(),
    un && guideNumber
      ? fetchJson(`/api/erg/${encodeURIComponent(un)}?guide=${encodeURIComponent(guideNumber)}`)
      : Promise.resolve(null),
  ]);
  const thresholdRows = (thresholdsData?.thresholds || []).map((t) => ({ ...t, valuePpm: Number(t.valuePpm) }));
  return chemicalRecordFromApi(
    chem,
    npg && !npg.error ? npg : null,
    thresholdRows,
    guideLibrary[guideNumber],
    ergTable && !ergTable.error ? ergTable : null,
  );
}

function normalizeChemicalQuery(value) {
  return String(value || '')
    .trim()
    .replace(/^UN(?:\/NA)?\s*[-:#]?\s*/i, '')
    .replace(/^CAS\s*(?:number|no\.)?\s*[-:#]?\s*/i, '');
}

function updateChemicalCard(record) {
  if (!record) return;

  document.getElementById('chemical-name').textContent = record.name;
  document.getElementById('chemical-summary').textContent = record.summary;
  document.getElementById('chemical-erg-guide').textContent = record.ergGuide;
  document.getElementById('chemical-erg-heading').textContent = `ERG 2024 Guide ${record.ergGuide} — ${record.responderGuide.title}`;
  document.getElementById('chemical-initial-isolation').textContent = record.initialIsolation;
  document.getElementById('chemical-guide-material').textContent = `Guide ${record.ergGuide} · UN ${record.un}`;

  const subheadings = new Set([
    'Immediate precautionary measure', 'Small Fire', 'Large Fire', 'Fire Involving Tanks',
    'Fire Involving Tanks, Rail Tank Cars or Highway Tanks', 'Small Spill', 'Large Spill',
    'Small Liquid Spill', 'Large Liquid Spill', 'Spill', 'Fire',
  ]);
  const setErgList = (id, items, limit) => {
    const list = document.getElementById(id);
    const operationalItems = [...new Set(items || [])].slice(0, limit);
    list.replaceChildren(...operationalItems.map((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      if (subheadings.has(item)) li.className = 'erg-list-subheading';
      return li;
    }));
  };
  setErgList('chemical-erg-fire-hazards', record.responderGuide.potentialHazards.fireOrExplosion, 5);
  setErgList('chemical-erg-health-hazards', record.responderGuide.potentialHazards.health, 5);
  setErgList('chemical-erg-public-safety', record.responderGuide.publicSafety.general, 4);
  setErgList('chemical-erg-protective-clothing', record.responderGuide.publicSafety.protectiveClothing, 4);
  setErgList('chemical-erg-evacuation', record.responderGuide.publicSafety.evacuation, 5);
  setErgList('chemical-erg-fire-response', record.responderGuide.emergencyResponse.fire, 10);
  setErgList('chemical-erg-spill-response', record.responderGuide.emergencyResponse.spillOrLeak, 8);

  const tableSection = document.getElementById('chemical-erg-table-1');
  tableSection.hidden = !record.ergTable;
  if (record.ergTable) {
    const entry = record.ergTable;
    document.getElementById('chemical-erg-table-badge').textContent = entry.isWaterReactive ? 'Water-reactive' : 'TIH';
    document.getElementById('chemical-erg-table-note').textContent = `${entry.name} (UN ${entry.un}) — distances shown exactly as stored from ERG 2024 Table 1.`;
    const rows = [
      ['Small', 'Day', entry.smallInitialDayFt, entry.smallProtectiveDayMi],
      ['Small', 'Night', entry.smallInitialNightFt, entry.smallProtectiveNightMi],
      ['Large', 'Day', entry.largeInitialDayFt, entry.largeProtectiveDayMi],
      ['Large', 'Night', entry.largeInitialNightFt, entry.largeProtectiveNightMi],
    ];
    const body = document.getElementById('chemical-erg-table-body');
    body.replaceChildren(...rows.map(([size, period, initial, protective]) => {
      const row = document.createElement('tr');
      [size, period, `${Number(initial).toLocaleString()} ft`, `${Number(protective).toLocaleString()} mi`]
        .forEach((value) => {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.append(cell);
        });
      return row;
    }));
  }

  const advancedList = document.getElementById('chemical-advanced-list');
  advancedList.innerHTML = record.advanced.map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join('');

  const sourceList = document.getElementById('chemical-source-list');
  sourceList.innerHTML = record.sources.map((item) => `<li>${item}</li>`).join('');

}

const chemicalSearchForm = document.getElementById('chemical-search-form');
const chemicalSearchInput = document.getElementById('chemical-search');
const chemicalSearchSuggestions = document.getElementById('chemical-search-suggestions');
const chemicalSearchStatus = document.getElementById('chemical-search-status');
const chemicalIdResults = document.getElementById('chemical-id-results');
const facilityInventory = document.getElementById('facility-inventory');
let chemicalSearchTimer = null;
let latestChemicalSearch = 0;
let activeChemical = null;
let activeChemicalRecord = null;
let activePlumeCommand = null;
let activePpeSelection = [];
const selectedChemicalStorageKey = 'hazmatiq.selectedChemical';

function replaceCommandList(id, items, emptyMessage) {
  const list = document.getElementById(id);
  if (!list) return;
  const rows = (items || []).filter(Boolean);
  list.replaceChildren(...(rows.length ? rows : [emptyMessage]).map((textValue) => {
    const item = document.createElement('li');
    item.textContent = textValue;
    return item;
  }));
}

const requiredPpeConsensusSources = ['erg', 'niosh', 'osha', 'epa', 'comptox', 'kappler'];

function normalizePpeRecommendation(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9+/-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function correlatePpeSources(sourceRows = []) {
  const rows = requiredPpeConsensusSources.map((sourceId) => {
    const source = sourceRows.find((row) => row.id === sourceId) || { id: sourceId, label: sourceId, items: [] };
    const uniqueItems = [...new Map((source.items || [])
      .map((item) => [normalizePpeRecommendation(item), String(item).trim()])
      .filter(([key]) => key)).values()];
    return { ...source, items: uniqueItems };
  });
  const available = rows.filter((row) => row.items.length > 0);
  const signatures = rows.map((row) => row.items.map(normalizePpeRecommendation).sort().join('|'));
  const unanimous = available.length === rows.length
    && signatures.every((signature) => signature === signatures[0]);

  const groupedItems = new Map();
  available.forEach((source) => {
    source.items.forEach((item) => {
      const key = normalizePpeRecommendation(item);
      const group = groupedItems.get(key) || { text: item, sources: [] };
      group.sources.push(source.label);
      groupedItems.set(key, group);
    });
  });

  return {
    rows,
    available,
    missing: rows.filter((row) => row.items.length === 0),
    unanimous,
    selection: unanimous ? rows[0].items : [],
    groupedItems: [...groupedItems.values()],
  };
}

function renderIncidentCommandSnapshot() {
  const chemicalLoaded = Boolean(activeChemical);
  const recordLoaded = Boolean(activeChemicalRecord);
  const commandFacts = activeChemicalRecord?.commandFacts;
  setText('command-chemical-status', recordLoaded ? 'Backend record' : (chemicalLoaded ? 'Loading data' : 'Awaiting ID'));
  setText('command-chemical-name', activeChemical?.name || 'No chemical identified');
  setText('command-chemical-summary', recordLoaded
    ? `UN ${activeChemicalRecord.un} · ERG ${activeChemicalRecord.ergGuide} · IDLH ${activeChemicalRecord.idlh}`
    : (chemicalLoaded ? 'Loading ERG, CAMEO, and NIOSH records…' : 'Search Chemical ID to connect backend response data.'));
  setText('command-chemical-source', recordLoaded
    ? `Source: ${commandFacts?.isolationSource || 'backend chemical record'}; IDLH from NIOSH record when available.`
    : 'Source: none');
  replaceCommandList('command-chemical-details', recordLoaded ? [
    commandFacts?.initialIsolation ? `Initial isolation: ${commandFacts.initialIsolation}` : 'Initial isolation: not available in the loaded backend record.',
    commandFacts?.protectiveAction ? `Protective action: ${commandFacts.protectiveAction}` : 'Protective action: not available in the loaded backend record.',
    commandFacts?.idlh ? `NIOSH IDLH: ${commandFacts.idlh}` : 'NIOSH IDLH: not available in the loaded backend record.',
    `DOT class: ${activeChemicalRecord.dotClass}`,
  ] : [], 'No chemical data loaded.');

  setText('command-plume-status', activePlumeCommand ? 'Backend result' : 'Not plotted');
  setText('command-plume-title', activePlumeCommand?.title || 'No active plume');
  setText('command-plume-summary', activePlumeCommand?.summary || 'Confirm the release and weather inputs before plotting.');
  setText('command-plume-source', activePlumeCommand?.source || 'Source: no model result');
  replaceCommandList('command-plume-details', activePlumeCommand?.details || [], 'No plume model has been plotted.');

  const ppeCorrelation = correlatePpeSources(activeChemicalRecord?.ppeSources || []);
  const hasPpeSelection = activePpeSelection.length > 0;
  const hasConsensus = ppeCorrelation.unanimous && ppeCorrelation.selection.length > 0;
  const coverage = `${ppeCorrelation.available.length}/${requiredPpeConsensusSources.length} sources`;
  setText('command-ppe-status', hasConsensus ? 'All sources match' : (hasPpeSelection ? 'Operator entered' : coverage));
  setText('command-ppe-title', hasConsensus
    ? ppeCorrelation.selection.join(' · ')
    : (hasPpeSelection ? activePpeSelection.join(' · ') : 'No automatic PPE selection'));
  setText('command-ppe-summary', hasConsensus
    ? 'Strict text match across every required backend source.'
    : (hasPpeSelection
      ? 'Operator-entered selection; the backend does not currently prove full source agreement.'
      : 'Source records are incomplete or differ. Review the available source text; HazMatIQ made no selection.'));
  setText('command-ppe-source', activeChemicalRecord
    ? `Coverage: ${coverage}. Missing: ${ppeCorrelation.missing.map((source) => source.label).join(', ') || 'none'}.`
    : 'Source: no PPE record or operator entry');
  const correlatedDetails = hasConsensus
    ? ppeCorrelation.selection.map((item) => `${item} — all required sources`)
    : [
      ...ppeCorrelation.groupedItems.map((group) => `${group.text} — ${group.sources.join(', ')}`),
      ...(hasPpeSelection ? activePpeSelection.map((item) => `${item} — operator entered`) : []),
    ].slice(0, 8);
  replaceCommandList('command-ppe-details', correlatedDetails, 'No source-attributed PPE guidance loaded.');
}

function updateIncidentPpeSelection(selection) {
  const values = Array.isArray(selection) ? selection : [selection];
  activePpeSelection = values
    .map((item) => typeof item === 'string' ? item : item?.label || item?.name || '')
    .map((item) => item.trim())
    .filter(Boolean);
  renderIncidentCommandSnapshot();
}

window.HazMatIQ.updateIncidentPpe = updateIncidentPpeSelection;
document.addEventListener('hazmatiq:ppe-selection', (event) => updateIncidentPpeSelection(event.detail?.items || event.detail || []));

function syncPlumeChemicalSelection() {
  const plumeChemicalInput = document.getElementById('plume-chemical-input');
  const plotButton = document.getElementById('plot-plume-btn');
  if (plumeChemicalInput) plumeChemicalInput.value = activeChemical?.name || 'No identified chemical';
  if (plotButton) plotButton.disabled = !activeChemical;
  if (!activeChemical) {
    setText('plume-input-status', 'Select a chemical through Chemical ID to begin.');
  } else {
    setText('plume-input-status', `${activeChemical.name} is linked from the active incident. Confirm the release and weather inputs.`);
  }
}

function setActiveChemical(chemical, { persist = true, clearOverlay = true } = {}) {
  const changed = activeChemical?.id !== chemical?.id;
  if (changed) {
    activeChemicalRecord = null;
    activePlumeCommand = null;
    activePpeSelection = [];
  }
  activeChemical = chemical ? { id: chemical.id, name: chemical.name } : null;
  const incidentProductInput = document.getElementById('incident-product');
  if (incidentProductInput) incidentProductInput.value = activeChemical?.name || '';
  if (persist) {
    try {
      if (activeChemical) window.localStorage.setItem(selectedChemicalStorageKey, JSON.stringify(activeChemical));
      else window.localStorage.removeItem(selectedChemicalStorageKey);
    } catch {
      // Chemical selection remains available for the current session.
    }
  }
  if (changed && clearOverlay) {
    importedPlumeOverlay = null;
    void clearThreatZones(activeChemical
      ? 'Chemical changed. Confirm inputs and select Plot Plume.'
      : 'Identify a chemical before plotting a plume.');
    setText('backend-model-summary', 'Awaiting operator-entered model inputs');
  }
  syncPlumeChemicalSelection();
  renderIncidentCommandSnapshot();
}

async function restoreSelectedChemical() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(selectedChemicalStorageKey) || 'null');
    if (!saved?.id) {
      syncPlumeChemicalSelection();
      return;
    }
    const chemical = await fetchJson(`/api/chemicals/${encodeURIComponent(saved.id)}`);
    if (chemical && !chemical.error) {
      setActiveChemical(chemical, { persist: false, clearOverlay: false });
      const record = await buildFullChemicalRecord(chemical);
      if (activeChemical?.id === chemical.id) {
        activeChemicalRecord = record;
        renderIncidentCommandSnapshot();
      }
    } else syncPlumeChemicalSelection();
  } catch {
    syncPlumeChemicalSelection();
  }
}

void restoreSelectedChemical();
renderIncidentCommandSnapshot();

function setChemicalSearchStatus(message, state = '') {
  if (!chemicalSearchStatus) return;
  chemicalSearchStatus.textContent = message;
  chemicalSearchStatus.dataset.state = state;
}

function clearChemicalSuggestions() {
  if (!chemicalSearchSuggestions) return;
  chemicalSearchSuggestions.replaceChildren();
  chemicalSearchSuggestions.hidden = true;
  chemicalSearchInput?.setAttribute('aria-expanded', 'false');
}

async function openChemical(chemical, facilityName = '') {
  setActiveChemical(chemical);
  latestChemicalSearch += 1;
  window.clearTimeout(chemicalSearchTimer);
  setChemicalSearchStatus(`Loading ${chemical.name || 'chemical'}…`, 'loading');
  const record = await buildFullChemicalRecord(chemical);
  if (activeChemical?.id === chemical.id) {
    activeChemicalRecord = record;
    renderIncidentCommandSnapshot();
  }
  updateChemicalCard(record);
  if (chemicalIdResults) chemicalIdResults.hidden = false;
  const context = facilityName ? ` from ${facilityName}'s submitted inventory` : '';
  setChemicalSearchStatus(`Showing Responder View and HazMat View for ${record.name}${context}.`, 'success');
  chemicalIdResults?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openChemicalById(chemicalId, facilityName = '') {
  const chemical = await fetchJson(`/api/chemicals/${encodeURIComponent(chemicalId)}`);
  if (!chemical || chemical.error) {
    setChemicalSearchStatus('Chemical details are not available for this facility submission.', 'error');
    return;
  }
  await openChemical(chemical, facilityName);
}

async function openFacility(facilityId) {
  latestChemicalSearch += 1;
  window.clearTimeout(chemicalSearchTimer);
  clearChemicalSuggestions();
  setChemicalSearchStatus('Loading facility submission…', 'loading');
  const facility = await fetchJson(`/api/facilities/${encodeURIComponent(facilityId)}`);
  if (!facility || facility.error) {
    setChemicalSearchStatus('Facility information could not be loaded.', 'error');
    return;
  }

  document.getElementById('facility-name').textContent = facility.name;
  document.getElementById('facility-address').textContent = facility.address;
  document.getElementById('facility-source').textContent = `${facility.source || 'Tier II'} submission`;

  const list = document.getElementById('facility-chemical-list');
  list.replaceChildren();
  const chemicalRecords = await Promise.all(
    facility.chemicals.map((item) => fetchJson(`/api/chemicals/${encodeURIComponent(item.chemicalId)}`)),
  );
  facility.chemicals.forEach((item, index) => {
    const chemical = chemicalRecords[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'facility-chemical-btn';
    const name = document.createElement('strong');
    name.textContent = chemical?.name || item.chemicalId.replaceAll('-', ' ');
    const detail = document.createElement('span');
    detail.textContent = `${Number(item.maxDailyAmountValue).toLocaleString()} ${item.maxDailyAmountUnit} · ${item.container || 'Container not reported'} · Reported ${item.lastReportedYear}`;
    button.append(name, detail);
    button.addEventListener('click', () => chemical && !chemical.error
      ? openChemical(chemical, facility.name)
      : openChemicalById(item.chemicalId, facility.name));
    list.append(button);
  });

  if (!facility.chemicals.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No chemical inventory was included in this facility submission.';
    list.append(empty);
  }

  if (facilityInventory) facilityInventory.hidden = false;
  if (chemicalIdResults) chemicalIdResults.hidden = true;
  setChemicalSearchStatus(`${facility.chemicals.length} reported chemical${facility.chemicals.length === 1 ? '' : 's'} found for ${facility.name}.`, 'success');
  facilityInventory?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function createSuggestion(kind, title, detail, onSelect) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chemical-suggestion';
  button.setAttribute('role', 'option');

  const type = document.createElement('span');
  type.className = 'chemical-suggestion-type';
  type.textContent = kind;
  const text = document.createElement('span');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const subtext = document.createElement('small');
  subtext.textContent = detail;
  text.append(heading, subtext);
  button.append(type, text);
  button.addEventListener('click', onSelect);
  return button;
}

async function searchChemicalId(value, { submit = false } = {}) {
  const rawQuery = String(value || '').trim();
  if (!rawQuery) {
    clearChemicalSuggestions();
    setChemicalSearchStatus('Enter a chemical name, UN number, CAS number, or facility.', 'error');
    return;
  }

  if (submit) setChemicalSearchStatus('Searching chemical and facility records…', 'loading');
  const requestId = ++latestChemicalSearch;
  const chemicalQuery = normalizeChemicalQuery(rawQuery);
  const [chemicalData, facilityData] = await Promise.all([
    fetchJson(`/api/chemicals?q=${encodeURIComponent(chemicalQuery)}`),
    fetchJson(`/api/facilities?q=${encodeURIComponent(rawQuery)}`),
  ]);
  if (requestId !== latestChemicalSearch) return;

  const chemicals = chemicalData?.chemicals || [];
  const facilities = facilityData?.facilities || [];

  if (submit && chemicals.length) {
    clearChemicalSuggestions();
    if (facilityInventory) facilityInventory.hidden = true;
    await openChemical(chemicals[0]);
    return;
  }
  if (submit && facilities.length === 1) {
    await openFacility(facilities[0].id);
    return;
  }

  if (!chemicalSearchSuggestions) return;
  chemicalSearchSuggestions.replaceChildren();
  chemicals.slice(0, 5).forEach((chemical) => {
    const un = parseJsonField(chemical.un, [])?.[0];
    const cas = parseJsonField(chemical.cas, [])?.[0];
    chemicalSearchSuggestions.append(createSuggestion(
      'Chemical',
      chemical.name,
      [un && `UN ${un}`, cas && `CAS ${cas}`].filter(Boolean).join(' · ') || 'Chemical reference',
      () => {
        if (chemicalSearchInput) chemicalSearchInput.value = chemical.name;
        if (facilityInventory) facilityInventory.hidden = true;
        clearChemicalSuggestions();
        openChemical(chemical);
      },
    ));
  });
  facilities.slice(0, 8).forEach((facility) => {
    chemicalSearchSuggestions.append(createSuggestion(
      'Facility',
      facility.name,
      `${facility.address} · Submitted inventory`,
      () => {
        if (chemicalSearchInput) chemicalSearchInput.value = facility.name;
        openFacility(facility.id);
      },
    ));
  });

  const matchCount = chemicals.length + facilities.length;
  chemicalSearchSuggestions.hidden = matchCount === 0;
  chemicalSearchInput?.setAttribute('aria-expanded', matchCount ? 'true' : 'false');
  setChemicalSearchStatus(
    matchCount ? `${chemicals.length} chemical and ${facilities.length} facility match${matchCount === 1 ? '' : 'es'}.` : 'No matching chemicals or submitted facilities found.',
    matchCount ? '' : 'error',
  );
}

chemicalSearchInput?.addEventListener('input', () => {
  window.clearTimeout(chemicalSearchTimer);
  const query = chemicalSearchInput.value.trim();
  if (query.length < 2) {
    clearChemicalSuggestions();
    setChemicalSearchStatus('');
    return;
  }
  chemicalSearchTimer = window.setTimeout(() => searchChemicalId(query), 200);
});

chemicalSearchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') clearChemicalSuggestions();
});

chemicalSearchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  searchChemicalId(chemicalSearchInput?.value, { submit: true });
});

let plumeRefreshToken = 0;
let plumeMap = null;
let plumeMapReady = null;
let plumeSourceMarker = null;
let importedPlumeOverlay = null;
let currentThreatZoneGeoJson = null;
let threatZoneInteractionBound = false;
let demographicsRequestToken = 0;
let latestPlumeWeather = null;
const plumeMapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty';
const satelliteMapStyle = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [{ id: 'satellite-basemap', type: 'raster', source: 'satellite' }],
};
const plumeMapViews = {
  street: { style: plumeMapStyleUrl, styleKey: 'street', pitch: 0, bearing: 0 },
  satellite: { style: satelliteMapStyle, styleKey: 'satellite', pitch: 0, bearing: 0 },
  'street-3d': { style: plumeMapStyleUrl, styleKey: 'street', pitch: 60, bearing: -20, minZoom: 15 },
};
let activePlumeMapView = 'street';
let activePlumeMapStyleKey = plumeMapViews.street.styleKey;
const threatZoneColors = { 3: '#d71920', 2: '#ffd323', 1: '#18a567' };
const threatZoneColorNames = { 3: 'red', 2: 'yellow', 1: 'green' };

function updatePlumeMapViewButtons() {
  document.querySelectorAll('[data-plume-map-view]').forEach((button) => {
    const isActive = button.dataset.plumeMapView === activePlumeMapView;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updateIncidentLocationFromMap(lng, lat, action) {
  const input = document.getElementById('incident-coordinates-input');
  if (input) input.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  setIncidentStatus(`${action}: ${lat.toFixed(6)}, ${lng.toFixed(6)}. Updating plume…`);
  saveIncidentBrief({ quiet: true });
  refreshPlumeWorkspace({ requestGps: false });
}

function ensurePlumeMap(location) {
  if (!window.maplibregl) throw new Error('The local GIS map library did not load.');
  if (!plumeMap) {
    const view = plumeMapViews[activePlumeMapView];
    activePlumeMapStyleKey = view.styleKey;
    plumeMap = new window.maplibregl.Map({
      container: 'plume-gis-map',
      center: [location.lon, location.lat],
      zoom: 13,
      style: view.style,
      pitch: view.pitch,
      bearing: view.bearing,
    });
    plumeMap.addControl(new window.maplibregl.NavigationControl(), 'bottom-right');
    plumeMapReady = new Promise((resolve) => plumeMap.once('load', resolve));
    plumeMap.getCanvas().style.cursor = 'crosshair';
    plumeMap.on('click', (event) => {
      const renderedZones = plumeMap.getLayer('hazmat-threat-zones-fill')
        ? plumeMap.queryRenderedFeatures(event.point, { layers: ['hazmat-threat-zones-fill'] })
        : [];
      if (renderedZones.length) {
        const selected = [...renderedZones].sort((a, b) => Number(b.properties?.threatRank || 0) - Number(a.properties?.threatRank || 0))[0];
        const sourceFeature = currentThreatZoneGeoJson?.features.find(
          (feature) => String(feature.properties?.zoneId) === String(selected.properties?.zoneId),
        ) || selected;
        inspectThreatZone(sourceFeature);
        return;
      }
      const { lng, lat } = event.lngLat;
      updateIncidentLocationFromMap(lng, lat, 'Incident pin placed from map click');
    });
    plumeMap.on('error', (event) => {
      if (event?.error?.message) setText('plume-overlay-status', `Map layer error: ${event.error.message}`);
    });
  }
  plumeMap.resize();
  plumeMap.easeTo({ center: [location.lon, location.lat], duration: 400 });
  if (!plumeSourceMarker) {
    plumeSourceMarker = new window.maplibregl.Marker({
      color: '#d71920',
      draggable: true,
      className: 'plume-source-marker',
    })
      .setLngLat([location.lon, location.lat])
      .setPopup(new window.maplibregl.Popup().setText('Release source — drag pin to adjust'))
      .addTo(plumeMap);
    plumeSourceMarker.on('dragstart', () => {
      setIncidentStatus('Moving incident release source…');
    });
    plumeSourceMarker.on('dragend', () => {
      const { lng, lat } = plumeSourceMarker.getLngLat();
      updateIncidentLocationFromMap(lng, lat, 'Incident pin moved');
    });
  } else {
    plumeSourceMarker.setLngLat([location.lon, location.lat]);
  }
  return plumeMapReady;
}

function localMetersToLngLat([x, y], origin, windFromDeg) {
  const earthRadiusM = 6378137;
  const downwindBearing = ((Number(windFromDeg) + 180) % 360) * (Math.PI / 180);
  const eastM = x * Math.sin(downwindBearing) + y * Math.cos(downwindBearing);
  const northM = x * Math.cos(downwindBearing) - y * Math.sin(downwindBearing);
  const lat = origin.lat + (northM / earthRadiusM) * (180 / Math.PI);
  const lon = origin.lon + (eastM / (earthRadiusM * Math.cos(origin.lat * Math.PI / 180))) * (180 / Math.PI);
  return [lon, lat];
}

function plumeResultToGeoJson(result, origin) {
  const validZones = (result?.isopleths || []).filter((zone) => zone.polygon?.length >= 3 && Number(zone.thresholdLevel) >= 1);
  const thresholdKind = ['AEGL', 'ERPG', 'TEEL'].reduce((preferredKind, kind) => {
    const levelCount = new Set(validZones.filter((zone) => zone.thresholdKind === kind).map((zone) => zone.thresholdLevel)).size;
    const preferredLevelCount = new Set(validZones.filter((zone) => zone.thresholdKind === preferredKind).map((zone) => zone.thresholdLevel)).size;
    return levelCount > preferredLevelCount ? kind : preferredKind;
  }, 'AEGL');
  const preferredZones = thresholdKind ? validZones.filter((zone) => zone.thresholdKind === thresholdKind) : validZones;
  const uniqueZones = [...preferredZones.reduce((zonesByLevel, zone) => {
    const threatRank = Math.max(1, Math.min(3, Number(zone.thresholdLevel) || 1));
    if (!zonesByLevel.has(threatRank)) zonesByLevel.set(threatRank, zone);
    return zonesByLevel;
  }, new Map()).values()];
  return {
    type: 'FeatureCollection',
    features: uniqueZones.map((zone, index) => {
      const coordinates = zone.polygon.map((point) => localMetersToLngLat(point, origin, result.inputs.windDirDeg));
      coordinates.push(coordinates[0]);
      const threatRank = Math.max(1, Math.min(3, Number(zone.thresholdLevel) || 1));
      return {
        type: 'Feature',
        id: index,
        properties: {
          label: `${zone.thresholdKind}-${zone.thresholdLevel}`,
          zoneId: `modeled-${index}`,
          source: 'HazMatIQ plume model using CAMEO chemical data',
          thresholdKind: zone.thresholdKind,
          thresholdLevel: zone.thresholdLevel,
          threatRank,
          colorName: threatZoneColorNames[threatRank],
          color: threatZoneColors[threatRank],
          maxDownwindM: zone.maxDownwindM,
        },
        geometry: { type: 'Polygon', coordinates: [coordinates] },
      };
    }),
  };
}

function forEachCoordinate(geojson, callback) {
  const visit = (coordinates) => {
    if (typeof coordinates?.[0] === 'number') callback(coordinates);
    else (coordinates || []).forEach(visit);
  };
  (geojson?.features || []).forEach((feature) => visit(feature.geometry?.coordinates));
}

function getThreatZoneRing(feature) {
  const geometry = feature?.geometry;
  if (geometry?.type === 'Polygon') return geometry.coordinates?.[0] || [];
  if (geometry?.type === 'MultiPolygon') {
    return [...(geometry.coordinates || [])]
      .map((polygon) => polygon?.[0] || [])
      .sort((a, b) => b.length - a.length)[0] || [];
  }
  return [];
}

function sampleClosedRing(ring, maxPoints = 70) {
  if (ring.length <= maxPoints) return ring;
  const step = Math.ceil((ring.length - 1) / (maxPoints - 1));
  const sampled = ring.slice(0, -1).filter((_, index) => index % step === 0);
  sampled.push(sampled[0]);
  return sampled;
}

async function fetchExternalJson(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchCensusZoneStats(ring) {
  const geometry = JSON.stringify({ rings: [sampleClosedRing(ring)] });
  const statistics = JSON.stringify([
    { statisticType: 'sum', onStatisticField: 'POP100', outStatisticFieldName: 'population' },
    { statisticType: 'sum', onStatisticField: 'HU100', outStatisticFieldName: 'housing' },
    { statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'blocks' },
  ]);
  const parameters = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry,
    geometryType: 'esriGeometryPolygon',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outStatistics: statistics,
    returnGeometry: 'false',
  });
  const endpoint = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/10/query';
  const data = await fetchExternalJson(`${endpoint}?${parameters}`);
  if (data?.error) throw new Error(data.error.message || 'Census query failed');
  const attributes = data?.features?.[0]?.attributes;
  if (!attributes) throw new Error('No Census blocks returned');
  return {
    population: Number(attributes.population) || 0,
    housing: Number(attributes.housing) || 0,
    blocks: Number(attributes.blocks) || 0,
  };
}

function getMappedFeatureName(element) {
  return element?.tags?.name || element?.tags?.operator || element?.tags?.brand || '';
}

async function fetchMappedZoneOccupancies(ring) {
  const polygon = sampleClosedRing(ring).map(([lon, lat]) => `${lat} ${lon}`).join(' ');
  const query = `[out:json][timeout:25];(
    nwr["building"~"^(house|residential|apartments|detached|semidetached_house|terrace|dormitory|commercial|retail|office|industrial|warehouse|hotel|school|hospital)$"](poly:"${polygon}");
    nwr["building:use"~"^(residential|commercial|retail|office|industrial)$"](poly:"${polygon}");
    nwr["amenity"~"^(school|kindergarten|childcare|college|university|hospital|clinic|doctors|nursing_home|social_facility|fire_station|police|community_centre|place_of_worship|shelter|prison)$"](poly:"${polygon}");
    nwr["shop"](poly:"${polygon}");
    nwr["office"](poly:"${polygon}");
    nwr["tourism"="hotel"](poly:"${polygon}");
    nwr["leisure"~"^(stadium|sports_centre)$"](poly:"${polygon}");
  );out center tags;`;
  const data = await fetchExternalJson('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ data: query }),
  });
  const elements = [...new Map((data?.elements || []).map((element) => [`${element.type}/${element.id}`, element])).values()];
  const residentialBuildings = new Set(['house', 'residential', 'apartments', 'detached', 'semidetached_house', 'terrace', 'dormitory']);
  const commercialBuildings = new Set(['commercial', 'retail', 'office', 'industrial', 'warehouse', 'hotel']);
  const educationAmenities = new Set(['school', 'kindergarten', 'childcare', 'college', 'university']);
  const medicalAmenities = new Set(['hospital', 'clinic', 'doctors', 'nursing_home', 'social_facility']);
  const responseAmenities = new Set(['fire_station', 'police', 'shelter']);
  const highOccupancyAmenities = new Set(['community_centre', 'place_of_worship', 'prison']);

  const residential = elements.filter((element) => residentialBuildings.has(element.tags?.building)
    || element.tags?.['building:use'] === 'residential');
  const commercial = elements.filter((element) => commercialBuildings.has(element.tags?.building)
    || commercialBuildings.has(element.tags?.['building:use']) || element.tags?.shop || element.tags?.office);
  const education = elements.filter((element) => educationAmenities.has(element.tags?.amenity));
  const medical = elements.filter((element) => medicalAmenities.has(element.tags?.amenity));
  const response = elements.filter((element) => responseAmenities.has(element.tags?.amenity));
  const highOccupancy = elements.filter((element) => highOccupancyAmenities.has(element.tags?.amenity)
    || element.tags?.tourism === 'hotel' || ['stadium', 'sports_centre'].includes(element.tags?.leisure));

  const describe = (label, rows) => {
    if (!rows.length) return [];
    const names = [...new Set(rows.map(getMappedFeatureName).filter(Boolean))].slice(0, 3);
    return [`${label}: ${names.length ? names.join(', ') : `${rows.length} mapped site${rows.length === 1 ? '' : 's'}`}`];
  };
  return {
    residential: residential.length,
    commercial: commercial.length,
    education: education.length,
    medical: medical.length,
    priorities: [
      ...describe('Schools / daycare', education),
      ...describe('Medical / care', medical),
      ...describe('Fire / police / shelter', response),
      ...describe('Other high-occupancy sites', highOccupancy),
    ],
  };
}

function setDemographicMetric(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function resetDemographics(message = 'Click a red, yellow, or green plume zone to inspect potential exposures.') {
  demographicsRequestToken += 1;
  const badge = document.getElementById('demographics-zone-badge');
  if (badge) {
    badge.textContent = 'No zone';
    delete badge.dataset.zoneColor;
  }
  setText('demographics-zone-summary', message);
  ['population', 'housing', 'residential', 'commercial', 'schools', 'medical']
    .forEach((metric) => setDemographicMetric(`demographics-${metric}`, '—'));
  const list = document.getElementById('demographics-priority-list');
  if (list) {
    list.replaceChildren();
    const item = document.createElement('li');
    item.textContent = 'Select a plume zone to load nearby occupancies and sensitive sites.';
    list.append(item);
  }
}

function formatZoneDistance(meters) {
  if (!Number.isFinite(Number(meters))) return '';
  const feet = Number(meters) * 3.28084;
  return feet >= 5280 ? `${(feet / 5280).toFixed(1)} mi downwind` : `${Math.round(feet).toLocaleString()} ft downwind`;
}

async function inspectThreatZone(feature) {
  const ring = getThreatZoneRing(feature);
  if (ring.length < 4) return;
  const token = ++demographicsRequestToken;
  const properties = feature.properties || {};
  const colorName = properties.colorName || 'zone';
  const badge = document.getElementById('demographics-zone-badge');
  if (badge) {
    badge.textContent = `${colorName.toUpperCase()} ZONE`;
    badge.dataset.zoneColor = colorName;
  }
  const details = [properties.label, formatZoneDistance(properties.maxDownwindM), properties.source].filter(Boolean);
  setText('demographics-zone-summary', details.join(' · '));
  ['population', 'housing', 'residential', 'commercial', 'schools', 'medical']
    .forEach((metric) => setDemographicMetric(`demographics-${metric}`, '…'));
  setText('demographics-source-status', 'Loading U.S. Census and OpenStreetMap planning data…');
  const list = document.getElementById('demographics-priority-list');
  if (list) {
    list.replaceChildren();
    const item = document.createElement('li');
    item.textContent = 'Loading sensitive sites and high-occupancy locations…';
    list.append(item);
  }
  if (plumeMap?.getLayer('hazmat-threat-zones-selection')) {
    plumeMap.setFilter('hazmat-threat-zones-selection', ['==', ['get', 'zoneId'], String(properties.zoneId)]);
  }

  const [censusResult, occupancyResult] = await Promise.allSettled([
    fetchCensusZoneStats(ring),
    fetchMappedZoneOccupancies(ring),
  ]);
  if (token !== demographicsRequestToken) return;

  const census = censusResult.status === 'fulfilled' ? censusResult.value : null;
  const occupancy = occupancyResult.status === 'fulfilled' ? occupancyResult.value : null;
  setDemographicMetric('demographics-population', census ? census.population.toLocaleString() : 'Unavailable');
  setDemographicMetric('demographics-housing', census ? census.housing.toLocaleString() : 'Unavailable');
  setDemographicMetric('demographics-residential', occupancy ? occupancy.residential.toLocaleString() : 'Unavailable');
  setDemographicMetric('demographics-commercial', occupancy ? occupancy.commercial.toLocaleString() : 'Unavailable');
  setDemographicMetric('demographics-schools', occupancy ? occupancy.education.toLocaleString() : 'Unavailable');
  setDemographicMetric('demographics-medical', occupancy ? occupancy.medical.toLocaleString() : 'Unavailable');

  if (list) {
    list.replaceChildren();
    const priorities = occupancy?.priorities?.length
      ? occupancy.priorities
      : ['No mapped sensitive sites were returned; verify occupancies during reconnaissance.'];
    priorities.forEach((priority) => {
      const item = document.createElement('li');
      item.textContent = priority;
      list.append(item);
    });
  }
  const sources = [
    census ? `2020 Census: ${census.blocks} intersecting block${census.blocks === 1 ? '' : 's'} (planning upper bound)` : 'Census unavailable',
    occupancy ? 'OpenStreetMap mapped features' : 'OpenStreetMap occupancy lookup unavailable',
  ];
  setText('demographics-source-status', `${sources.join(' · ')}. Verify current occupancy and evacuation counts through dispatch and field reconnaissance.`);
}

async function renderThreatZones(geojson, label) {
  if (!plumeMap || !geojson?.features?.length) return false;
  await plumeMapReady;
  currentThreatZoneGeoJson = {
    ...geojson,
    features: geojson.features.map((feature, index) => {
      const threatRank = Math.max(1, Math.min(3, Number(feature.properties?.threatRank) || (3 - Math.min(index, 2))));
      return {
        ...feature,
        id: feature.id ?? index,
        properties: {
          ...feature.properties,
          zoneId: String(feature.properties?.zoneId ?? `zone-${index}`),
          threatRank,
          colorName: feature.properties?.colorName || threatZoneColorNames[threatRank],
          color: feature.properties?.color || threatZoneColors[threatRank],
        },
      };
    }),
  };
  resetDemographics();
  addThreatZoneLayers();
  if (plumeMap.getLayer('hazmat-threat-zones-selection')) {
    plumeMap.setFilter('hazmat-threat-zones-selection', ['==', ['get', 'zoneId'], '']);
  }
  if (!threatZoneInteractionBound) {
    plumeMap.on('mouseenter', 'hazmat-threat-zones-fill', () => {
      plumeMap.getCanvas().style.cursor = 'pointer';
    });
    plumeMap.on('mouseleave', 'hazmat-threat-zones-fill', () => {
      plumeMap.getCanvas().style.cursor = 'crosshair';
    });
    threatZoneInteractionBound = true;
  }
  const bounds = new window.maplibregl.LngLatBounds();
  forEachCoordinate(currentThreatZoneGeoJson, (coordinate) => bounds.extend(coordinate));
  if (!bounds.isEmpty()) plumeMap.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 500 });
  const legend = document.getElementById('plume-map-legend');
  if (legend) legend.hidden = false;
  setText('plume-overlay-status', label);
  return true;
}

function addThreatZoneLayers() {
  if (!plumeMap || !currentThreatZoneGeoJson) return;
  const source = plumeMap.getSource('hazmat-threat-zones');
  if (source) {
    source.setData(currentThreatZoneGeoJson);
  } else {
    plumeMap.addSource('hazmat-threat-zones', { type: 'geojson', data: currentThreatZoneGeoJson });
    plumeMap.addLayer({
      id: 'hazmat-threat-zones-fill',
      type: 'fill',
      source: 'hazmat-threat-zones',
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], '#d71920'],
        'fill-opacity': 0.08,
      },
    });
    plumeMap.addLayer({
      id: 'hazmat-threat-zones-selection',
      type: 'line',
      source: 'hazmat-threat-zones',
      filter: ['==', ['get', 'zoneId'], ''],
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#d71920'],
        'line-width': 8,
        'line-opacity': 0.38,
      },
    });
    plumeMap.addLayer({
      id: 'hazmat-threat-zones-outline',
      type: 'line',
      source: 'hazmat-threat-zones',
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#d71920'],
        'line-width': 4,
      },
    });
  }
}

async function setPlumeMapView(viewName) {
  const view = plumeMapViews[viewName];
  if (!view) return;
  activePlumeMapView = viewName;
  updatePlumeMapViewButtons();
  if (!plumeMap) return;

  if (activePlumeMapStyleKey !== view.styleKey) {
    activePlumeMapStyleKey = view.styleKey;
    plumeMapReady = new Promise((resolve) => plumeMap.once('style.load', resolve));
    plumeMap.setStyle(view.style);
    await plumeMapReady;
  } else if (!plumeMap.isStyleLoaded()) {
    await plumeMapReady;
  }
  if (activePlumeMapView !== viewName) return;
  addThreatZoneLayers();

  const camera = { pitch: view.pitch, bearing: view.bearing, duration: 500 };
  if (view.minZoom) camera.zoom = Math.max(plumeMap.getZoom(), view.minZoom);
  plumeMap.easeTo(camera);
}

async function clearThreatZones(message = '') {
  if (plumeMap && plumeMapReady) {
    await plumeMapReady;
    const source = plumeMap.getSource('hazmat-threat-zones');
    if (source) source.setData({ type: 'FeatureCollection', features: [] });
  }
  currentThreatZoneGeoJson = null;
  activePlumeCommand = null;
  renderIncidentCommandSnapshot();
  resetDemographics('No plume zone is currently displayed.');
  const legend = document.getElementById('plume-map-legend');
  if (legend) legend.hidden = true;
  if (message) setText('plume-overlay-status', message);
}

function parseGpsCoordinate(value) {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?)\s*[,/ ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function getCurrentGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS is not supported by this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
      () => reject(new Error('GPS permission was denied or the location is unavailable.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function degreesToCompass(degrees) {
  if (!Number.isFinite(Number(degrees))) return 'unknown direction';
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(Number(degrees) / 45) % 8];
}

// Military-style Central time as the primary readout, Zulu (UTC) alongside in smaller
// text — firefighters read clocks, not weather-station timestamps.
function formatCentralZuluTime(date = new Date()) {
  const centralParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const hh = centralParts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = centralParts.find((p) => p.type === 'minute')?.value ?? '00';
  const zoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', timeZoneName: 'short',
  }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'CT';
  const zuluHH = String(date.getUTCHours()).padStart(2, '0');
  const zuluMM = String(date.getUTCMinutes()).padStart(2, '0');
  return { central: `${hh}${mm} ${zoneName}`, zulu: `${zuluHH}${zuluMM}Z` };
}

function formatCentralZuluHtml(date = new Date()) {
  const { central, zulu } = formatCentralZuluTime(date);
  return `${central} <small class="unit-secondary">(${zulu})</small>`;
}

// NIOSH/NPG source strings mix temperature units. Present temperatures in Fahrenheit.
function formatTempFahrenheit(str) {
  if (!str) return str;
  return String(str).replace(/(−|-)?(\d+(?:\.\d+)?)\s*°\s*([CF])/g, (match, sign, digits, unit) => {
    const value = (sign === '−' || sign === '-' ? -1 : 1) * Number(digits);
    const isCelsius = unit.toUpperCase() === 'C';
    const f = isCelsius ? (value * 9) / 5 + 32 : value;
    const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
    return `${fmt(f)}°F`;
  });
}

async function getIncidentCoordinates({ requestGps = true } = {}) {
  const input = document.getElementById('incident-coordinates-input');
  const entered = parseGpsCoordinate(input?.value);
  if (entered) return { ...entered, source: 'Incident Dashboard' };
  const address = getIncidentAddressValue();
  if (address) {
    const query = new URLSearchParams({ name: address, count: '1', language: 'en', format: 'json' });
    const geocoded = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${query}`);
    const match = geocoded?.results?.[0];
    if (match && Number.isFinite(match.latitude) && Number.isFinite(match.longitude)) {
      if (input) input.value = `${match.latitude.toFixed(6)}, ${match.longitude.toFixed(6)}`;
      return { lat: match.latitude, lon: match.longitude, source: 'Incident location input' };
    }
  }
  if (!requestGps) return null;
  const gps = await getCurrentGps();
  if (input) input.value = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
  return { ...gps, source: 'Current device GPS' };
}

async function fetchOpenMeteo(lat, lon) {
  const parameters = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
  });
  return fetchJson(`https://api.open-meteo.com/v1/forecast?${parameters}`);
}

async function fetchNwsObservation(lat, lon) {
  const points = await fetchJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
  const stationUrl = points?.properties?.observationStations;
  if (!stationUrl) return null;
  const stations = await fetchJson(stationUrl);
  const station = stations?.features?.[0]?.properties;
  if (!station?.stationIdentifier) return null;
  const observation = await fetchJson(`https://api.weather.gov/stations/${encodeURIComponent(station.stationIdentifier)}/observations/latest`);
  return {
    office: points.properties.gridId,
    station,
    observation: observation?.properties,
  };
}

function formatOpenMeteo(data) {
  if (!data?.current) return null;
  const current = data.current;
  const temperatureF = Number(current.temperature_2m);
  const windSpeedMph = Number(current.wind_speed_10m);
  const pressureInHg = Number(current.surface_pressure) * 0.0295299830714;
  return {
    location: `${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)} · ${Math.round(Number(data.elevation) * 3.28084).toLocaleString()} ft · ${data.timezone || 'local time'}`,
    conditions: `${current.temperature_2m}°F · RH ${current.relative_humidity_2m}% · Wind ${current.wind_speed_10m} mph ${degreesToCompass(current.wind_direction_10m)} · Gust ${current.wind_gusts_10m} mph · Pressure ${pressureInHg.toFixed(2)} inHg`,
    temperatureF,
    temperatureC: (temperatureF - 32) * (5 / 9),
    windSpeedMph,
    windSpeedMps: windSpeedMph * 0.44704,
    windDirDeg: Number(current.wind_direction_10m),
  };
}

function formatNws(data) {
  if (!data?.observation) return null;
  const observation = data.observation;
  const tempC = observation.temperature?.value;
  const windMps = observation.windSpeed?.value;
  const tempF = Number.isFinite(tempC) ? `${((tempC * 9) / 5 + 32).toFixed(1)}°F` : 'temperature unavailable';
  const wind = Number.isFinite(windMps) ? `${(windMps * 2.23694).toFixed(1)} mph` : 'wind unavailable';
  return {
    station: `NWS ${data.office === 'BMX' ? 'Birmingham (BMX)' : data.office || 'office'} · ${data.station.stationIdentifier} ${data.station.name || ''}`.trim(),
    conditions: `${tempF} · ${observation.textDescription || 'No description'} · Wind ${wind} ${degreesToCompass(observation.windDirection?.value)}`,
  };
}

function setPlumeInputValue(id, value) {
  const input = document.getElementById(id);
  if (input && Number.isFinite(Number(value))) input.value = String(value);
}

function applyLiveWeatherToPlumeInputs(weather) {
  if (!weather) return false;
  setPlumeInputValue('plume-wind-speed', Number(weather.windSpeedMph).toFixed(1));
  setPlumeInputValue('plume-wind-direction', Math.round(weather.windDirDeg));
  setPlumeInputValue('plume-temperature', Number(weather.temperatureF).toFixed(1));
  setText('plume-input-status', `Live weather loaded for ${activeChemical?.name || 'the incident'}. Confirm all inputs before plotting.`);
  return true;
}

function updatePlumeReleaseQuantityLabel() {
  const releaseKind = document.getElementById('plume-release-type')?.value;
  const unitSelect = document.getElementById('plume-release-unit');
  setText('plume-release-quantity-label', releaseKind === 'puff' ? 'Total released mass' : 'Release rate');
  if (!unitSelect) return;
  const units = releaseKind === 'puff'
    ? [['lb', 'lb']]
    : [['lb-min', 'lb/min'], ['lb-sec', 'lb/sec']];
  unitSelect.replaceChildren(...units.map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }));
}

function readPlumeModelInputs(location) {
  if (!activeChemical) throw new Error('Identify a chemical through Chemical ID before plotting.');
  const releaseKind = document.getElementById('plume-release-type')?.value;
  const releaseQuantity = Number(document.getElementById('plume-release-quantity')?.value);
  const releaseUnit = document.getElementById('plume-release-unit')?.value;
  const windSpeedMph = Number(document.getElementById('plume-wind-speed')?.value);
  const windDirDeg = Number(document.getElementById('plume-wind-direction')?.value);
  const temperatureF = Number(document.getElementById('plume-temperature')?.value);
  const stabilityClass = document.getElementById('plume-stability-class')?.value;
  const surfaceRoughness = document.getElementById('plume-surface-roughness')?.value;

  if (!['plume', 'puff'].includes(releaseKind)) throw new Error('Select a valid release type.');
  if (!Number.isFinite(releaseQuantity) || releaseQuantity <= 0) throw new Error('Enter a release quantity greater than zero.');
  if (!Number.isFinite(windSpeedMph) || windSpeedMph <= 0) throw new Error('Enter a wind speed greater than zero.');
  if (!Number.isFinite(windDirDeg) || windDirDeg < 0 || windDirDeg > 360) throw new Error('Enter the direction the wind is coming from, between 0 and 360 degrees.');
  if (!Number.isFinite(temperatureF)) throw new Error('Enter the current air temperature.');

  const releaseQuantityKg = releaseKind === 'puff'
    ? releaseQuantity * 0.45359237
    : releaseQuantity * ({ 'lb-min': 0.45359237 / 60, 'lb-sec': 0.45359237 }[releaseUnit] ?? 0.45359237 / 60);

  return {
    chemicalId: activeChemical.id,
    releaseKind,
    ...(releaseKind === 'puff' ? { totalMassKg: releaseQuantityKg } : { releaseRateKgPerSec: releaseQuantityKg }),
    windSpeedMps: windSpeedMph * 0.44704,
    windDirDeg,
    stabilityClass,
    surfaceRoughness,
    tempC: (temperatureF - 32) * (5 / 9),
    lat: location.lat,
    lng: location.lon,
  };
}

async function runBackendPlume(inputs) {
  if (!activeChemical) return { summary: 'Identify a chemical before running the plume model.', result: null };

  try {
    const response = await fetch('/api/plume/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = result?.error || 'Backend plume model unavailable for the current inputs.';
      return { summary: detail, result: null };
    }
    if (!result?.isopleths?.some((item) => item.polygon?.length >= 3)) {
      return { summary: 'No supported exposure thresholds were returned for this chemical.', result: null };
    }
    const maxDownwindM = Math.max(0, ...(result.isopleths || []).map((item) => item.maxDownwindM));
    return {
      summary: `${Math.round(maxDownwindM * 3.28084).toLocaleString()} ft maximum modeled downwind extent · ${result.modelVersion}`,
      result,
    };
  } catch {
    return { summary: 'Backend plume model request failed.', result: null };
  }
}

async function plotPlumeFromControls() {
  const plotButton = document.getElementById('plot-plume-btn');
  if (plotButton) plotButton.disabled = true;
  setText('plume-input-status', 'Validating incident and model inputs…');
  setText('plume-overlay-status', 'Calculating plume zones…');
  try {
    const location = await getIncidentCoordinates({ requestGps: true });
    if (!location) throw new Error('Enter an incident location before plotting.');
    await ensurePlumeMap(location);
    const inputs = readPlumeModelInputs(location);
    saveIncidentBrief({ quiet: true });
    const modeled = await runBackendPlume(inputs);
    setText('backend-model-summary', modeled.summary);
    if (!modeled.result) {
      await clearThreatZones(modeled.summary);
      setText('plume-input-status', modeled.summary);
      return;
    }

    importedPlumeOverlay = null;
    const geojson = plumeResultToGeoJson(modeled.result, location);
    const label = `${activeChemical.name} · operator-entered inputs · ${modeled.result.modelVersion}`;
    const rendered = await renderThreatZones(geojson, label);
    if (!rendered) throw new Error('The model did not return a displayable threshold polygon.');
    const releaseQuantity = document.getElementById('plume-release-quantity')?.value;
    const releaseUnit = document.getElementById('plume-release-unit')?.selectedOptions?.[0]?.textContent;
    const releaseType = document.getElementById('plume-release-type')?.selectedOptions?.[0]?.textContent;
    const windSpeed = document.getElementById('plume-wind-speed')?.value;
    const windDirection = document.getElementById('plume-wind-direction')?.value;
    const temperature = document.getElementById('plume-temperature')?.value;
    const stability = document.getElementById('plume-stability-class')?.value;
    const surface = document.getElementById('plume-surface-roughness')?.selectedOptions?.[0]?.textContent;
    const thresholdKinds = [...new Set((modeled.result.thresholdsUsed || []).map((threshold) => threshold.kind))];
    activePlumeCommand = {
      title: `${activeChemical.name} plume plotted`,
      summary: modeled.summary,
      source: `Source: /api/plume/run · model ${modeled.result.modelVersion} · ${thresholdKinds.join('/') || 'no'} backend thresholds.`,
      details: [
        `Operator input: ${releaseType}, ${releaseQuantity} ${releaseUnit}`,
        `Weather input: ${windSpeed} mph from ${windDirection}°; ${temperature}°F`,
        `Operator input: stability ${stability}; surface ${surface}`,
        `Computed: ${new Date(modeled.result.computedAt).toLocaleString()}`,
        modeled.result.disclaimer,
      ],
    };
    renderIncidentCommandSnapshot();
    setText('plume-input-status', `Plotted ${activeChemical.name}. Review the assumptions and modeled zones before operational use.`);
    setText('plume-live-status', `Plume plotted ${formatCentralZuluHtml()}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The plume could not be plotted.';
    setText('plume-input-status', message);
    setText('plume-overlay-status', message);
  } finally {
    if (plotButton) plotButton.disabled = !activeChemical;
  }
}

async function refreshPlumeWorkspace({ requestGps = true } = {}) {
  const token = ++plumeRefreshToken;
  const status = document.getElementById('plume-live-status');
  if (status) status.textContent = 'Resolving incident location…';

  let location;
  try {
    location = await getIncidentCoordinates({ requestGps });
  } catch (error) {
    if (status) status.textContent = error.message;
    setText('plume-location-source', 'Location required');
    return;
  }
  if (!location) {
    if (status) status.textContent = 'Enter coordinates in Incident Dashboard or use Current GPS.';
    return;
  }

  const address = getIncidentAddressValue() || 'Current GPS incident location';
  setText('plume-incident-address', address);
  setText('plume-gps-summary', `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`);
  setText('plume-location-source', location.source);
  const manualProduct = document.getElementById('incident-product')?.value.trim();
  setText('plume-product-summary', activeChemical
    ? `${activeChemical.name} · CAMEO record`
    : (manualProduct ? `${manualProduct} · manual incident entry` : 'No chemical selected'));
  setText('selected-model-summary', 'Plume Model');

  try {
    await ensurePlumeMap(location);
  } catch (error) {
    if (status) status.textContent = error.message;
    return;
  }
  if (status) status.textContent = 'Loading Open-Meteo and National Weather Service observations…';

  const [openMeteoResponse, nwsResponse] = await Promise.all([
    fetchOpenMeteo(location.lat, location.lon),
    fetchNwsObservation(location.lat, location.lon),
  ]);
  if (token !== plumeRefreshToken) return;

  const openMeteo = formatOpenMeteo(openMeteoResponse);
  const nws = formatNws(nwsResponse);
  setText('open-meteo-location', openMeteo?.location || 'Open-Meteo unavailable');
  setText('open-meteo-conditions', openMeteo?.conditions || 'Open-Meteo unavailable');
  setText('nws-station-summary', nws?.station || 'NWS observation station unavailable');
  setText('nws-weather-summary', nws?.conditions || 'NWS live observation unavailable');

  const weatherNotification = openMeteo?.conditions || nws?.conditions || 'Live weather unavailable';
  updateNotificationCenter({ weather: weatherNotification });
  latestPlumeWeather = openMeteo;
  if (openMeteo) applyLiveWeatherToPlumeInputs(openMeteo);
  else setText('plume-input-status', 'Live weather is unavailable. Enter weather observations manually before plotting.');
  setText('backend-model-summary', 'Awaiting Plot Plume');
  const imported = importedPlumeOverlay;
  if (imported) {
    await renderThreatZones(imported.geojson, imported.label);
  } else {
    await clearThreatZones('Confirm the model inputs, then select Plot Plume.');
  }
  if (token !== plumeRefreshToken) return;
  if (status) status.innerHTML = `Location and weather updated ${formatCentralZuluHtml()}.`;
}

function kmlToGeoJson(kmlText) {
  const xml = new DOMParser().parseFromString(kmlText, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('The KML file could not be parsed.');
  const features = [...xml.querySelectorAll('Polygon')].map((polygon, index) => {
    const placemark = polygon.closest('Placemark');
    const zoneLabel = placemark?.querySelector('name')?.textContent?.trim() || `Imported threat zone ${index + 1}`;
    const zoneName = zoneLabel.toLowerCase();
    const threatRank = zoneName.includes('red') ? 3
      : zoneName.includes('orange') ? 2
        : (zoneName.includes('yellow') || zoneName.includes('green')) ? 1
          : Math.min(3, index + 1);
    const coordinateText = polygon.querySelector('outerBoundaryIs coordinates, coordinates')?.textContent || '';
    const ring = coordinateText.trim().split(/\s+/).map((tuple) => tuple.split(',').slice(0, 2).map(Number))
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
    if (ring.length >= 3 && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) ring.push(ring[0]);
    return {
      type: 'Feature',
      id: index,
      properties: {
        zoneId: `imported-${index}`,
        label: zoneLabel,
        source: 'Imported ALOHA / MARPLOT KML',
        threatRank,
        colorName: threatZoneColorNames[threatRank],
        color: threatZoneColors[threatRank],
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
  }).filter((feature) => feature.geometry.coordinates[0].length >= 4);
  if (!features.length) throw new Error('No polygon threat zones were found in the KML file.');
  return { type: 'FeatureCollection', features };
}

async function importModelOverlay(file) {
  const textContent = await file.text();
  const geojson = kmlToGeoJson(textContent);
  const label = `Imported ALOHA / MARPLOT KML · ${file.name}`;
  importedPlumeOverlay = { geojson, label };
  await renderThreatZones(geojson, label);
  activePlumeCommand = {
    title: 'Imported plume overlay',
    summary: file.name,
    source: 'Source: operator-imported ALOHA / MARPLOT KML; not calculated by the HazMatIQ backend.',
    details: [`Imported file: ${file.name}`, `Imported: ${new Date().toLocaleString()}`],
  };
  renderIncidentCommandSnapshot();
  setText('backend-model-summary', label);
}

function openPlumeWorkspace() {
  showView('plume');
  refreshPlumeWorkspace({ requestGps: true });
}

document.getElementById('open-plume-btn')?.addEventListener('click', openPlumeWorkspace);
document.querySelectorAll('[data-command-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.commandView;
    if (target === 'plume') openPlumeWorkspace();
    else if (target) showView(target);
  });
});
document.querySelectorAll('[data-view="plume"]').forEach((button) => {
  button.addEventListener('click', () => refreshPlumeWorkspace({ requestGps: true }));
});

document.getElementById('refresh-plume-data-btn')?.addEventListener('click', () => refreshPlumeWorkspace({ requestGps: true }));
document.getElementById('change-plume-chemical-btn')?.addEventListener('click', () => {
  showView('lookup');
  chemicalSearchInput?.focus();
  chemicalSearchInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
document.getElementById('plume-release-type')?.addEventListener('change', updatePlumeReleaseQuantityLabel);
document.getElementById('use-live-plume-weather-btn')?.addEventListener('click', async () => {
  if (latestPlumeWeather) {
    applyLiveWeatherToPlumeInputs(latestPlumeWeather);
    return;
  }
  await refreshPlumeWorkspace({ requestGps: true });
});
document.getElementById('plume-model-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await plotPlumeFromControls();
});
updatePlumeReleaseQuantityLabel();
document.querySelectorAll('[data-plume-map-view]').forEach((button) => {
  button.addEventListener('click', () => setPlumeMapView(button.dataset.plumeMapView));
});
document.getElementById('plume-overlay-import')?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  setText('plume-overlay-status', `Importing ${file.name}…`);
  try {
    await importModelOverlay(file);
  } catch (error) {
    setText('plume-overlay-status', error.message);
  } finally {
    event.target.value = '';
  }
});
document.getElementById('update-incident-location-btn')?.addEventListener('click', async () => {
  const status = document.getElementById('incident-location-status');
  saveIncidentBrief({ quiet: true });
  if (status) status.textContent = 'Validating incident location…';
  const location = await getIncidentCoordinates({ requestGps: false });
  if (!location) {
    if (status) status.textContent = 'Enter valid coordinates, a location Open-Meteo can resolve, or use Current GPS.';
    return;
  }
  if (status) status.textContent = `Incident location saved: ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}.`;
  refreshPlumeWorkspace({ requestGps: false });
});
document.getElementById('use-current-location-btn')?.addEventListener('click', async () => {
  const status = document.getElementById('incident-location-status');
  if (status) status.textContent = 'Requesting current GPS location…';
  try {
    const gps = await getCurrentGps();
    const input = document.getElementById('incident-coordinates-input');
    if (input) input.value = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
    await setTacticalClockTimeZoneFromCoordinates(gps);
    if (status) status.textContent = `Current GPS saved: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}.`;
  } catch (error) {
    if (status) status.textContent = error.message;
  }
});

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
document.getElementById('tier2-reset-btn')?.addEventListener('click', () => {
  if (tier2SearchInput) tier2SearchInput.value = '';
  renderTier2Results();
});

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
initializeTacticalClock();
