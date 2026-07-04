const buttons = document.querySelectorAll('.module-btn');
const views = document.querySelectorAll('.view');

const tacticalAlertMessage = document.getElementById('tactical-alert-message');
const notificationWeather = document.getElementById('notification-weather');
const notificationMonitoring = document.getElementById('notification-monitoring');
const notificationUpdated = document.getElementById('notification-updated');

let tacticalClockTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let tacticalClockUsesGpsTimeZone = false;
let notificationWeatherLocation = null;

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
  updateNotificationCenter({ weather: 'Loading live weather…' });
  window.setInterval(() => {
    if (notificationWeatherLocation) void refreshNotificationWeather(notificationWeatherLocation);
  }, 5 * 60 * 1000);

  try {
    const gps = await getCurrentGps();
    try {
      await setTacticalClockTimeZoneFromCoordinates(gps);
    } catch {
      // Weather can still load if the timezone lookup fails.
    }
    await refreshNotificationWeather(gps);
  } catch {
    // The live clock remains useful with the device timezone if GPS is unavailable.
    updateNotificationCenter({ weather: 'Location needed for live weather' });
  }
}

// Start the clock before the remaining dashboard modules initialize so an
// unrelated module error cannot leave the Notification Center time unloaded.
initializeTacticalClock();

function updateNotificationCenter(update = {}) {
  if (Object.prototype.hasOwnProperty.call(update, 'tactical') && tacticalAlertMessage) {
    tacticalAlertMessage.textContent = update.tactical;
  }
  if (Object.prototype.hasOwnProperty.call(update, 'weather') && notificationWeather) {
    notificationWeather.textContent = update.weather;
  }
  if (Object.prototype.hasOwnProperty.call(update, 'monitoring') && notificationMonitoring) {
    const alerts = Array.isArray(update.monitoring)
      ? update.monitoring.filter(Boolean).join(' · ')
      : String(update.monitoring ?? '').trim();
    notificationMonitoring.textContent = alerts || 'No Alerts Found';
  }

}

window.HazMatIQ = window.HazMatIQ || {};
window.HazMatIQ.updateNotifications = updateNotificationCenter;

document.addEventListener('hazmatiq:telemetry', (event) => {
  updateNotificationCenter(event.detail || {});
});

function showView(targetId) {
  buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === targetId));
  views.forEach((view) => view.classList.toggle('active', view.id === targetId));
  if (targetId === 'incident') {
    renderIncidentCommandSnapshot();
    void refreshCommandWeather({ requestGps: false });
  }
  if (targetId === 'report') renderIncidentLists();
  if (targetId === 'my-chemicals') renderSavedChemicals();
  if (targetId === 'plume') updatePlumeModeLabel();
}

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.incidentAction === 'new') {
      beginNewIncident({ createRecord: true });
    } else if (button.dataset.incidentAction === 'training') {
      beginNewIncident();
    } else if (button.dataset.incidentAction === 'resume') {
      resumeActiveIncident();
    }
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

document.querySelectorAll('[data-preplan-name]').forEach((button) => {
  button.addEventListener('click', () => {
    setText('facility-preplan-status', `${button.dataset.preplanName} pre-plan is awaiting upload.`);
  });
});

document.getElementById('add-facility-preplan-btn')?.addEventListener('click', () => {
  setText('facility-preplan-status', 'Document upload, naming, and saving will be available here in a future update.');
});

const incidentBriefStorageKey = 'hazmatiq.incidentBrief';
const incidentBriefFieldIds = [
  'incidentName',
  'incident-number',
  'incident-facility-name',
  'incident-address-input',
  'incident-city',
  'incident-state',
  'incident-zip',
  'incident-coordinates-input',
  'incident-product',
  'incident-container-type',
  'incident-notes',
];
const incidentContainerFieldIds = [
  'plume-container-type',
  'container-size',
  'container-size-unit',
  'container-fill-level',
  'container-pressure-condition',
  'container-pressure',
  'container-pressure-unit',
  'container-pressure-source',
  'container-capacity',
  'container-pressure-profile',
  'container-size-preset',
  'container-release-location',
  'container-release-phase',
];
const incidentsStorageKey = 'hazmatiq_incidents';
const activeIncidentIdStorageKey = 'hazmatiq_active_incident_id';
const systemModeStorageKey = 'hazmatiq_system_mode';
const plumePlanningStorageKey = 'hazmatiq_plume_planning_session';
const icsFormCatalog = [
  ['201', 'ICS 201 Incident Briefing'],
  ['202', 'ICS 202 Incident Objectives'],
  ['203', 'ICS 203 Organization Assignment List'],
  ['204', 'ICS 204 Assignment List'],
  ['205', 'ICS 205 Communications Plan'],
  ['205A', 'ICS 205A Communications List'],
  ['206', 'ICS 206 Medical Plan'],
  ['208', 'ICS 208 Safety Message / Plan'],
  ['208HM', 'ICS 208HM Site Safety and Control Plan'],
  ['209', 'ICS 209 Incident Status Summary'],
  ['214', 'ICS 214 Activity Log'],
  ['215', 'ICS 215 Operational Planning Worksheet'],
  ['215A', 'ICS 215A IAP Safety Analysis'],
];
let incidentTimerInterval = null;
let incidentSyncTimer = null;
let openIcsForm = null;
let openIcsFormObjectUrl = null;
let openIncidentSummaryId = null;

// Local-only storage until incident records move to a database.
function readIncidents() {
  try {
    const incidents = JSON.parse(window.localStorage.getItem(incidentsStorageKey) || '[]');
    return Array.isArray(incidents) ? incidents : [];
  } catch {
    return [];
  }
}

function writeIncidents(incidents) {
  window.localStorage.setItem(incidentsStorageKey, JSON.stringify(incidents));
  window.clearTimeout(incidentSyncTimer);
  incidentSyncTimer = window.setTimeout(() => syncIncidentsToBackend(incidents), 250);
}

async function syncIncidentsToBackend(incidents = readIncidents()) {
  try {
    const response = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidents }),
    });
    if (!response.ok) throw new Error(`Incident sync failed (${response.status})`);
  } catch (error) {
    console.warn('Incident reports remain saved on this device; backend sync is unavailable.', error);
  }
}

function incidentModifiedAt(incident) {
  return Date.parse(incident.updatedAt || incident.completedAt || incident.startedAt || '') || 0;
}

async function restoreIncidentsFromBackend() {
  try {
    const response = await fetch('/api/incidents');
    if (!response.ok) throw new Error(`Incident restore failed (${response.status})`);
    const remote = (await response.json()).incidents;
    if (!Array.isArray(remote)) return;

    const merged = new Map(remote.map((incident) => [incident.incidentId, incident]));
    readIncidents().forEach((local) => {
      const saved = merged.get(local.incidentId);
      if (!saved || incidentModifiedAt(local) >= incidentModifiedAt(saved)) merged.set(local.incidentId, local);
    });
    writeIncidents([...merged.values()]);
    renderIncidentLists();
  } catch (error) {
    console.warn('Using incident reports saved on this device; backend restore is unavailable.', error);
  }
}

function getActiveIncident() {
  const activeId = window.localStorage.getItem(activeIncidentIdStorageKey);
  return readIncidents().find((incident) => incident.incidentId === activeId) || null;
}

function hasActiveIncident() {
  return Boolean(window.localStorage.getItem(activeIncidentIdStorageKey));
}

function setSystemMode(mode) {
  try {
    if (mode === 'training') window.sessionStorage.setItem(systemModeStorageKey, mode);
    else window.sessionStorage.removeItem(systemModeStorageKey);
  } catch {
    // Mode still renders from incident state when session storage is unavailable.
  }
  renderSystemNotification();
}

function getIncidentElapsedTime(incident) {
  const startedAt = Date.parse(incident?.startedAt || '');
  const elapsedSeconds = Number.isFinite(startedAt) ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function renderSystemNotification() {
  const activeIncident = getActiveIncident();
  if (activeIncident) {
    updateNotificationCenter({ tactical: `Active Incident · ${getIncidentElapsedTime(activeIncident)}` });
    return;
  }

  let mode = null;
  try {
    mode = window.sessionStorage.getItem(systemModeStorageKey);
  } catch {
    // Fall through to the normal system state.
  }
  updateNotificationCenter({ tactical: mode === 'training' ? 'Training / Demo Mode' : 'System Normal' });
}

function updatePlumeModeLabel() {
  const label = document.getElementById('plume-mode-label');
  if (label) {
    label.textContent = hasActiveIncident()
      ? 'Active Incident Mode - Data will be saved to the current incident'
      : 'Planning Mode - Not attached to an incident';
  }
}

function savePlanningState(update) {
  try {
    const current = JSON.parse(window.localStorage.getItem(plumePlanningStorageKey) || '{}');
    window.localStorage.setItem(plumePlanningStorageKey, JSON.stringify({ ...current, ...update }));
  } catch {
    // Planning state can remain in memory if browser storage is unavailable.
  }
}

function createIncidentRecord() {
  const now = new Date();
  const oldActiveId = window.localStorage.getItem(activeIncidentIdStorageKey);
  const incidents = readIncidents().map((incident) => incident.incidentId === oldActiveId
    ? {
        ...incident,
        status: 'Completed',
        completedAt: now.toISOString(),
        completedDate: now.toLocaleDateString(),
        completedTime: now.toLocaleTimeString(),
        icsForms: Object.fromEntries(icsFormCatalog.map(([id]) => [id, {
          ...(incident.icsForms?.[id] || { fields: {} }),
          archivedAt: now.toISOString(),
        }])),
      }
    : incident);
  const incident = {
    incidentId: window.crypto?.randomUUID?.() || `incident-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    incidentName: document.getElementById('incidentName')?.value.trim() || 'New Incident',
    // Reserved for the future First Due integration; HazMatIQ does not generate this number.
    incidentNumber: '',
    startDate: now.toLocaleDateString(),
    startTime: now.toLocaleTimeString(),
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: 'Active',
    icsForms: Object.fromEntries(icsFormCatalog.map(([id]) => [id, { fields: {}, createdAt: now.toISOString() }])),
  };
  writeIncidents([incident, ...incidents]);
  window.localStorage.setItem(activeIncidentIdStorageKey, incident.incidentId);
  setSystemMode('incident');
  startIncidentTimer();
  renderIncidentLists();
}

function renderIncidentTimer() {
  const timer = document.getElementById('active-incident-timer');
  const activeIncident = getActiveIncident();
  if (timer) timer.textContent = getIncidentElapsedTime(activeIncident);
  renderSystemNotification();
}

function startIncidentTimer() {
  renderIncidentTimer();
  if (!incidentTimerInterval) incidentTimerInterval = window.setInterval(renderIncidentTimer, 1000);
}

function getIncidentFormData() {
  const coordinates = parseGpsCoordinate(document.getElementById('incident-coordinates-input')?.value);
  const advanced = Object.fromEntries(activeChemicalRecord?.advanced || []);
  const containerSelect = document.getElementById('plume-container-type');
  const existingIncident = getActiveIncident();
  const selectionMatchesIncident = String(activeChemical?.selectedChemicalId ?? '') === String(existingIncident?.selectedChemicalId ?? '');
  const chemicalProfile = activeChemicalRecord?.profile
    || (selectionMatchesIncident ? existingIncident?.chemicalProfile : null)
    || null;
  const profileMatchesIncident = chemicalProfile?.header?.name === existingIncident?.chemicalProfile?.header?.name;
  return {
    incidentName: document.getElementById('incidentName')?.value.trim() || getActiveIncident()?.incidentName || 'New Incident',
    incidentNumber: document.getElementById('incident-number')?.value.trim() || '',
    facilityName: document.getElementById('incident-facility-name')?.value.trim()
      || (!document.getElementById('facility-inventory')?.hidden ? document.getElementById('facility-name')?.textContent.trim() : '')
      || '',
    address: document.getElementById('incident-address-input')?.value.trim() || '',
    city: document.getElementById('incident-city')?.value.trim() || '',
    state: document.getElementById('incident-state')?.value.trim() || '',
    zip: document.getElementById('incident-zip')?.value.trim() || '',
    latitude: coordinates?.lat ?? '',
    longitude: coordinates?.lon ?? '',
    weather: latestPlumeWeather?.conditions || '',
    windSpeed: document.getElementById('plume-wind-speed')?.value || latestPlumeWeather?.windSpeedMph || '',
    windDirection: document.getElementById('plume-wind-direction')?.value || latestPlumeWeather?.windDirDeg || '',
    chemicalName: document.getElementById('incident-product')?.value.trim() || activeChemical?.name || existingIncident?.chemicalName || '',
    selectedChemicalId: activeChemical?.selectedChemicalId ?? existingIncident?.selectedChemicalId ?? null,
    casNumber: advanced.CAS === 'N/A' ? '' : advanced.CAS || chemicalProfile?.header?.cas || existingIncident?.casNumber || '',
    unNumber: activeChemicalRecord?.un === 'N/A' ? '' : activeChemicalRecord?.un || chemicalProfile?.header?.un || existingIncident?.unNumber || '',
    ergGuide: chemicalProfile?.header?.ergGuide || activeChemicalRecord?.ergGuide || existingIncident?.ergGuide || '',
    idlh: chemicalProfile?.header?.idlh || activeChemicalRecord?.idlh || existingIncident?.idlh || '',
    primaryHazard: chemicalProfile?.header?.hazard || existingIncident?.primaryHazard || '',
    chemicalProfile,
    chemicalProfileCapturedAt: chemicalProfile
      ? (profileMatchesIncident ? existingIncident?.chemicalProfileCapturedAt : null) || new Date().toISOString()
      : null,
    quantity: document.getElementById('plume-release-quantity')?.value || '',
    containerType: containerSelect?.selectedOptions?.[0]?.textContent.trim() || '',
    containerProfileId: containerSelect?.value || '',
    containerSize: document.getElementById('container-size')?.value || '',
    containerSizeUnit: document.getElementById('container-size-unit')?.value || '',
    containerFillLevel: document.getElementById('container-fill-level')?.value || '',
    containerPressureCondition: document.getElementById('container-pressure-condition')?.value || 'Unknown / verify',
    containerPressureConfidence: document.getElementById('container-pressure-confidence')?.textContent || 'Planning default',
    containerPressure: document.getElementById('container-pressure')?.value || '',
    containerPressureUnit: document.getElementById('container-pressure-unit')?.value || '',
    containerPressureSource: document.getElementById('container-pressure-source')?.value || 'Unknown',
    containerCapacity: document.getElementById('container-capacity')?.value.trim() || '',
    containerPressureProfile: document.getElementById('container-pressure-profile')?.value.trim() || '',
    containerReleaseLocation: document.getElementById('container-release-location')?.value || '',
    containerReleasePhase: document.getElementById('container-release-phase')?.value || '',
    notes: document.getElementById('incident-notes')?.value.trim() || '',
  };
}

function updateActiveIncidentRecord() {
  const activeId = window.localStorage.getItem(activeIncidentIdStorageKey);
  if (!activeId) return;
  const incidents = readIncidents();
  const index = incidents.findIndex((incident) => incident.incidentId === activeId);
  if (index < 0) return;
  incidents[index] = { ...incidents[index], ...getIncidentFormData(), updatedAt: new Date().toISOString() };
  writeIncidents(incidents);
  renderIncidentLists();
}

// Complete the active incident without removing its saved record.
function completeActiveIncident() {
  updateActiveIncidentRecord();
  const activeId = window.localStorage.getItem(activeIncidentIdStorageKey);
  const incidents = readIncidents();
  const index = incidents.findIndex((incident) => incident.incidentId === activeId);
  if (index < 0) return;
  const now = new Date();
  incidents[index] = {
    ...incidents[index],
    status: 'Completed',
    completedAt: now.toISOString(),
    completedDate: now.toLocaleDateString(),
    completedTime: now.toLocaleTimeString(),
    icsForms: Object.fromEntries(icsFormCatalog.map(([id]) => [id, {
      ...(incidents[index].icsForms?.[id] || { fields: {} }),
      archivedAt: now.toISOString(),
    }])),
  };
  writeIncidents(incidents);
  window.localStorage.removeItem(activeIncidentIdStorageKey);
  setSystemMode('normal');
  renderIncidentTimer();
  renderIncidentLists();
  setIncidentStatus('Incident completed and its ICS forms moved to Completed Forms.');
  showView('report');
  document.querySelector('[data-report-tab="previous"]')?.click();
}

function renderIncidentCard(container, incident, activeId) {
  if (!container) return;
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'report-incident-item';
  const details = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = incident.incidentName || 'New Incident';
  const summary = document.createElement('small');
  const place = [incident.facilityName, incident.address, incident.city, incident.state].filter(Boolean).join(', ');
  summary.textContent = [incident.startDate, incident.startTime, place].filter(Boolean).join(' · ');
  const status = document.createElement('span');
  status.className = 'status-pill';
  status.textContent = incident.incidentId === activeId ? 'Active' : incident.status || 'Completed';
  details.append(name, summary);
  item.append(details, status);
  item.addEventListener('click', () => openIncidentSummary(incident.incidentId));
  container.append(item);
}

function renderIncidentLists() {
  const activeId = window.localStorage.getItem(activeIncidentIdStorageKey);
  const incidents = readIncidents();
  const currentContainer = document.getElementById('current-incident-list');
  const previousContainer = document.getElementById('previous-incident-list');
  currentContainer?.replaceChildren();
  previousContainer?.replaceChildren();
  const current = incidents.find((incident) => incident.incidentId === activeId);
  if (current) renderIncidentCard(currentContainer, current, activeId);
  else if (currentContainer) currentContainer.textContent = 'No active incident. Start one from the Home Page.';
  const previous = incidents.filter((incident) => incident.status === 'Completed');
  previous.forEach((incident) => renderIncidentCard(previousContainer, incident, activeId));
  if (!previous.length && previousContainer) previousContainer.textContent = 'No completed incident forms saved yet.';
  renderActiveIcsFormList();
}

function createIcsFormLink(incidentId, formId, title) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ics-form-text-link';
  button.textContent = title;
  button.addEventListener('click', () => void openIncidentIcsForm(incidentId, formId));
  return button;
}

function renderActiveIcsFormList() {
  const container = document.getElementById('active-ics-form-list');
  if (!container) return;
  container.replaceChildren();
  const incident = getActiveIncident();
  if (!incident) {
    container.textContent = 'Start an incident to create its ICS form drafts.';
    return;
  }
  icsFormCatalog.forEach(([id, title]) => container.append(createIcsFormLink(incident.incidentId, id, title)));
}

function appendCompletedIcsForms(container, incident) {
  const section = document.createElement('section');
  section.className = 'report-summary-block completed-ics-forms';
  const heading = document.createElement('h3');
  heading.textContent = 'Completed Forms';
  const list = document.createElement('div');
  list.className = 'incident-ics-form-list';
  icsFormCatalog.forEach(([id, title]) => list.append(createIcsFormLink(incident.incidentId, id, title)));
  section.append(heading, list);
  container.append(section);
}

function appendIncidentSummarySection(container, title, entries) {
  const applicable = entries.filter(([, value]) => Array.isArray(value) ? value.length : value !== '' && value !== null && value !== undefined);
  if (!applicable.length) return;
  const section = document.createElement('section');
  section.className = 'report-summary-block';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('dl');
  applicable.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'report-summary-row';
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    if (Array.isArray(value)) {
      const bullets = document.createElement('ul');
      value.forEach((item) => {
        const bullet = document.createElement('li');
        bullet.textContent = item;
        bullets.append(bullet);
      });
      description.append(bullets);
    } else {
      description.textContent = String(value);
    }
    row.append(term, description);
    list.append(row);
  });
  section.append(heading, list);
  container.append(section);
}

function incidentProfileValue(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const formatted = incidentProfileValue(item);
      return Array.isArray(formatted) ? formatted : formatted ? [formatted] : [];
    });
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => {
      const formatted = incidentProfileValue(item);
      if (!formatted || (Array.isArray(formatted) && !formatted.length)) return [];
      const label = titleCaseProfileLabel(key.replace(/([a-z])([A-Z0-9])/g, '$1 $2'));
      return Array.isArray(formatted)
        ? formatted.map((entry) => `${label}: ${entry}`)
        : [`${label}: ${formatted}`];
    });
  }
  const text = String(value ?? '').trim();
  return hasAvailableProfileData(text) ? text : '';
}

function appendChemicalProfileToIncidentReport(container, profile) {
  if (!profile || typeof profile !== 'object') return;
  const header = profile.header || {};
  appendIncidentSummarySection(container, 'Chemical Hazard Summary', [
    ['Canonical chemical', header.name],
    ['CAS number', header.cas],
    ['UN/NA number', header.un],
    ['ERG guide', header.ergGuide],
    ['IDLH', header.idlh],
    ['Primary hazard', header.hazard],
  ]);
  const sections = [
    ['Chemical Properties', 'properties'],
    ['Exposure Information', 'exposures'],
    ['PPE / Respiratory Protection', 'ppeRespiratory'],
    ['Detection Information', 'detectors'],
    ['Reactivity', 'reactivity'],
    ['Isolation Distances / ERG', 'isolationErg'],
    ['Medical Considerations', 'medical'],
    ['Fire', 'fire'],
    ['Decontamination', 'decon'],
  ];
  sections.forEach(([title, key]) => {
    const section = profile[key];
    if (!section || typeof section !== 'object') return;
    const entries = Object.entries(section).map(([field, value]) => [
      titleCaseProfileLabel(field.replace(/([a-z])([A-Z0-9])/g, '$1 $2')),
      incidentProfileValue(value),
    ]);
    appendIncidentSummarySection(container, title, entries);
  });
}

const completedReportFields = [
  ['incidentName', 'Incident name', 'text'],
  ['startDate', 'Start date', 'text'],
  ['startTime', 'Start time', 'text'],
  ['completedDate', 'Completed date', 'text'],
  ['completedTime', 'Completed time', 'text'],
  ['facilityName', 'Facility', 'text'],
  ['address', 'Street address / scene location', 'text'],
  ['city', 'City', 'text'],
  ['state', 'State', 'text'],
  ['zip', 'ZIP', 'text'],
  ['latitude', 'Latitude', 'number'],
  ['longitude', 'Longitude', 'number'],
  ['chemicalName', 'Chemical / product', 'text'],
  ['casNumber', 'CAS number', 'text'],
  ['unNumber', 'UN/NA number', 'text'],
  ['quantity', 'Released quantity / rate', 'text'],
  ['containerType', 'Container type', 'text'],
  ['containerSize', 'Container size', 'text'],
  ['containerSizeUnit', 'Size unit', 'text'],
  ['containerFillLevel', 'Fill level %', 'number'],
  ['containerPressure', 'Pressure', 'number'],
  ['containerPressureUnit', 'Pressure unit', 'text'],
  ['containerCapacity', 'Capacity / range', 'text'],
  ['containerPressureProfile', 'Pressure profile', 'text'],
  ['containerReleaseLocation', 'Release location', 'text'],
  ['containerReleasePhase', 'Release phase', 'text'],
  ['weather', 'Weather / conditions', 'text'],
  ['windSpeed', 'Wind speed', 'text'],
  ['windDirection', 'Wind direction', 'text'],
  ['notes', 'Scene notes', 'textarea'],
];

function setIncidentSummaryEditing(editing) {
  const edit = document.getElementById('edit-incident-summary-btn');
  const save = document.getElementById('save-incident-summary-btn');
  const cancel = document.getElementById('cancel-incident-summary-edit-btn');
  if (edit) edit.hidden = editing || !openIncidentSummaryId;
  if (save) save.hidden = !editing;
  if (cancel) cancel.hidden = !editing;
}

function renderCompletedReportEditor(incident) {
  const content = document.getElementById('incident-report-summary-content');
  if (!content) return;
  content.replaceChildren();
  const notice = document.createElement('p');
  notice.className = 'report-edit-notice';
  notice.textContent = 'Incident number is reserved for First Due and remains blank.';
  const form = document.createElement('form');
  form.id = 'completed-report-edit-form';
  form.className = 'completed-report-edit-grid';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveCompletedReportEdits();
  });
  completedReportFields.forEach(([key, labelText, type]) => {
    const label = document.createElement('label');
    if (type === 'textarea') label.className = 'report-edit-field-wide';
    const caption = document.createElement('span');
    caption.textContent = labelText;
    const control = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type === 'textarea') control.rows = 5;
    else {
      control.type = type;
      if (type === 'number') control.step = 'any';
    }
    control.name = key;
    control.value = incident[key] ?? '';
    label.append(caption, control);
    form.append(label);
  });
  content.append(notice, form);
  setIncidentSummaryEditing(true);
}

function saveCompletedReportEdits() {
  const form = document.getElementById('completed-report-edit-form');
  if (!form || !openIncidentSummaryId) return;
  const incidents = readIncidents();
  const index = incidents.findIndex((incident) => incident.incidentId === openIncidentSummaryId);
  if (index < 0 || incidents[index].status !== 'Completed') return;
  const values = Object.fromEntries(new FormData(form).entries());
  incidents[index] = {
    ...incidents[index],
    ...values,
    incidentNumber: '',
    updatedAt: new Date().toISOString(),
  };
  writeIncidents(incidents);
  renderIncidentLists();
  openIncidentSummary(openIncidentSummaryId);
}

function openIncidentSummary(incidentId) {
  const incident = readIncidents().find((item) => item.incidentId === incidentId);
  const summary = document.getElementById('incident-report-summary');
  const content = document.getElementById('incident-report-summary-content');
  if (!incident || !summary || !content) return;
  openIncidentSummaryId = incidentId;
  setIncidentSummaryEditing(false);
  const editButton = document.getElementById('edit-incident-summary-btn');
  if (editButton) editButton.hidden = incident.status !== 'Completed';
  document.getElementById('incident-report-summary-title').textContent = incident.incidentName || 'Incident Summary';
  content.replaceChildren();
  appendIncidentSummarySection(content, 'Incident Details', [
    ['Incident name', incident.incidentName],
    ['Incident ID', incident.incidentId],
    ['Status', incident.status],
    ['Started', [incident.startDate, incident.startTime].filter(Boolean).join(' ')],
    ['Completed', [incident.completedDate, incident.completedTime].filter(Boolean).join(' ')],
  ]);
  appendIncidentSummarySection(content, 'Location', [
    ['Facility', incident.facilityName],
    ['Address', [incident.address, incident.city, incident.state, incident.zip].filter(Boolean).join(', ')],
    ['GPS', incident.latitude !== '' && incident.longitude !== '' ? `${incident.latitude}, ${incident.longitude}` : ''],
  ]);
  appendIncidentSummarySection(content, 'Chemical and Release', [
    ['Chemical', incident.chemicalName],
    ['CAS number', incident.casNumber],
    ['UN/NA number', incident.unNumber],
    ['Quantity', incident.quantity],
    ['Container type', incident.containerType],
    ['Container size', [incident.containerSize, incident.containerSizeUnit].filter(Boolean).join(' ')],
    ['Fill level', incident.containerFillLevel ? `${incident.containerFillLevel}%` : ''],
    ['Pressure', [incident.containerPressure, incident.containerPressureUnit].filter(Boolean).join(' ')],
    ['Typical capacity/range', incident.containerCapacity],
    ['Pressure profile', incident.containerPressureProfile],
    ['Release location', incident.containerReleaseLocation],
    ['Release phase', incident.containerReleasePhase],
    ['Sources', incident.chemicalSources],
  ]);
  appendChemicalProfileToIncidentReport(content, incident.chemicalProfile);
  appendIncidentSummarySection(content, 'Conditions', [
    ['Weather', incident.weather],
    ['Wind speed', incident.windSpeed],
    ['Wind direction', incident.windDirection],
  ]);
  appendIncidentSummarySection(content, 'PPE Requirements', [['Guidance', incident.ppeSummary?.items || []]]);
  appendIncidentSummarySection(content, 'Medical Summary', [['Guidance', incident.medicalSummary?.items || []]]);
  appendIncidentSummarySection(content, 'Plume Model', [
    ['Result', incident.plumeSummary?.summary],
    ['Source', incident.plumeSummary?.source],
    ['Details', incident.plumeSummary?.details || []],
  ]);
  if (incident.plumeMapImage) {
    const mapSection = document.createElement('section');
    mapSection.className = 'report-summary-block plume-map-summary';
    const mapHeading = document.createElement('h3');
    mapHeading.textContent = `${incident.incidentName || 'Incident'} Plume Model`;
    const mapTimestamp = document.createElement('p');
    mapTimestamp.className = 'muted';
    mapTimestamp.textContent = incident.plumeUpdatedAt
      ? `Plume model generated ${new Date(incident.plumeUpdatedAt).toLocaleString()}`
      : 'Plume model date and time unavailable';
    const mapImage = document.createElement('img');
    mapImage.src = incident.plumeMapImage;
    mapImage.alt = 'Most recent plume model map for this incident';
    mapSection.append(mapHeading, mapTimestamp, mapImage);
    content.append(mapSection);
  }
  appendIncidentSummarySection(content, 'Documentation Notes', [['Notes', incident.notes]]);
  if (incident.status === 'Completed') appendCompletedIcsForms(content, incident);
  document.querySelector('.report-tabs').hidden = true;
  ['current', 'previous', 'library'].forEach((name) => {
    const section = document.getElementById(`report-${name}-section`);
    if (section) section.hidden = true;
  });
  summary.hidden = false;
  const formEditor = document.getElementById('ics-form-editor');
  if (formEditor) formEditor.hidden = true;
  summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeIncidentSummary() {
  openIncidentSummaryId = null;
  setIncidentSummaryEditing(false);
  const summary = document.getElementById('incident-report-summary');
  if (summary) summary.hidden = true;
  const tabs = document.querySelector('.report-tabs');
  if (tabs) tabs.hidden = false;
  const selected = document.querySelector('[data-report-tab].primary-btn')?.dataset.reportTab || 'current';
  const selectedSection = document.getElementById(`report-${selected}-section`);
  if (selectedSection) selectedSection.hidden = false;
}

function formatIcsFieldLabel(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/Row(\d+)/g, ' — row $1')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function setIcsFormEditing(editing) {
  if (!openIcsForm) return;
  openIcsForm.editing = editing;
  document.querySelectorAll('#ics-form-fields input, #ics-form-fields textarea').forEach((field) => {
    field.disabled = !editing;
  });
  const editButton = document.getElementById('edit-ics-form-btn');
  const saveButton = document.getElementById('save-ics-form-btn');
  if (editButton) editButton.hidden = editing || !openIcsForm.completed;
  if (saveButton) saveButton.hidden = !editing;
}

async function openIncidentIcsForm(incidentId, formId) {
  const incident = readIncidents().find((item) => item.incidentId === incidentId);
  const editor = document.getElementById('ics-form-editor');
  const fieldsContainer = document.getElementById('ics-form-fields');
  const status = document.getElementById('ics-form-editor-status');
  if (!incident || !editor || !fieldsContainer || !status) return;

  openIcsForm = { incidentId, formId, completed: incident.status === 'Completed', editing: incident.status !== 'Completed' };
  document.querySelector('.report-tabs').hidden = true;
  ['current', 'previous', 'library'].forEach((name) => {
    const section = document.getElementById(`report-${name}-section`);
    if (section) section.hidden = true;
  });
  const summary = document.getElementById('incident-report-summary');
  if (summary) summary.hidden = true;
  editor.hidden = false;
  fieldsContainer.replaceChildren();
  status.textContent = 'Preparing the saved FEMA form…';

  try {
    const response = await fetch(`/api/ics-forms/${encodeURIComponent(formId)}/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident),
    });
    if (!response.ok) throw new Error(`Form preparation failed (${response.status})`);
    const prepared = await response.json();
    document.getElementById('ics-form-editor-title').textContent = prepared.title;
    document.getElementById('ics-form-editor-context').textContent = openIcsForm.completed
      ? `${incident.incidentName} · Completed form`
      : `${incident.incidentName} · Active incident form`;
    prepared.fields.forEach((field) => {
      const label = document.createElement('label');
      label.className = 'ics-form-field';
      const caption = document.createElement('span');
      caption.textContent = formatIcsFieldLabel(field.name);
      const control = document.createElement(field.multiline ? 'textarea' : 'input');
      if (!field.multiline) control.type = 'text';
      else control.rows = 3;
      control.name = field.name;
      control.value = field.value || '';
      control.dataset.source = field.source;
      control.addEventListener('input', () => { control.dataset.dirty = 'true'; });
      label.append(caption, control);
      fieldsContainer.append(label);
    });
    setIcsFormEditing(!openIcsForm.completed);
    status.textContent = openIcsForm.completed
      ? 'Archived with the completed incident. Select Edit to add missing information.'
      : 'Dashboard data is prefilled. Manual changes are saved with this active incident.';
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error(error);
    status.textContent = 'The FEMA form could not be prepared. Please try again.';
  }
}

function saveOpenIcsForm() {
  if (!openIcsForm) return null;
  const incidents = readIncidents();
  const index = incidents.findIndex((incident) => incident.incidentId === openIcsForm.incidentId);
  if (index < 0) return null;
  const incident = incidents[index];
  const existing = incident.icsForms?.[openIcsForm.formId] || { fields: {} };
  const fields = { ...(existing.fields || {}) };
  document.querySelectorAll('#ics-form-fields input[data-dirty="true"], #ics-form-fields textarea[data-dirty="true"]').forEach((control) => {
    if (control.value.trim()) fields[control.name] = control.value;
    else delete fields[control.name];
    delete control.dataset.dirty;
    control.dataset.source = control.value.trim() ? 'manual' : 'blank';
  });
  const now = new Date().toISOString();
  incidents[index] = {
    ...incident,
    updatedAt: now,
    icsForms: {
      ...(incident.icsForms || {}),
      [openIcsForm.formId]: { ...existing, fields, updatedAt: now },
    },
  };
  writeIncidents(incidents);
  document.getElementById('ics-form-editor-status').textContent = 'Form saved with the incident.';
  if (openIcsForm.completed) setIcsFormEditing(false);
  return incidents[index];
}

async function openIcsPdf() {
  if (!openIcsForm) return;
  const incident = openIcsForm.editing
    ? saveOpenIcsForm()
    : readIncidents().find((item) => item.incidentId === openIcsForm.incidentId);
  if (!incident) return;
  const status = document.getElementById('ics-form-editor-status');
  status.textContent = 'Generating the populated FEMA PDF…';
  try {
    const response = await fetch(`/api/ics-forms/${encodeURIComponent(openIcsForm.formId)}/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident),
    });
    if (!response.ok) throw new Error(`PDF generation failed (${response.status})`);
    if (openIcsFormObjectUrl) URL.revokeObjectURL(openIcsFormObjectUrl);
    openIcsFormObjectUrl = URL.createObjectURL(await response.blob());
    window.open(openIcsFormObjectUrl, '_blank', 'noopener');
    status.textContent = 'The populated PDF opened in a new tab.';
  } catch (error) {
    console.error(error);
    status.textContent = 'The populated PDF could not be generated. Please try again.';
  }
}

document.getElementById('edit-ics-form-btn')?.addEventListener('click', () => setIcsFormEditing(true));
document.getElementById('save-ics-form-btn')?.addEventListener('click', saveOpenIcsForm);
document.getElementById('download-ics-form-btn')?.addEventListener('click', () => void openIcsPdf());
document.getElementById('back-from-ics-form-btn')?.addEventListener('click', () => {
  const incidentId = openIcsForm?.incidentId;
  const completed = openIcsForm?.completed;
  document.getElementById('ics-form-editor').hidden = true;
  openIcsForm = null;
  if (completed && incidentId) openIncidentSummary(incidentId);
  else closeIncidentSummary();
});

document.querySelectorAll('[data-report-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const selected = button.dataset.reportTab;
    document.querySelectorAll('[data-report-tab]').forEach((tab) => {
      tab.classList.toggle('primary-btn', tab === button);
      tab.classList.toggle('ghost-btn', tab !== button);
    });
    ['current', 'previous', 'library'].forEach((name) => {
      const section = document.getElementById(`report-${name}-section`);
      if (section) section.hidden = name !== selected;
    });
    renderIncidentLists();
    if (selected === 'current') document.getElementById('current-incident-options')?.focus();
  });
});

document.getElementById('open-current-incident-summary-btn')?.addEventListener('click', () => {
  const activeId = window.localStorage.getItem(activeIncidentIdStorageKey);
  if (activeId) openIncidentSummary(activeId);
});
document.getElementById('back-to-incident-reports-btn')?.addEventListener('click', closeIncidentSummary);
document.getElementById('edit-incident-summary-btn')?.addEventListener('click', () => {
  const incident = readIncidents().find((item) => item.incidentId === openIncidentSummaryId);
  if (incident?.status === 'Completed') renderCompletedReportEditor(incident);
});
document.getElementById('cancel-incident-summary-edit-btn')?.addEventListener('click', () => {
  if (openIncidentSummaryId) openIncidentSummary(openIncidentSummaryId);
});
document.getElementById('save-incident-summary-btn')?.addEventListener('click', saveCompletedReportEdits);
document.getElementById('print-incident-summary-btn')?.addEventListener('click', () => window.print());

// Save brief edits directly to the active incident.
incidentBriefFieldIds.forEach((id) => {
  document.getElementById(id)?.addEventListener('input', updateActiveIncidentRecord);
});
['plume-release-quantity', 'plume-wind-speed', 'plume-wind-direction'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', updateActiveIncidentRecord);
});
startIncidentTimer();
renderIncidentLists();
void restoreIncidentsFromBackend();

const completeIncidentDialog = document.getElementById('complete-incident-dialog');
document.getElementById('complete-incident-btn')?.addEventListener('click', () => completeIncidentDialog?.showModal());
document.getElementById('cancel-complete-incident-btn')?.addEventListener('click', () => completeIncidentDialog?.close());
document.getElementById('confirm-complete-incident-btn')?.addEventListener('click', () => {
  completeActiveIncident();
  completeIncidentDialog?.close();
});

const incidentAddressInput = document.getElementById('incident-address-input');
const incidentAddressSuggestions = document.getElementById('incident-address-suggestions');
const arcgisGeocoderUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
let incidentAddressSearchTimer = 0;
let latestIncidentAddressSearch = 0;

function clearIncidentAddressSuggestions() {
  if (!incidentAddressSuggestions) return;
  incidentAddressSuggestions.replaceChildren();
  incidentAddressSuggestions.hidden = true;
  incidentAddressInput?.setAttribute('aria-expanded', 'false');
}

function focusIncidentAddressSuggestion(currentButton, offset) {
  const buttons = [...(incidentAddressSuggestions?.querySelectorAll('button') || [])];
  const currentIndex = buttons.indexOf(currentButton);
  buttons[(currentIndex + offset + buttons.length) % buttons.length]?.focus();
}

async function selectIncidentAddress(suggestion) {
  latestIncidentAddressSearch += 1;
  clearIncidentAddressSuggestions();
  setIncidentStatus('Loading the selected address…');

  const query = new URLSearchParams({
    f: 'json',
    SingleLine: suggestion.text,
    magicKey: suggestion.magicKey,
    countryCode: 'USA',
    outFields: 'Address,StAddr,ShortLabel,City,Region,RegionAbbr,Postal,Country',
    maxLocations: '1',
    forStorage: 'false',
  });
  const result = await fetchJson(`${arcgisGeocoderUrl}/findAddressCandidates?${query}`);
  const candidate = result?.candidates?.[0];
  if (!candidate) {
    setIncidentStatus('That address could not be resolved. Try another suggestion or enter the location manually.');
    return;
  }

  const attributes = candidate.attributes || {};
  const cityInput = document.getElementById('incident-city');
  const stateInput = document.getElementById('incident-state');
  const coordinateInput = document.getElementById('incident-coordinates-input');
  if (incidentAddressInput) {
    incidentAddressInput.value = attributes.StAddr || attributes.Address || attributes.ShortLabel || candidate.address || suggestion.text;
  }
  if (cityInput) cityInput.value = attributes.City || '';
  if (stateInput) stateInput.value = attributes.RegionAbbr || attributes.Region || '';
  if (coordinateInput && Number.isFinite(candidate.location?.y) && Number.isFinite(candidate.location?.x)) {
    coordinateInput.value = `${candidate.location.y.toFixed(6)}, ${candidate.location.x.toFixed(6)}`;
  }
  updateActiveIncidentRecord();
  setIncidentStatus(`Address selected: ${candidate.address || suggestion.text}. City, state, and GPS updated.`);
}

async function searchIncidentAddresses(value) {
  const requestId = ++latestIncidentAddressSearch;
  const query = new URLSearchParams({
    f: 'json',
    text: value,
    countryCode: 'USA',
    maxSuggestions: '6',
  });
  const result = await fetchJson(`${arcgisGeocoderUrl}/suggest?${query}`);
  if (requestId !== latestIncidentAddressSearch || !incidentAddressSuggestions) return;

  incidentAddressSuggestions.replaceChildren();
  (result?.suggestions || []).forEach((suggestion) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chemical-suggestion';
    button.setAttribute('role', 'option');

    const type = document.createElement('span');
    type.className = 'chemical-suggestion-type';
    type.textContent = 'Address';
    const text = document.createElement('strong');
    text.textContent = suggestion.text;
    button.append(type, text);
    button.addEventListener('click', () => void selectIncidentAddress(suggestion));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusIncidentAddressSuggestion(button, event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Escape') {
        clearIncidentAddressSuggestions();
        incidentAddressInput?.focus();
      }
    });
    incidentAddressSuggestions.append(button);
  });

  const hasSuggestions = incidentAddressSuggestions.childElementCount > 0;
  incidentAddressSuggestions.hidden = !hasSuggestions;
  incidentAddressInput?.setAttribute('aria-expanded', String(hasSuggestions));
}

incidentAddressInput?.addEventListener('input', () => {
  window.clearTimeout(incidentAddressSearchTimer);
  clearIncidentAddressSuggestions();
  const coordinateInput = document.getElementById('incident-coordinates-input');
  if (coordinateInput) coordinateInput.value = '';
  const value = incidentAddressInput.value.trim();
  if (value.length < 3) return;
  incidentAddressSearchTimer = window.setTimeout(() => void searchIncidentAddresses(value), 350);
});

incidentAddressInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') clearIncidentAddressSuggestions();
  if (event.key === 'ArrowDown' && !incidentAddressSuggestions?.hidden) {
    event.preventDefault();
    incidentAddressSuggestions?.querySelector('button')?.focus();
  }
});

document.addEventListener('click', (event) => {
  if (!incidentAddressSuggestions?.contains(event.target) && event.target !== incidentAddressInput) {
    clearIncidentAddressSuggestions();
  }
});

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
    updateActiveIncidentRecord();
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
    const productInput = document.getElementById('incident-product');
    const legacyPlacard = typeof brief['incident-placard'] === 'string' ? brief['incident-placard'].trim() : '';
    if (productInput && legacyPlacard && !productInput.value.includes(legacyPlacard)) {
      productInput.value = [productInput.value.trim(), legacyPlacard].filter(Boolean).join(' / ');
    }
    setIncidentStatus('Saved incident brief restored from this device.');
  } catch {
    // Ignore missing or malformed local-only drafts.
  }
}

function beginNewIncident({ createRecord = false } = {}) {
  incidentWorkflowActive = true;
  incidentBriefFieldIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });
  try {
    window.localStorage.removeItem(incidentBriefStorageKey);
  } catch {
    // A new incident can still begin if browser storage is unavailable.
  }
  setActiveChemical(null);
  const containerSelect = document.getElementById('plume-container-type');
  if (containerSelect) containerSelect.value = 'unknown';
  applyContainerProfile();
  if (createRecord) createIncidentRecord();
  else setSystemMode('training');
  setIncidentStatus('New incident started. Select a chemical to populate HAZMAT COMMAND data.');
}

function resumeActiveIncident() {
  incidentWorkflowActive = true;
  setSystemMode('incident');
  restoreIncidentBrief();
  restoreIncidentContainerData();
  renderIncidentCommandSnapshot();
  void restoreSelectedChemical();
}

document.getElementById('save-incident-brief-btn')?.addEventListener('click', () => {
  const nameInput = document.getElementById('incidentName');
  if (!nameInput?.reportValidity()) {
    setIncidentStatus('Enter an Incident Name before saving.');
    return;
  }
  saveIncidentBrief();
});
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
  updateActiveIncidentRecord();
  setIncidentStatus('Incident brief cleared.');
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
  const na = parseJsonField(chem.na, []) || [];
  const hazardClass = parseJsonField(chem.hazardClass, []) || [];
  const ppe = parseJsonField(chem.ppe, []) || [];
  const firstAid = parseJsonField(chem.firstAid, []) || [];
  const isolation = parseJsonField(chem.isolation, {}) || {};
  const reactivity = parseJsonField(chem.reactivity, []) || [];
  const incompatibilities = parseJsonField(chem.incompatibilities, []) || [];
  const sources = parseJsonField(chem.sources, []) || [];

  const exposureLimits = npg ? parseJsonField(npg.exposureLimits, {}) : {};
  const physical = npg ? parseJsonField(npg.physical, {}) : {};
  const health = npg ? parseJsonField(npg.health, {}) : {};
  const npgPpe = npg ? parseJsonField(npg.ppe, {}) : {};
  const sourceText = sources.map((source) => (typeof source === 'string' ? source : source.source || '')).join(' ');
  const summarySources = [
    npg && 'NIOSH',
    (/ERG/i.test(sourceText) || guideData || ergTable) && 'ERG',
    /CAMEO/i.test(sourceText) && 'CAMEO',
    /Kappler|HazMatch/i.test(sourceText) && 'HazMatch',
  ].filter(Boolean);

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
  const hasContainerDistances = (ergTable?.containerSpecificDistances || []).length > 0;
  const initialIsolation = hasGreenTable
    ? `Small spill — day ${Number(ergTable.smallInitialDayFt).toLocaleString()} ft / night ${Number(ergTable.smallInitialNightFt).toLocaleString()} ft; ${hasContainerDistances ? 'Large spill — select the transport container and wind band in the ERG table below' : `Large spill — day ${Number(ergTable.largeInitialDayFt).toLocaleString()} ft / night ${Number(ergTable.largeInitialNightFt).toLocaleString()} ft`}`
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
    na: na[0] || 'N/A',
    initialIsolation,
    protectiveAction,
    commandFacts: {
      initialIsolation: initialIsolation === 'Not listed in the available ERG data' ? null : initialIsolation,
      protectiveAction: protectiveAction === 'Establish from monitoring and incident conditions.' ? null : protectiveAction,
      isolationSource: hasGreenTable ? 'ERG 2024 Table 1 backend record' : 'ERG/CAMEO backend record',
      idlh: exposureLimits.idlh || null,
    },
    ppeReference: ppe,
    ppeComponents: {
      niosh: {
        skin: npgPpe.skin || [],
        eye: npgPpe.eye || [],
        respiratory: [...(npgPpe.respiratory || []), ...(health.respiratorSelection || [])],
      },
      kappler: [],
    },
    medical: {
      hazards: responderGuide.potentialHazards.health || [],
      symptoms: health.symptoms || [],
      targetOrgans: health.targetOrgans || [],
      firstAid: [...new Set([...(health.firstAid || []), ...firstAid])],
    },
    summarySources,
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

function hasAvailableProfileData(value) {
  if (Array.isArray(value)) return value.some(hasAvailableProfileData);
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return Object.values(value).some(hasAvailableProfileData);
  const text = String(value).trim();
  if (!text) return false;
  if (/^(?:not available|n\/a|not established|null|undefined)(?:\s*[/|·—–-]\s*(?:not available|n\/a|not established|null|undefined))*$/i.test(text)) return false;
  if (/^[^:]+:\s*(?:not available|n\/a|not established|null|undefined)$/i.test(text)) return false;
  if (/^no\s+.+\s+(?:available|record available)$/i.test(text)) return false;
  return true;
}

function profileDisplayParts(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => {
      const text = String(item ?? '').trim();
      if (!text) return [];
      if (text.includes(' · ')) return text.split(/\s*·\s*/);
      if (text.length >= 160) return readableProfileBullets(text);
      return [text];
    })
    .map((item) => item.trim())
    .filter(hasAvailableProfileData);
}

function shouldUseCompactColumns(items) {
  if (!Array.isArray(items) || items.length < 6 || items.some((item) => typeof item !== 'string')) return false;
  const lengths = items.map((item) => item.trim().length);
  const averageLength = lengths.reduce((total, length) => total + length, 0) / lengths.length;
  return Math.max(...lengths) <= 120 && averageLength <= 72;
}

function titleCaseProfileLabel(value) {
  return String(value || '').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function createProfileSection(title, rows, list = false) {
  const section = document.createElement('section');
  section.className = 'chemical-profile-section';
  section.dataset.section = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const heading = document.createElement('h4');
  heading.textContent = titleCaseProfileLabel(title);
  section.append(heading);
  if (list) {
    const items = (Array.isArray(rows) ? rows : [rows]).filter(hasAvailableProfileData);
    if (!items.length) return null;
    const listEl = document.createElement('ul');
    listEl.className = 'chemical-profile-list';
    if (shouldUseCompactColumns(items)) listEl.classList.add('compact-columns');
    items.forEach((item) => {
      const li = document.createElement('li');
      if (item && typeof item === 'object') {
        li.className = 'chemical-profile-list-row';
        li.dataset.field = String(item.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const label = document.createElement('strong');
        label.textContent = titleCaseProfileLabel(item.label);
        const value = document.createElement('span');
        value.textContent = item.value;
        li.append(label, value);
      } else {
        li.textContent = item;
      }
      listEl.append(li);
    });
    section.append(listEl);
  } else {
    const entries = (Array.isArray(rows) ? rows : [rows])
      .filter((entry) => entry && hasAvailableProfileData(entry.value));
    if (!entries.length) return null;
    const grid = document.createElement('div');
    grid.className = 'chemical-profile-grid';
    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'chemical-profile-row';
      row.dataset.field = String(entry.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const label = document.createElement('span');
      label.textContent = titleCaseProfileLabel(entry.label);
      const parts = profileDisplayParts(entry.value);
      const value = parts.length > 1 ? document.createElement('ul') : document.createElement('strong');
      if (parts.length > 1) {
        value.className = 'chemical-profile-value-list';
        if (shouldUseCompactColumns(parts)) value.classList.add('compact-columns');
        parts.forEach((part) => {
          const item = document.createElement('li');
          item.textContent = part;
          value.append(item);
        });
      } else {
        value.textContent = parts[0];
      }
      row.append(label, value);
      grid.append(row);
    });
    section.append(grid);
  }
  return section;
}

function readableProfileBullets(value) {
  const text = String(value || '').trim();
  if (!text || text === 'Not available') return ['Not available'];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])|;\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function monitoringConcernEntries(values) {
  return (Array.isArray(values) ? values : [values]).map((item) => {
    const [rawLabel, ...valueParts] = String(item || '').split(':');
    const label = rawLabel
      .replaceAll('_', ' ')
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
      .replace(/Ppm\b/g, 'ppm')
      .replace(/MgM3\b/g, 'mg/m³')
      .replace(/\bhr\b/gi, ' hr')
      .trim();
    return { key: rawLabel, label, value: valueParts.join(':').trim() || 'Not available' };
  });
}

function createMonitoringConcernSections(values) {
  const entries = monitoringConcernEntries(values);
  const groups = [
    ['Primary Limits', /^(IDLH|REL|PEL|TLV|LOC)/i],
    ['AEGL Levels', /^AEGL/i],
    ['ERPG / TEEL Levels', /^(ERPG|TEEL)/i],
    ['Additional Exposure Levels', /^(MRL|MEG|Toxicity|Median)/i],
  ];
  const assigned = new Set();
  const sections = groups.map(([title, pattern]) => {
    const rows = entries.filter((entry, index) => {
      if (!pattern.test(entry.key)) return false;
      assigned.add(index);
      return true;
    });
    return createProfileSection(title, rows, true);
  });
  const remaining = entries.filter((_, index) => !assigned.has(index));
  sections.push(createProfileSection('Other Monitoring Concerns', remaining, true));
  return sections;
}

function createErgGreenTable(title, headers, rows) {
  if (!rows?.length) return null;
  const section = document.createElement('section');
  section.className = 'chemical-profile-section erg-profile-table';
  const heading = document.createElement('h4');
  heading.textContent = title;
  const wrap = document.createElement('div');
  wrap.className = 'erg-profile-table-wrap';
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  headers.forEach((header) => {
    const cell = document.createElement('th');
    cell.textContent = header;
    headRow.append(cell);
  });
  head.append(headRow);
  const body = document.createElement('tbody');
  rows.forEach((values) => {
    const row = document.createElement('tr');
    values.forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  wrap.append(table);
  section.append(heading, wrap);
  return section;
}

function createErgReferenceTables(isolationErg) {
  const table1 = isolationErg?.ergTable1?.[0];
  const table1Section = table1 ? createErgGreenTable(
    'ERG Green Table 1 — Initial Isolation and Protective Action Distances',
    ['Spill / period', 'Initial isolation', 'Protective action'],
    [
      ['Small spill — day', `${table1.smallInitialDayFt} ft`, `${table1.smallProtectiveDayMi} mi`],
      ['Small spill — night', `${table1.smallInitialNightFt ?? table1.smallInitialDayFt} ft`, `${table1.smallProtectiveNightMi ?? table1.smallProtectiveDayMi} mi`],
      ['Large spill — day', `${table1.largeInitialDayFt} ft`, `${table1.largeProtectiveDayMi} mi`],
      ['Large spill — night', `${table1.largeInitialNightFt ?? table1.largeInitialDayFt} ft`, `${table1.largeProtectiveNightMi ?? table1.largeProtectiveDayMi} mi`],
    ],
  ) : null;
  const table2Rows = (isolationErg?.ergTable2 || []).map((entry) => [entry.title, entry.detail]);
  const table2Section = createErgGreenTable(
    'ERG Green Table 2 — Water-Reactive Toxic Gases',
    ['Reference', 'Response information'],
    table2Rows,
  );
  const table3Rows = (isolationErg?.ergTable3 || []).map((entry) => [
    entry.container,
    `${entry.initialIsolationFt} ft`,
    `${entry.dayLowWindMi} mi`,
    `${entry.dayModerateWindMi} mi`,
    `${entry.dayHighWindMi} mi`,
    `${entry.nightLowWindMi} mi`,
    `${entry.nightModerateWindMi} mi`,
    `${entry.nightHighWindMi} mi`,
  ]);
  const table3Section = createErgGreenTable(
    'ERG Green Table 3 — Large Spill Container Distances',
    ['Container', 'Initial isolation', 'Day low wind', 'Day moderate', 'Day high wind', 'Night low wind', 'Night moderate', 'Night high wind'],
    table3Rows,
  );
  return [table1Section, table2Section, table3Section].filter(Boolean);
}

function renderChemicalProfile(profile) {
  const content = document.getElementById('chemical-profile-content');
  const tabs = document.getElementById('chemical-profile-tabs');
  const meta = document.getElementById('chemical-profile-meta');
  const nameEl = document.getElementById('chemical-name');
  const summaryEl = document.getElementById('chemical-summary');
  if (!content || !tabs || !meta || !nameEl || !summaryEl) return;

  const sections = [
    { key: 'properties', title: 'Properties', render: () => [
      createProfileSection('Chemical Properties', [
        { label: 'Chemical formula', value: profile?.properties?.formula || 'Not available' },
        { label: 'Physical state', value: profile?.properties?.physicalState || 'Not available' },
        { label: 'Molecular weight', value: profile?.properties?.molecularWeight || 'Not available' },
        { label: 'Boiling point', value: profile?.properties?.boilingPoint || 'Not available' },
        { label: 'Melting / freezing point', value: profile?.properties?.meltingPoint || 'Not available' },
        { label: 'Vapor pressure', value: profile?.properties?.vaporPressure || 'Not available' },
        { label: 'Vapor density', value: profile?.properties?.vaporDensity || 'Not available' },
        { label: 'Liquid density', value: profile?.properties?.liquidDensity || 'Not available' },
        { label: 'Specific gravity', value: profile?.properties?.specificGravity || 'Not available' },
        { label: 'Water solubility', value: profile?.properties?.waterSolubility || 'Not available' },
        { label: 'Evaporation rate', value: profile?.properties?.evaporationRate || 'Not available' },
      ]),
      createProfileSection('Flammability & Energy', [
        { label: 'Flash point', value: profile?.properties?.flashPoint || 'Not available' },
        { label: 'Ignition temperature', value: profile?.properties?.ignitionTemperature || 'Not available' },
        { label: 'LEL / UEL', value: profile?.properties?.lelUel || 'Not available' },
        { label: 'Odor threshold', value: profile?.properties?.odorThreshold || 'Not available' },
        { label: 'Ionization potential', value: profile?.properties?.ionizationPotential || 'Not available' },
        { label: 'Decomposition point', value: profile?.properties?.decompositionPoint || 'Not available' },
        { label: 'Heat of vaporization', value: profile?.properties?.heatOfVaporization || 'Not available' },
      ]),
      createProfileSection('Reactivity', readableProfileBullets(profile?.properties?.mixtureReactivity), true),
      createProfileSection('Synonyms & Notes', [
        { label: 'Synonyms', value: profile?.properties?.synonyms || ['Not available'] },
        { label: 'Persistence / environment', value: profile?.properties?.environmentalPersistence || 'Not available' },
        { label: 'Characteristics', value: profile?.properties?.characteristics || ['Not available'] },
        { label: 'Commercial uses', value: profile?.properties?.commercialUses || 'Not available' },
        { label: 'Commercial sources', value: profile?.properties?.commercialSources || 'Not available' },
      ]),
    ] },
    { key: 'exposures', title: 'Exposures', render: () => [
      createProfileSection('EXPOSURE LIMITS', [
        { label: 'IDLH', value: profile?.exposures?.idlh || 'Not available' },
        { label: 'OSHA PEL', value: profile?.exposures?.oshaPel || 'Not available' },
        { label: 'NIOSH REL', value: profile?.exposures?.nioshRel || 'Not available' },
        { label: 'ACGIH TLV', value: profile?.exposures?.acgihTlv || 'Not available' },
      ]),
      createProfileSection('Routes and symptoms', [
        { label: 'Routes of exposure', value: profile?.exposures?.routes || ['Not available'] },
        { label: 'Symptoms', value: profile?.exposures?.symptoms || ['Not available'] },
        { label: 'Target organs', value: profile?.exposures?.targetOrgans || ['Not available'] },
      ]),
      createProfileSection('Acute / Chronic Notes', profile?.exposures?.acuteNotes || ['Not available'], true),
      ...createMonitoringConcernSections(profile?.exposures?.monitoringConcerns || ['Not available']),
    ] },
    { key: 'ppeRespiratory', title: 'PPE / Respiratory Protection', render: () => [
      createProfileSection('Recommended PPE', [
        { label: 'Best Match', value: profile?.ppeRespiratory?.bestMatch || 'Not available' },
      ]),
      createProfileSection('PPE Options', profile?.ppeRespiratory?.recommendedPpe || ['Not available'], true),
      createProfileSection('Glove / Suit Materials', profile?.ppeRespiratory?.gloveSuitMaterial || ['Not available'], true),
      createProfileSection('Respiratory guidance', [
        { label: 'Respirator recommendations', value: (profile?.ppeRespiratory?.respiratorRecommendations || ['Not available']).join(' · ') },
        { label: 'APR / PAPR / SCBA', value: (profile?.ppeRespiratory?.aprPaprScba || ['Not available']).join(' · ') },
        { label: 'Escape respirator', value: (profile?.ppeRespiratory?.escapeRespirator || ['Not available']).join(' · ') },
        { label: 'Cartridge limitations', value: (profile?.ppeRespiratory?.cartridgeLimitations || ['Not available']).join(' · ') },
      ]),
    ] },
    { key: 'detectors', title: 'Detectors', render: () => [
      createProfileSection('Recommended Detector', [
        { label: 'Best Match', value: 'Coming Soon...' },
      ]),
      createProfileSection('Recommended detectors', [
        { label: 'Meters / detectors', value: (profile?.detectors?.items || ['Not available']).join(' · ') },
        { label: 'PID relevance', value: (profile?.detectors?.pidRelevance || ['Not available']).join(' · ') },
        { label: 'LEL relevance', value: (profile?.detectors?.lelMeterRelevance || ['Not available']).join(' · ') },
        { label: 'Colorimetric tubes', value: (profile?.detectors?.colorimetricTubes || ['Not available']).join(' · ') },
      ]),
      createProfileSection('Detection notes', [
        { label: 'Ionization potential', value: profile?.detectors?.ionizationPotential || 'Not available' },
        { label: 'Electrochemical sensors', value: (profile?.detectors?.electrochemicalSensors || ['Not available']).join(' · ') },
        { label: 'Detection limitations', value: (profile?.detectors?.limitations || ['Not available']).join(' · ') },
      ]),
    ] },
    { key: 'reactivity', title: 'Reactivity', render: () => [
      createProfileSection('Reactivity profile', [
        { label: 'Incompatibilities', value: (profile?.reactivity?.incompatibilities || ['Not available']).join(' · ') },
        { label: 'Polymerization risk', value: (profile?.reactivity?.polymerizationRisk || ['Not available']).join(' · ') },
        { label: 'Water reactivity', value: (profile?.reactivity?.waterReactivity || ['Not available']).join(' · ') },
        { label: 'Oxidizer / reducer concerns', value: (profile?.reactivity?.oxidizerReducerConcerns || ['Not available']).join(' · ') },
      ]),
      createProfileSection('Stability and decomposition', [
        { label: 'Decomposition products', value: (profile?.reactivity?.decompositionProducts || ['Not available']).join(' · ') },
        { label: 'Chemical mixture reactivity', value: profile?.reactivity?.chemicalMixtureReactivity || 'Not available' },
        { label: 'Stability notes', value: profile?.reactivity?.stabilityNotes || 'Not available' },
      ]),
    ] },
    { key: 'isolationErg', title: 'Isolation Distance', render: () => {
      const isolationErg = profile?.isolationErg || {};
      const hasGreenTable = Boolean(
        isolationErg.ergTable1?.length
        || isolationErg.ergTable2?.length
        || isolationErg.ergTable3?.length,
      );
      const distanceRows = [
        { label: 'ERG guide number', value: isolationErg.ergGuide || 'Not available' },
        { label: 'Initial isolation distance', value: isolationErg.initialIsolationDistance || 'Not available' },
        ...(!hasGreenTable ? [
          { label: 'Protective action distance', value: isolationErg.protectiveActionDistance || 'Not available' },
          { label: 'Small spill / large spill', value: `${isolationErg.smallSpill || 'Not available'} / ${isolationErg.largeSpill || 'Not available'}` },
          { label: 'Day / night values', value: (isolationErg.dayNightValues || ['Not available']).join(' · ') },
        ] : []),
      ];
      return [
        createProfileSection('Isolation Distances', distanceRows),
        createProfileSection('ERG Notes', [
          { label: 'Note', value: isolationErg.note || 'Not available' },
        ]),
        ...createErgReferenceTables(isolationErg),
      ];
    } },
    { key: 'medical', title: 'Medical Considerations', render: () => [
      createProfileSection('Signs and symptoms', [
        { label: 'Signs / symptoms', value: (profile?.medical?.signsSymptoms || ['Not available']).join(' · ') },
        { label: 'Responders hazards', value: (profile?.medical?.responderHazards || ['Not available']).join(' · ') },
      ]),
      createProfileSection('Treatment', [
        { label: 'First aid', value: (profile?.medical?.firstAid || ['Not available']).join(' · ') },
        { label: 'EMS considerations', value: (profile?.medical?.emsConsiderations || ['Not available']).join(' · ') },
        { label: 'Antidotes', value: (profile?.medical?.antidotes || ['Not available']).join(' · ') },
        { label: 'Treatment notes', value: (profile?.medical?.treatmentNotes || ['Not available']).join(' · ') },
        { label: 'Patient handling', value: (profile?.medical?.contaminatedPatientHandling || ['Not available']).join(' · ') },
      ]),
    ] },
    { key: 'fire', title: 'Fire', render: () => [
      createProfileSection('Fire behavior', [
        { label: 'Flammability', value: profile?.fire?.flammability || 'Not available' },
        { label: 'Flash point', value: profile?.fire?.flashPoint || 'Not available' },
        { label: 'LEL / UEL', value: profile?.fire?.lelUel || 'Not available' },
        { label: 'Extinguishing media', value: (profile?.fire?.extinguishingMedia || ['Not available']).join(' · ') },
      ]),
      createProfileSection('Fire response', [
        { label: 'Firefighting precautions', value: (profile?.fire?.firefightingPrecautions || ['Not available']).join(' · ') },
        { label: 'Vapor behavior', value: (profile?.fire?.vaporBehavior || ['Not available']).join(' · ') },
        { label: 'Explosion hazards', value: (profile?.fire?.explosionHazards || ['Not available']).join(' · ') },
        { label: 'Runoff concerns', value: (profile?.fire?.runoffConcerns || ['Not available']).join(' · ') },
      ]),
    ] },
    { key: 'decon', title: 'DECON', render: () => [
      createProfileSection('Decontamination guidance', [
        { label: 'Preferred method', value: profile?.decon?.preferredMethod || 'Not available' },
        { label: 'Wet vs dry', value: (profile?.decon?.wetVsDry || ['Not available']).join(' · ') },
        { label: 'Water-reactive cautions', value: (profile?.decon?.waterReactiveCautions || ['Not available']).join(' · ') },
      ]),
      createProfileSection('Decon layers', [
        { label: 'Gross decon', value: (profile?.decon?.grossDecon || ['Not available']).join(' · ') },
        { label: 'Technical decon', value: (profile?.decon?.technicalDecon || ['Not available']).join(' · ') },
        { label: 'Patient / victim decon', value: (profile?.decon?.patientVictimDecon || ['Not available']).join(' · ') },
        { label: 'Equipment decon', value: (profile?.decon?.equipmentDecon || ['Not available']).join(' · ') },
        { label: 'Runoff / containment', value: (profile?.decon?.runoffContainment || ['Not available']).join(' · ') },
      ]),
    ] },
  ];

  const tabsList = [
    ['Properties', 'properties'],
    ['Isolation Distance', 'isolationErg'],
    ['Exposures', 'exposures'],
    ['PPE / Respiratory', 'ppeRespiratory'],
    ['Detectors', 'detectors'],
    ['Reactivity', 'reactivity'],
    ['Medical', 'medical'],
    ['Fire', 'fire'],
    ['DECON', 'decon'],
  ];

  nameEl.textContent = profile?.header?.name || 'Select a chemical';
  const summaryParts = [profile?.header?.hazard, profile?.header?.un]
    .filter(hasAvailableProfileData);
  summaryEl.textContent = summaryParts.join(' · ');
  summaryEl.hidden = summaryParts.length === 0;
  meta.innerHTML = '';
  const metaItems = [
    ['CAS', profile?.header?.cas || 'Not available'],
    ['UN/NA', profile?.header?.un || 'Not available'],
    ['ERG', profile?.header?.ergGuide || 'Not available'],
    ['IDLH', profile?.header?.idlh || 'Not available'],
  ];
  metaItems.filter(([, value]) => hasAvailableProfileData(value)).forEach(([label, value]) => {
    const item = document.createElement('span');
    item.className = 'chemical-profile-meta-item';
    item.dataset.field = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const title = document.createElement('strong');
    title.className = 'chemical-profile-meta-title';
    title.textContent = label;
    const contentValue = document.createElement('span');
    contentValue.className = 'chemical-profile-meta-value';
    contentValue.textContent = value;
    item.append(title, contentValue);
    meta.append(item);
  });

  tabs.replaceChildren();
  const tabButtons = tabsList.map(([label, key]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chemical-profile-tab';
    button.dataset.tab = key;
    button.textContent = label;
    button.addEventListener('click', () => {
      renderChemicalProfile({ ...profile, activeTab: key });
    });
    return button;
  });
  tabs.append(...tabButtons);

  const activeKey = profile?.activeTab || 'properties';
  tabs.querySelectorAll('.chemical-profile-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === activeKey);
  });

  const activeSection = sections.find((section) => section.key === activeKey) || sections[0];
  content.dataset.activeTab = activeKey;
  const fragment = document.createDocumentFragment();
  (activeSection.render() || []).filter(Boolean).forEach((element) => fragment.append(element));
  content.replaceChildren(fragment);
  content.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

function updateChemicalCard(record) {
  if (!record) return;
  const profile = record.profile || record;
  renderChemicalProfile(profile);
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
let selectedChemicalId = null;
let activeChemicalRecord = null;
let activePlumeCommand = null;
let activePpeSelection = [];
let activeWeatherCommand = null;
let commandWeatherRequestToken = 0;
let incidentWorkflowActive = false;
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

function renderCommandWeatherRows(rows = []) {
  const container = document.getElementById('command-weather-data');
  if (!container) return;
  container.removeAttribute('aria-label');
  container.replaceChildren(...rows.filter(Boolean).map(({ label, value }) => {
    const row = document.createElement('div');
    row.className = 'command-weather-row';
    const rowLabel = document.createElement('span');
    rowLabel.textContent = `${label} —`;
    const rowValue = document.createElement('strong');
    rowValue.textContent = value;
    row.append(rowLabel, rowValue);
    return row;
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

function isEmergencyContactInstruction(value) {
  return /\b(?:call|dial)\s*9-?1-?1\b|\btelephone\b|\bphone\s+(?:number|the)\b|emergency\s+(?:number|telephone)|number\s+(?:listed|shown)\s+on\s+(?:the\s+)?SDS/i.test(String(value || ''));
}

function correlatePpeSources(sourceRows = []) {
  const rows = requiredPpeConsensusSources.map((sourceId) => {
    const source = sourceRows.find((row) => row.id === sourceId) || { id: sourceId, label: sourceId, items: [] };
    const uniqueItems = [...new Map((source.items || [])
      .filter((item) => !isEmergencyContactInstruction(item))
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

function uniquePpeItems(items = []) {
  return [...new Map(items
    .filter((item) => !isEmergencyContactInstruction(item))
    .map((item) => [normalizePpeRecommendation(item), String(item).trim()])
    .filter(([key]) => key)).values()];
}

function buildPpeStartingReference(record) {
  if (!record) return null;
  const chemicalItems = uniquePpeItems(record.ppeReference || []);
  const niosh = record.ppeComponents?.niosh || {};
  const kappler = uniquePpeItems(record.ppeComponents?.kappler || []);
  const clothing = uniquePpeItems(chemicalItems.filter((item) => /level\s+[a-d]|suit|clothing|splash|encapsulat/i.test(item)));
  const nioshRespiratory = uniquePpeItems(niosh.respiratory || []);
  const chemicalRespiratory = uniquePpeItems(chemicalItems.filter((item) => /scba|respirat|papr|supplied[- ]air|cartridge/i.test(item)));
  const respiratory = uniquePpeItems([...nioshRespiratory, ...chemicalRespiratory]);
  const nioshSkin = uniquePpeItems(niosh.skin || []);
  const chemicalSkin = uniquePpeItems(chemicalItems.filter((item) => /glove|boot|skin/i.test(item)));
  const skin = uniquePpeItems([...nioshSkin, ...chemicalSkin]);
  const nioshEye = uniquePpeItems(niosh.eye || []);
  const chemicalEye = uniquePpeItems(chemicalItems.filter((item) => /goggle|face\s*shield|eye/i.test(item)));
  const eye = uniquePpeItems([...nioshEye, ...chemicalEye]);
  const hasNiosh = nioshRespiratory.length > 0 || nioshSkin.length > 0 || nioshEye.length > 0;
  const levelMatch = clothing.map((item) => item.match(/\bLevel\s+([A-D])\b/i)).find(Boolean);
  const hasScba = respiratory.some((item) => /\bSCBA\b/i.test(item));
  const hasData = chemicalItems.length > 0 || respiratory.length > 0 || skin.length > 0 || eye.length > 0 || kappler.length > 0;
  if (!hasData) return null;

  const levelLabel = levelMatch ? `Level ${levelMatch[1].toUpperCase()}` : 'Suit level not specified';
  const showEyeProtection = eye.length > 0 && !hasScba;
  return {
    title: hasScba ? `${levelLabel} + SCBA` : levelLabel,
    summary: 'Starting PPE recommendation for the identified chemical; confirm suit compatibility in Kappler HazMatch.',
    source: `Sources available: ${hasNiosh ? 'NIOSH NPG' : 'chemical response data'}${kappler.length ? ', Kappler HazMatch' : ''}.`,
    details: [
      clothing.length ? `Protective clothing — ${clothing.join('; ')}` : 'Protective clothing level: not specified.',
      respiratory.length ? `Respiratory — ${respiratory.join('; ')}` : 'Respiratory protection: not specified.',
      skin.length ? `Gloves / boots / skin — ${skin.join('; ')}` : 'Gloves / boots / skin protection: not specified.',
      showEyeProtection ? `Eye / face — ${eye.join('; ')}` : null,
      kappler.length ? `Kappler HazMatch garment match — ${kappler.join('; ')}` : null,
    ].filter(Boolean),
  };
}

function shortGuidance(value) {
  const text = String(value || '').trim();
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function buildIncidentPpeSummary(record) {
  const reference = buildPpeStartingReference(record);
  if (!reference) return null;
  const verifiedDetails = reference.details.filter((detail) => !/not specified|no chemical-specific|not available/i.test(detail));
  const warning = record.responderGuide?.publicSafety?.general?.[0];
  return {
    items: [
      `Recommended PPE: ${reference.title}`,
      ...verifiedDetails.slice(0, 4),
      warning && `Entry warning: ${warning}`,
    ].filter(Boolean).map(shortGuidance),
    sources: record.summarySources,
  };
}

function buildIncidentMedicalSummary(record) {
  const medical = record.medical || {};
  const items = [];
  const hazards = (medical.hazards || []).filter((item) => !/no .*available|no ERG health/i.test(item));
  if (hazards.length) items.push(`Health hazards: ${hazards.slice(0, 2).join('; ')}`);
  if (medical.symptoms?.length) items.push(`Signs/symptoms: ${medical.symptoms.slice(0, 4).join(', ')}`);
  if (medical.targetOrgans?.length) items.push(`Affected systems: ${medical.targetOrgans.slice(0, 4).join(', ')}`);
  if (medical.firstAid?.length) items.push(`First aid: ${medical.firstAid.slice(0, 2).join('; ')}`);
  const decon = medical.firstAid?.find((item) => /decontam|flush|irrigat|contaminated clothing/i.test(item));
  const emsAlert = medical.firstAid?.find((item) => /transport|medical|oxygen|CPR|monitor|observe/i.test(item));
  if (decon) items.push(`Decon: ${decon}`);
  if (emsAlert && emsAlert !== decon) items.push(`EMS alert: ${emsAlert}`);
  return items.length ? { items: items.slice(0, 6).map(shortGuidance), sources: record.summarySources } : null;
}

function saveIncidentGuidance(ppeSummary, medicalSummary, chemicalSources) {
  const activeId = window.localStorage.getItem(activeIncidentIdStorageKey);
  const incidents = readIncidents();
  const index = incidents.findIndex((incident) => incident.incidentId === activeId);
  if (index < 0) return;
  incidents[index] = { ...incidents[index], ppeSummary, medicalSummary, chemicalSources };
  writeIncidents(incidents);
}

function renderGuidanceBox(bodyId, sourceId, summary, fallback) {
  const body = document.getElementById(bodyId);
  const source = document.getElementById(sourceId);
  if (!body || !source) return;
  body.replaceChildren();
  if (summary?.items?.length) {
    const list = document.createElement('ul');
    list.className = 'incident-guidance-list';
    summary.items.forEach((item) => {
      const row = document.createElement('li');
      row.textContent = item;
      list.append(row);
    });
    body.append(list);
  } else {
    body.textContent = fallback;
  }
  source.textContent = summary?.sources?.length ? `Sources: ${summary.sources.join(' / ')}` : '';
  source.hidden = !source.textContent;
}

function isAvailableGuidance(value) {
  return value !== null && value !== undefined && value !== '' && value !== 'N/A' && !/^not /i.test(String(value));
}

function getAdvancedValue(record, label) {
  return new Map(record?.advanced || []).get(label);
}

function buildErgDistanceGuidance(record) {
  const entry = record?.ergTable;
  if (!entry) return [];

  const source = '(Source: ERG / PHMSA)';
  const lines = [
    `ERG Table 1 — Small spill: day isolate ${Number(entry.smallInitialDayFt).toLocaleString()} ft and protect ${Number(entry.smallProtectiveDayMi).toLocaleString()} mi downwind; night isolate ${Number(entry.smallInitialNightFt).toLocaleString()} ft and protect ${Number(entry.smallProtectiveNightMi).toLocaleString()} mi downwind. ${source}`,
  ];
  const containerRows = entry.containerSpecificDistances || [];
  if (containerRows.length) {
    containerRows.forEach((distance) => {
      lines.push(
        `ERG Table 3 — ${distance.container}: isolate ${Number(distance.initialIsolationFt).toLocaleString()} ft; protect downwind by wind speed (low / moderate / high) — day ${distance.dayLowWindMi} / ${distance.dayModerateWindMi} / ${distance.dayHighWindMi} mi, night ${distance.nightLowWindMi} / ${distance.nightModerateWindMi} / ${distance.nightHighWindMi} mi. ${source}`,
      );
    });
    if (containerRows.some((distance) => Object.values(distance).some((value) => String(value).includes('+')))) {
      lines.push(`ERG Table 3 — Distances marked “+” may be larger under certain atmospheric conditions. ${source}`);
    }
  } else {
    lines.push(
      `ERG Table 1 — Large spill: day isolate ${Number(entry.largeInitialDayFt).toLocaleString()} ft and protect ${Number(entry.largeProtectiveDayMi).toLocaleString()} mi downwind; night isolate ${Number(entry.largeInitialNightFt).toLocaleString()} ft and protect ${Number(entry.largeProtectiveNightMi).toLocaleString()} mi downwind. ${source}`,
    );
  }
  (entry.additionalTables || []).forEach((item) => {
    lines.push(`ERG Table ${item.table} — ${item.detail} ${source}`);
  });
  return lines;
}

function buildProtectiveActionGuidance() {
  const record = activeChemicalRecord;
  const guidance = {
    recommendation: [],
    cameoAloha: [],
    niosh: [],
    oshaNote: 'Shelter-in-place or evacuation actions should follow local incident command, AHJ, and emergency management direction. OSHA workplace guidance emphasizes planning for evacuation, shelter, accountability, and following local emergency response authority instructions.',
  };
  if (!record) return guidance;

  if (record.ergTable) {
    guidance.recommendation.push(...buildErgDistanceGuidance(record));
  } else {
    if (isAvailableGuidance(record.commandFacts?.initialIsolation)) {
      guidance.recommendation.push(`Initial isolation — ${record.commandFacts.initialIsolation} (Source: ERG / PHMSA)`);
    }
    if (isAvailableGuidance(record.commandFacts?.protectiveAction)) {
      guidance.recommendation.push(`Protective action distance — ${record.commandFacts.protectiveAction} (Source: ERG / PHMSA)`);
    }
  }

  const zone = currentThreatZoneGeoJson?.features?.[0]?.properties;
  const zoneSource = /ALOHA|MARPLOT/i.test(activePlumeCommand?.source || zone?.source || '') ? 'ALOHA' : 'EPA / NOAA CAMEO';
  if (activePlumeCommand) {
    guidance.cameoAloha.push(`Model result summary — ${activePlumeCommand.summary} (Source: ${zoneSource})`);
  }
  if (zone?.label) guidance.cameoAloha.push(`Threat zone type — ${zone.label} (Source: ${zoneSource})`);
  if (zone?.thresholdKind || zone?.thresholdLevel) {
    guidance.cameoAloha.push(`Toxic endpoint / AEGL level — ${[zone.thresholdKind, zone.thresholdLevel].filter(Boolean).join(' ')} (Source: ${zoneSource})`);
  }
  if (Number.isFinite(Number(zone?.maxDownwindM))) {
    guidance.cameoAloha.push(`Downwind threat distance — ${formatZoneDistance(zone.maxDownwindM)} (Source: ${zoneSource})`);
  }

  const exposureLimits = [
    isAvailableGuidance(record.idlh) && `IDLH — ${record.idlh}`,
    isAvailableGuidance(getAdvancedValue(record, 'NIOSH REL')) && `NIOSH REL — ${getAdvancedValue(record, 'NIOSH REL')}`,
    isAvailableGuidance(getAdvancedValue(record, 'OSHA PEL')) && `OSHA PEL — ${getAdvancedValue(record, 'OSHA PEL')}`,
  ].filter(Boolean);
  if (exposureLimits.length) guidance.niosh.push(`${exposureLimits.join('; ')} (Source: NIOSH)`);
  return guidance;
}

function appendGuidanceSection(container, title, items, fallback) {
  const section = document.createElement('li');
  section.append(Object.assign(document.createElement('strong'), { textContent: title }));
  const list = document.createElement('ul');
  (items.length ? items : [fallback]).forEach((text) => {
    const row = document.createElement('li');
    row.textContent = text;
    list.append(row);
  });
  section.append(list);
  container.append(section);
}

function renderProtectiveActionGuidance(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.replaceChildren();
  const guidance = buildProtectiveActionGuidance();
  const list = document.createElement('ul');
  list.className = 'incident-guidance-list';
  appendGuidanceSection(
    list,
    'Recommended Protective Action',
    guidance.recommendation,
    activeChemical ? 'No Current Data Exists' : 'Select a chemical and run the plume model to populate protective action guidance.',
  );
  if (guidance.cameoAloha.length) {
    appendGuidanceSection(list, 'EPA / NOAA CAMEO / ALOHA', guidance.cameoAloha, '');
  }
  if (guidance.niosh.length) {
    appendGuidanceSection(list, 'NIOSH Exposure Limits', guidance.niosh, '');
  }
  target.append(...(target.tagName === 'UL' ? [...list.children] : [list]));
}

function renderIncidentGuidance() {
  const enteredChemical = document.getElementById('incident-product')?.value.trim();
  const hasSelectedChemical = activeChemical && enteredChemical === activeChemical.name;
  if (!hasSelectedChemical) {
    renderGuidanceBox('incident-ppe-guidance', 'incident-ppe-sources', null, 'Select or identify a chemical to populate PPE guidance.');
    renderGuidanceBox('incident-medical-guidance', 'incident-medical-sources', null, 'Select or identify a chemical to populate medical guidance.');
    renderProtectiveActionGuidance('incident-protective-guidance');
    return;
  }
  if (!activeChemicalRecord) {
    renderGuidanceBox('incident-ppe-guidance', 'incident-ppe-sources', null, 'No verified PPE guidance available for this chemical.');
    renderGuidanceBox('incident-medical-guidance', 'incident-medical-sources', null, 'No verified medical guidance available for this chemical.');
    renderProtectiveActionGuidance('incident-protective-guidance');
    return;
  }
  const ppeSummary = buildIncidentPpeSummary(activeChemicalRecord);
  const medicalSummary = buildIncidentMedicalSummary(activeChemicalRecord);
  renderGuidanceBox('incident-ppe-guidance', 'incident-ppe-sources', ppeSummary, 'No verified PPE guidance available for this chemical.');
  renderGuidanceBox('incident-medical-guidance', 'incident-medical-sources', medicalSummary, 'No verified medical guidance available for this chemical.');
  renderProtectiveActionGuidance('incident-protective-guidance');

  saveIncidentGuidance(ppeSummary, medicalSummary, activeChemicalRecord.summarySources);
}

function renderIncidentCommandSnapshot() {
  const chemicalLoaded = Boolean(activeChemical);
  if (!chemicalLoaded) {
    [
      'command-chemical-status',
      'command-chemical-name',
      'command-chemical-summary',
      'command-plume-status',
      'command-plume-title',
      'command-plume-summary',
      'command-ppe-status',
      'command-ppe-title',
      'command-ppe-summary',
      'command-protective-status',
    ].forEach((id) => setText(id, ''));
    ['command-chemical-details', 'command-plume-details', 'command-ppe-details'].forEach((id) => {
      document.getElementById(id)?.replaceChildren();
    });
    renderProtectiveActionGuidance('command-protective-guidance');
  } else {
    const recordLoaded = Boolean(activeChemicalRecord);
    const commandFacts = activeChemicalRecord?.commandFacts;
    setText('command-chemical-status', recordLoaded ? 'Backend record' : 'Loading data');
    setText('command-chemical-name', activeChemical.name);
    setText('command-chemical-summary', recordLoaded
      ? `UN ${activeChemicalRecord.un} · ERG ${activeChemicalRecord.ergGuide} · IDLH ${activeChemicalRecord.idlh}`
      : 'Loading ERG, CAMEO, and NIOSH records…');
    replaceCommandList('command-chemical-details', recordLoaded ? [
      commandFacts?.initialIsolation ? `Initial isolation: ${commandFacts.initialIsolation}` : 'Initial isolation: not available in the loaded backend record.',
      commandFacts?.protectiveAction ? `Protective action: ${commandFacts.protectiveAction}` : 'Protective action: not available in the loaded backend record.',
      commandFacts?.idlh ? `NIOSH IDLH: ${commandFacts.idlh}` : 'NIOSH IDLH: not available in the loaded backend record.',
      `DOT class: ${activeChemicalRecord.dotClass}`,
    ] : [], 'Loading chemical data…');

    setText('command-plume-status', activePlumeCommand ? 'Backend result' : 'Not plotted');
    setText('command-plume-title', activePlumeCommand?.title || 'No active plume');
    setText('command-plume-summary', activePlumeCommand?.summary || 'Confirm the release and weather inputs before plotting.');
    replaceCommandList('command-plume-details', activePlumeCommand?.details || [], 'No plume model has been plotted.');
    setText('command-protective-status', activeChemicalRecord ? 'Loaded' : 'Awaiting data');
    renderProtectiveActionGuidance('command-protective-guidance');

    const ppeCorrelation = correlatePpeSources(activeChemicalRecord?.ppeSources || []);
    const startingPpe = buildPpeStartingReference(activeChemicalRecord);
    const hasPpeSelection = activePpeSelection.length > 0;
    const hasConsensus = ppeCorrelation.unanimous && ppeCorrelation.selection.length > 0;
    const coverage = `${ppeCorrelation.available.length}/${requiredPpeConsensusSources.length} sources`;
    setText('command-ppe-status', hasConsensus ? 'All sources match' : (hasPpeSelection ? 'Operator entered' : (startingPpe ? 'Starting reference' : coverage)));
    setText('command-ppe-title', hasConsensus
      ? ppeCorrelation.selection.join(' · ')
      : (hasPpeSelection ? activePpeSelection.join(' · ') : (startingPpe?.title || 'No PPE reference available')));
    setText('command-ppe-summary', hasConsensus
      ? 'Strict text match across every required backend source.'
      : (hasPpeSelection
        ? 'Operator-entered selection; the backend does not currently prove full source agreement.'
        : (startingPpe?.summary || 'No source-attributed PPE guidance is available for this chemical.')));
    const correlatedDetails = hasConsensus
      ? ppeCorrelation.selection.map((item) => `${item} — all required sources`)
      : (hasPpeSelection
        ? [
          ...activePpeSelection.map((item) => `${item} — operator entered`),
          ...(startingPpe?.details || []),
        ]
        : (startingPpe?.details || ppeCorrelation.groupedItems.map((group) => `${group.text} — ${group.sources.join(', ')}`))).slice(0, 8);
    replaceCommandList('command-ppe-details', correlatedDetails, 'No source-attributed PPE guidance loaded.');
  }

  setText('command-weather-status', activeWeatherCommand ? 'Live' : 'Awaiting location');
  renderCommandWeatherRows(activeWeatherCommand?.rows || []);
  replaceCommandList('command-weather-details', activeWeatherCommand?.details || [], 'No live weather data loaded.');
  renderIncidentGuidance();
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
    setText('plume-input-status', '');
  } else {
    const mode = hasActiveIncident() ? 'active incident' : 'planning session';
    setText('plume-input-status', `${activeChemical.name} is linked to the ${mode}. Confirm the release and weather inputs.`);
  }
}

function setActiveChemical(chemical, { persist = true, clearOverlay = true } = {}) {
  const nextSelectedChemicalId = chemical?.selectedChemicalId ?? chemical?.ChemicalID ?? chemical?.id ?? null;
  const changed = String(selectedChemicalId ?? '') !== String(nextSelectedChemicalId ?? '');
  if (changed) {
    activeChemicalRecord = null;
    activePlumeCommand = null;
    activePpeSelection = [];
  }
  selectedChemicalId = nextSelectedChemicalId;
  activeChemical = chemical ? {
    id: String(nextSelectedChemicalId),
    selectedChemicalId: nextSelectedChemicalId,
    name: chemical.ChemicalName || chemical.name,
  } : null;
  const incidentProductInput = document.getElementById('incident-product');
  if (incidentProductInput) incidentProductInput.value = activeChemical?.name || '';
  if (persist) {
    try {
      if (hasActiveIncident()) {
        if (activeChemical) window.localStorage.setItem(selectedChemicalStorageKey, JSON.stringify(activeChemical));
        else window.localStorage.removeItem(selectedChemicalStorageKey);
      } else {
        window.localStorage.removeItem(selectedChemicalStorageKey);
        savePlanningState({ selectedChemical: activeChemical, updatedAt: new Date().toISOString() });
      }
    } catch {
      // Chemical selection remains available for the current session.
    }
  }
  if (changed && clearOverlay) {
    importedPlumeOverlay = null;
    void clearThreatZones(activeChemical
      ? 'Chemical changed. Confirm inputs and select Plot Plume.'
      : 'Identify a chemical before plotting a plume.');
    setText('backend-model-summary', 'Run plume model to view result.');
  }
  syncPlumeChemicalSelection();
  if (changed) applyChemicalContainerProfile();
  renderIncidentCommandSnapshot();
  if (activeChemical) updateActiveIncidentRecord();
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
      const profileResponse = await fetchJson(`/api/chemicals/${encodeURIComponent(saved.selectedChemicalId ?? saved.id)}/profile`);
      const profile = profileResponse && !profileResponse.error ? profileResponse : null;
      const combinedRecord = profile ? { ...record, profile: { ...profile, activeTab: 'properties' }, name: record.name } : record;
      if (activeChemical?.id === chemical.id) {
        activeChemicalRecord = combinedRecord;
        applyChemicalContainerProfile();
        restoreIncidentContainerData();
        updateActiveIncidentRecord();
        renderIncidentCommandSnapshot();
      }
    } else syncPlumeChemicalSelection();
  } catch {
    syncPlumeChemicalSelection();
  }
}

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
  const chosenChemicalId = chemical.selectedChemicalId ?? chemical.ChemicalID ?? chemical.id;
  const chosenChemicalName = chemical.ChemicalName || chemical.name;
  console.info('[chemical-companion] selection', {
    selectedChemicalId: chosenChemicalId,
    ChemicalName: chosenChemicalName,
  });
  latestChemicalSearch += 1;
  window.clearTimeout(chemicalSearchTimer);
  setChemicalSearchStatus(`Loading ${chemical.name || 'chemical'}…`, 'loading');
  const record = await buildFullChemicalRecord(chemical);
  if (String(selectedChemicalId) === String(chosenChemicalId)) {
    activeChemicalRecord = record;
    applyChemicalContainerProfile();
    updateActiveIncidentRecord();
    renderIncidentCommandSnapshot();
  }
  const profileResponse = await fetchJson(`/api/chemicals/${encodeURIComponent(chosenChemicalId)}/profile`);
  const profile = profileResponse && !profileResponse.error ? profileResponse : null;
  const combinedRecord = profile ? { ...record, profile: { ...profile, activeTab: 'properties' }, name: record.name } : record;
  activeChemicalRecord = combinedRecord;
  updateActiveIncidentRecord();
  renderIncidentCommandSnapshot();
  updateChemicalCard(combinedRecord);
  if (chemicalIdResults) chemicalIdResults.hidden = false;
  setChemicalSearchStatus('');
  chemicalIdResults?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function companionChemicalForUi(row) {
  const selectedId = row?.ChemicalID;
  return {
    ...row,
    id: String(selectedId),
    selectedChemicalId: selectedId,
    name: row?.ChemicalName,
    cas: JSON.stringify(row?.CasNumber && row.CasNumber !== 'Not available' ? [row.CasNumber] : []),
    un: JSON.stringify(row?.UnnaNumber && row.UnnaNumber !== 'Not available' ? [row.UnnaNumber] : []),
    ergGuide: row?.ErgNumber,
    hazardClass: JSON.stringify([]),
  };
}

async function openChemicalById(chemicalId, facilityName = '') {
  const chemical = await fetchJson(`/api/chemicals/${encodeURIComponent(chemicalId)}`);
  if (!chemical || chemical.error) {
    setChemicalSearchStatus('Chemical details are not available for this facility submission.', 'error');
    return;
  }
  await openChemical(chemical, facilityName);
}

const myChemicalsStorageKey = 'hazmatiq_my_chemicals';

// Saved chemicals stay local until account storage is added.
function readSavedChemicals() {
  try {
    const chemicals = JSON.parse(window.localStorage.getItem(myChemicalsStorageKey) || '[]');
    return Array.isArray(chemicals) ? chemicals : [];
  } catch {
    return [];
  }
}

function saveCurrentChemical() {
  if (!activeChemical || !activeChemicalRecord) return;
  const advanced = Object.fromEntries(activeChemicalRecord.advanced || []);
  const savedChemical = {
    chemicalId: activeChemical.id,
    chemicalName: activeChemicalRecord.name,
    casNumber: advanced.CAS === 'N/A' ? '' : advanced.CAS || '',
    unNumber: activeChemicalRecord.un !== 'N/A' ? activeChemicalRecord.un : (activeChemicalRecord.na === 'N/A' ? '' : activeChemicalRecord.na),
    ergGuide: activeChemicalRecord.ergGuide === 'N/A' ? '' : activeChemicalRecord.ergGuide,
    savedAt: new Date().toISOString(),
  };
  const chemicals = readSavedChemicals().sort((a, b) =>
    String(a.chemicalName || '').localeCompare(String(b.chemicalName || '')));
  const duplicateIndex = chemicals.findIndex((chemical) =>
    (savedChemical.casNumber && chemical.casNumber === savedChemical.casNumber)
    || (savedChemical.unNumber && chemical.unNumber === savedChemical.unNumber)
    || chemical.chemicalName?.toLowerCase() === savedChemical.chemicalName.toLowerCase());
  if (duplicateIndex >= 0) chemicals[duplicateIndex] = savedChemical;
  else chemicals.unshift(savedChemical);
  window.localStorage.setItem(myChemicalsStorageKey, JSON.stringify(chemicals));
  setChemicalSearchStatus(`${savedChemical.chemicalName} saved to My Chemicals.`, 'success');
}

function renderSavedChemicals() {
  const list = document.getElementById('my-chemicals-list');
  if (!list) return;
  list.replaceChildren();
  const chemicals = readSavedChemicals().sort((a, b) =>
    String(a.chemicalName || '').localeCompare(String(b.chemicalName || '')));
  if (!chemicals.length) {
    list.textContent = 'No saved chemicals yet. Use Chemical ID and click “Save to My Chemicals.”';
    return;
  }
  chemicals.forEach((chemical) => {
    const card = document.createElement('article');
    card.className = 'facility-chemical-btn';
    const name = document.createElement('strong');
    name.textContent = chemical.chemicalName;
    const details = document.createElement('span');
    const savedAt = chemical.savedAt ? new Date(chemical.savedAt).toLocaleString() : '';
    details.textContent = [
      chemical.casNumber && `CAS ${chemical.casNumber}`,
      chemical.unNumber && `UN/NA ${chemical.unNumber}`,
      chemical.ergGuide && `ERG ${chemical.ergGuide}`,
      savedAt && `Saved ${savedAt}`,
    ].filter(Boolean).join(' · ');
    const openButton = document.createElement('button');
    openButton.className = 'ghost-btn';
    openButton.type = 'button';
    openButton.textContent = 'Open Chemical';
    openButton.addEventListener('click', async () => {
      showView('lookup');
      if (chemicalSearchInput) chemicalSearchInput.value = chemical.chemicalName;
      await openChemicalById(chemical.chemicalId);
    });
    card.append(name, details, openButton);
    list.append(card);
  });
}

document.getElementById('save-my-chemical-btn')?.addEventListener('click', saveCurrentChemical);

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
  console.info('[chemical-companion] search query', chemicalQuery);
  const [chemicalData, facilityData] = await Promise.all([
    fetchJson(`/api/chemicals/search?q=${encodeURIComponent(chemicalQuery)}`),
    fetchJson(`/api/facilities?q=${encodeURIComponent(rawQuery)}`),
  ]);
  if (requestId !== latestChemicalSearch) return;

  const chemicals = (chemicalData?.chemicals || []).map(companionChemicalForUi);
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
      [un && `UN ${un}`, cas && `CAS ${cas}`, chemical.matchReason].filter(Boolean).join(' · ') || 'Chemical reference',
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

const incidentProductInput = document.getElementById('incident-product');
const incidentProductSuggestions = document.getElementById('incident-product-suggestions');
let incidentProductSearchTimer = null;
let latestIncidentProductSearch = 0;

function clearIncidentProductSuggestions() {
  if (!incidentProductSuggestions) return;
  incidentProductSuggestions.replaceChildren();
  incidentProductSuggestions.hidden = true;
  incidentProductInput?.setAttribute('aria-expanded', 'false');
}

async function selectIncidentProduct(chemical) {
  latestIncidentProductSearch += 1;
  clearIncidentProductSuggestions();
  setActiveChemical(chemical);
  setIncidentStatus(`Loading ${chemical.name}…`);
  const record = await buildFullChemicalRecord(chemical);
  const profileResponse = await fetchJson(`/api/chemicals/${encodeURIComponent(chemical.selectedChemicalId ?? chemical.id)}/profile`);
  const profile = profileResponse && !profileResponse.error ? profileResponse : null;
  const combinedRecord = profile ? { ...record, profile: { ...profile, activeTab: 'properties' }, name: record.name } : record;
  if (activeChemical?.id !== chemical.id) return;
  activeChemicalRecord = combinedRecord;
  applyChemicalContainerProfile();
  updateActiveIncidentRecord();
  renderIncidentCommandSnapshot();
  setIncidentStatus(`${chemical.name} selected for the active incident.`);
}

async function searchIncidentProducts(value) {
  const requestId = ++latestIncidentProductSearch;
  const data = await fetchJson(`/api/chemicals/search?q=${encodeURIComponent(normalizeChemicalQuery(value))}`);
  if (requestId !== latestIncidentProductSearch || !incidentProductSuggestions) return;
  incidentProductSuggestions.replaceChildren();
  (data?.chemicals || []).map(companionChemicalForUi).slice(0, 8).forEach((chemical) => {
    const un = parseJsonField(chemical.un, [])?.[0];
    const cas = parseJsonField(chemical.cas, [])?.[0];
    incidentProductSuggestions.append(createSuggestion(
      'Chemical',
      chemical.name,
      [un && `UN ${un}`, cas && `CAS ${cas}`].filter(Boolean).join(' · ') || 'Chemical reference',
      () => void selectIncidentProduct(chemical),
    ));
  });
  const hasSuggestions = incidentProductSuggestions.childElementCount > 0;
  incidentProductSuggestions.hidden = !hasSuggestions;
  incidentProductInput?.setAttribute('aria-expanded', String(hasSuggestions));
}

incidentProductInput?.addEventListener('input', () => {
  window.clearTimeout(incidentProductSearchTimer);
  latestIncidentProductSearch += 1;
  clearIncidentProductSuggestions();
  saveIncidentGuidance(null, null, []);
  renderIncidentGuidance();
  const query = incidentProductInput.value.trim();
  if (query.length < 2) return;
  incidentProductSearchTimer = window.setTimeout(() => void searchIncidentProducts(query), 200);
});

incidentProductInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') clearIncidentProductSuggestions();
  if (event.key === 'ArrowDown' && !incidentProductSuggestions?.hidden) {
    event.preventDefault();
    incidentProductSuggestions?.querySelector('button')?.focus();
  }
});

document.addEventListener('click', (event) => {
  if (!incidentProductSuggestions?.contains(event.target) && event.target !== incidentProductInput) {
    clearIncidentProductSuggestions();
  }
});

let plumeRefreshToken = 0;
let plumeMap = null;
let plumeMapReady = null;
let plumeSourceMarker = null;
let importedPlumeOverlay = null;
let currentThreatZoneGeoJson = null;
let currentThreatZoneGuideGeoJson = null;
let currentPlumeHazardsGeoJson = null;
let currentPlumeHazardsSignature = '';
let plumeDistanceMarkers = [];
const plumeHazardsCacheKey = 'hazmatiq_plume_hazards_cache';
const plumeLayerState = { centerline: false, distance: false, hazards: false };
const plumeLayerIds = {
  centerline: ['hazmat-threat-zone-centerline', 'hazmat-threat-zone-wind-arrow'],
  distance: ['hazmat-threat-zone-distance-line', 'hazmat-threat-zone-distance-ticks', 'hazmat-threat-zone-distance-points', 'hazmat-threat-zone-distance-labels'],
  hazards: ['hazmat-plume-hazards-points', 'hazmat-plume-hazards-labels'],
};
let threatZoneInteractionBound = false;
let demographicsRequestToken = 0;
let latestPlumeWeather = null;
document.querySelector('.plume-map-layout')?.append(document.getElementById('plume-demographics'));
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
let activePlumeMapView = 'satellite';
let activePlumeMapStyleKey = plumeMapViews.satellite.styleKey;
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
  if (hasActiveIncident()) saveIncidentBrief({ quiet: true });
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
      preserveDrawingBuffer: true,
    });
    plumeMap.addControl(new window.maplibregl.NavigationControl(), 'bottom-right');
    plumeMap.scrollZoom.disable();
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
    // Basemap style changes remove custom sources and layers; restore the saved plume overlays.
    plumeMap.on('style.load', () => {
      if (currentThreatZoneGeoJson?.features?.length) addThreatZoneLayers();
      if (plumeLayerState.hazards && currentPlumeHazardsGeoJson) addPlumeHazardsLayers(currentPlumeHazardsGeoJson);
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
  const validZones = (result?.isopleths || []).filter((zone) => zone.polygon?.length >= 2 && Number(zone.thresholdLevel) >= 1);
  const fallbackThresholdKind = ['AEGL', 'ERPG', 'TEEL'].reduce((preferredKind, kind) => {
    const levelCount = new Set(validZones.filter((zone) => zone.thresholdKind === kind).map((zone) => zone.thresholdLevel)).size;
    const preferredLevelCount = new Set(validZones.filter((zone) => zone.thresholdKind === preferredKind).map((zone) => zone.thresholdLevel)).size;
    return levelCount > preferredLevelCount ? kind : preferredKind;
  }, 'AEGL');
  const thresholdKind = validZones.some((zone) => zone.thresholdKind === 'AEGL') ? 'AEGL' : fallbackThresholdKind;
  const preferredZones = thresholdKind ? validZones.filter((zone) => zone.thresholdKind === thresholdKind) : validZones;
  const uniqueZones = [...preferredZones.reduce((zonesByLevel, zone) => {
    const threatRank = Math.max(1, Math.min(3, Number(zone.thresholdLevel) || 1));
    if (!zonesByLevel.has(threatRank)) zonesByLevel.set(threatRank, zone);
    return zonesByLevel;
  }, new Map()).values()];
  return {
    type: 'FeatureCollection',
    features: uniqueZones.map((zone, index) => {
      const releasePoint = [origin.lon, origin.lat];
      const coordinates = [releasePoint, ...zone.polygon.map((point) => localMetersToLngLat(point, origin, result.inputs.windDirDeg))];
      coordinates.push(releasePoint);
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
          windFromDeg: result.inputs.windDirDeg,
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
    nwr["power"~"^(plant|substation|generator)$"](poly:"${polygon}");
    nwr["man_made"~"^(water_works|wastewater_plant|communications_tower)$"](poly:"${polygon}");
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
  const commercialBuildings = new Set(['commercial', 'retail', 'office', 'industrial', 'warehouse', 'hotel']);
  const educationAmenities = new Set(['school', 'kindergarten', 'childcare', 'college', 'university']);
  const healthcareAmenities = new Set(['hospital', 'clinic', 'doctors']);
  const nursingAmenities = new Set(['nursing_home', 'social_facility']);
  const criticalAmenities = new Set(['fire_station', 'police', 'shelter']);
  const highOccupancyAmenities = new Set(['community_centre', 'place_of_worship', 'prison']);

  const commercial = elements.filter((element) => commercialBuildings.has(element.tags?.building)
    || commercialBuildings.has(element.tags?.['building:use']) || element.tags?.shop || element.tags?.office);
  const education = elements.filter((element) => educationAmenities.has(element.tags?.amenity));
  const healthcare = elements.filter((element) => healthcareAmenities.has(element.tags?.amenity));
  const nursing = elements.filter((element) => nursingAmenities.has(element.tags?.amenity));
  const critical = elements.filter((element) => criticalAmenities.has(element.tags?.amenity)
    || element.tags?.power || element.tags?.man_made);
  const highOccupancy = elements.filter((element) => highOccupancyAmenities.has(element.tags?.amenity)
    || element.tags?.tourism === 'hotel' || ['stadium', 'sports_centre'].includes(element.tags?.leisure));

  const describe = (label, rows) => {
    if (!rows.length) return [];
    const names = [...new Set(rows.map(getMappedFeatureName).filter(Boolean))].slice(0, 3);
    return [`${label}: ${names.length ? names.join(', ') : `${rows.length} mapped site${rows.length === 1 ? '' : 's'}`}`];
  };
  return {
    businesses: commercial.length,
    education: education.length,
    healthcare: healthcare.length,
    nursing: nursing.length,
    critical: critical.length,
    priorities: [
      ...describe('Schools / daycare', education),
      ...describe('Healthcare facilities', healthcare),
      ...describe('Nursing / assisted living', nursing),
      ...describe('Critical infrastructure', critical),
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
  ['population', 'housing', 'schools', 'healthcare', 'nursing', 'critical', 'businesses']
    .forEach((metric) => setDemographicMetric(`demographics-${metric}`, '—'));
  renderProtectiveActionGuidance('demographics-priority-list');
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
  ['population', 'housing', 'schools', 'healthcare', 'nursing', 'critical', 'businesses']
    .forEach((metric) => setDemographicMetric(`demographics-${metric}`, '…'));
  setText('demographics-source-status', 'Loading U.S. Census and OpenStreetMap planning data…');
  renderProtectiveActionGuidance('demographics-priority-list');
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
  setDemographicMetric('demographics-schools', occupancy ? occupancy.education.toLocaleString() : 'Unavailable');
  setDemographicMetric('demographics-healthcare', occupancy ? occupancy.healthcare.toLocaleString() : 'Unavailable');
  setDemographicMetric('demographics-nursing', occupancy ? occupancy.nursing.toLocaleString() : 'Unavailable');
  setDemographicMetric('demographics-critical', occupancy ? occupancy.critical.toLocaleString() : 'Unavailable');
  setDemographicMetric('demographics-businesses', occupancy ? occupancy.businesses.toLocaleString() : 'Unavailable');

  renderProtectiveActionGuidance('demographics-priority-list');
  const sources = [
    census ? `2020 Census: ${census.blocks} intersecting block${census.blocks === 1 ? '' : 's'} (planning upper bound)` : 'Census unavailable',
    occupancy ? 'OpenStreetMap mapped features' : 'OpenStreetMap occupancy lookup unavailable',
  ];
  setText('demographics-source-status', `${sources.join(' · ')}. ACS 2020–2024 block-group estimates are the preferred demographic refinement. Verify evacuation counts through dispatch and field reconnaissance.`);
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
          colorName: threatZoneColorNames[threatRank],
          color: threatZoneColors[threatRank],
        },
      };
    }),
  };
  resetDemographics();
  addThreatZoneLayers();
  if (plumeLayerState.hazards) void showPlumeHazards();
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

function buildThreatZoneGuides() {
  const zones = currentThreatZoneGeoJson?.features || [];
  const longest = zones
    .filter((zone) => zone.properties?.thresholdKind === 'AEGL' && Number(zone.properties?.thresholdLevel) === 1)
    .sort((a, b) => Number(b.properties?.maxDownwindM || 0) - Number(a.properties?.maxDownwindM || 0))[0];
  const maxDistance = Number(longest?.properties?.maxDownwindM);
  const windFromDeg = Number(longest?.properties?.windFromDeg);
  const origin = plumeSourceMarker?.getLngLat();
  if (!origin || !Number.isFinite(maxDistance) || !Number.isFinite(windFromDeg)) {
    return { type: 'FeatureCollection', features: [] };
  }

  const start = [origin.lng, origin.lat];
  const end = localMetersToLngLat([maxDistance, 0], origin, windFromDeg);
  const features = [{
    type: 'Feature',
    properties: { guideType: 'centerline' },
    geometry: { type: 'LineString', coordinates: [start, end] },
  }];
  [0.25, 0.5, 1, 1.5, 2].filter((miles) => miles * 1609.344 <= maxDistance).forEach((miles) => {
    const distance = miles * 1609.344;
    features.push({
      type: 'Feature',
      properties: { guideType: 'distanceTick' },
      geometry: {
        type: 'LineString',
        coordinates: [
          localMetersToLngLat([distance, -12], origin, windFromDeg),
          localMetersToLngLat([distance, 12], origin, windFromDeg),
        ],
      },
    });
    features.push({
      type: 'Feature',
      properties: { guideType: 'distance', label: `${miles < 1 ? miles : miles.toFixed(1)} mi` },
      geometry: { type: 'Point', coordinates: localMetersToLngLat([distance, 0], origin, windFromDeg) },
    });
  });
  features.push({
    type: 'Feature',
    properties: { guideType: 'wind', rotation: (windFromDeg + 180) % 360 },
    geometry: { type: 'Point', coordinates: localMetersToLngLat([maxDistance * 0.14, 0], origin, windFromDeg) },
  });
  return { type: 'FeatureCollection', features };
}

function addOptionalPlumeGuideLayer(layer) {
  if (plumeMap.getLayer(layer.id)) return;
  try {
    plumeMap.addLayer(layer);
  } catch (error) {
    console.warn(`Optional plume guide ${layer.id} could not be displayed.`, error);
  }
}

function setPlumeLayerVisibility(layerName, visible) {
  (plumeLayerIds[layerName] || []).forEach((id) => {
    if (plumeMap?.getLayer(id)) plumeMap.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  });
  if (layerName === 'distance') syncDistanceDomMarkers();
}

function syncDistanceDomMarkers() {
  plumeDistanceMarkers.forEach((marker) => marker.remove());
  plumeDistanceMarkers = [];
  if (!plumeMap || !plumeLayerState.distance || activePlumeMapView !== 'satellite') return;
  (currentThreatZoneGuideGeoJson?.features || [])
    .filter((feature) => feature.properties?.guideType === 'distance')
    .forEach((feature) => {
      const label = document.createElement('span');
      label.className = 'plume-distance-label';
      label.textContent = feature.properties.label;
      plumeDistanceMarkers.push(new window.maplibregl.Marker({ element: label, anchor: 'bottom' })
        .setLngLat(feature.geometry.coordinates).addTo(plumeMap));
    });
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
        'fill-opacity': 0.2,
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
      id: 'hazmat-threat-zones-border',
      type: 'line',
      source: 'hazmat-threat-zones',
      paint: {
        'line-color': '#17202a',
        'line-width': 6,
        'line-opacity': 0.62,
      },
    });
    plumeMap.addLayer({
      id: 'hazmat-threat-zones-outline',
      type: 'line',
      source: 'hazmat-threat-zones',
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#d71920'],
        'line-width': 3,
      },
    });
  }

  currentThreatZoneGuideGeoJson = buildThreatZoneGuides();
  const guideSource = plumeMap.getSource('hazmat-threat-zone-guides');
  if (guideSource) {
    guideSource.setData(currentThreatZoneGuideGeoJson);
  } else {
    plumeMap.addSource('hazmat-threat-zone-guides', { type: 'geojson', data: currentThreatZoneGuideGeoJson });
  }
  addOptionalPlumeGuideLayer({
    id: 'hazmat-threat-zone-centerline',
    type: 'line',
    source: 'hazmat-threat-zone-guides',
    filter: ['==', ['get', 'guideType'], 'centerline'],
    layout: { visibility: plumeLayerState.centerline ? 'visible' : 'none' },
    paint: {
      'line-color': '#17202a',
      'line-width': 3,
      'line-dasharray': [3, 2],
    },
  });
  addOptionalPlumeGuideLayer({
    id: 'hazmat-threat-zone-distance-line',
    type: 'line',
    source: 'hazmat-threat-zone-guides',
    filter: ['==', ['get', 'guideType'], 'centerline'],
    layout: { visibility: plumeLayerState.distance ? 'visible' : 'none' },
    paint: {
      'line-color': '#fff',
      'line-width': 1.5,
      'line-opacity': 0.9,
      'line-dasharray': [4, 2],
    },
  });
  addOptionalPlumeGuideLayer({
    id: 'hazmat-threat-zone-distance-ticks',
    type: 'line',
    source: 'hazmat-threat-zone-guides',
    filter: ['==', ['get', 'guideType'], 'distanceTick'],
    layout: { visibility: plumeLayerState.distance ? 'visible' : 'none' },
    paint: {
      'line-color': '#fff',
      'line-width': 3,
      'line-opacity': 0.95,
    },
  });
  addOptionalPlumeGuideLayer({
    id: 'hazmat-threat-zone-distance-points',
    type: 'circle',
    source: 'hazmat-threat-zone-guides',
    filter: ['==', ['get', 'guideType'], 'distance'],
    layout: { visibility: plumeLayerState.distance ? 'visible' : 'none' },
    paint: {
      'circle-radius': 4,
      'circle-color': '#fff',
      'circle-stroke-color': '#17202a',
      'circle-stroke-width': 2,
    },
  });
  syncDistanceDomMarkers();
  // The raster-only satellite style has no font atlas; keep text annotations on street styles.
  if (activePlumeMapView === 'satellite') return;
  addOptionalPlumeGuideLayer({
    id: 'hazmat-threat-zone-distance-labels',
    type: 'symbol',
    source: 'hazmat-threat-zone-guides',
    filter: ['==', ['get', 'guideType'], 'distance'],
    layout: {
      visibility: plumeLayerState.distance ? 'visible' : 'none',
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-offset': [0, 1.2],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#17202a',
      'text-halo-color': '#fff',
      'text-halo-width': 2,
    },
  });
  addOptionalPlumeGuideLayer({
    id: 'hazmat-threat-zone-wind-arrow',
    type: 'symbol',
    source: 'hazmat-threat-zone-guides',
    filter: ['==', ['get', 'guideType'], 'wind'],
    layout: {
      visibility: plumeLayerState.centerline ? 'visible' : 'none',
      'text-field': '➤',
      'text-size': 26,
      'text-rotate': ['get', 'rotation'],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#17202a',
      'text-halo-color': '#fff',
      'text-halo-width': 1.5,
    },
  });
}

function getPlumeHazardsBounds() {
  if (!currentThreatZoneGeoJson?.features?.length || !plumeSourceMarker) return null;
  const bounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  forEachCoordinate(currentThreatZoneGeoJson, ([lon, lat]) => {
    bounds.west = Math.min(bounds.west, lon);
    bounds.south = Math.min(bounds.south, lat);
    bounds.east = Math.max(bounds.east, lon);
    bounds.north = Math.max(bounds.north, lat);
  });
  const source = plumeSourceMarker.getLngLat();
  if (!Object.values(bounds).every(Number.isFinite)) return null;
  return {
    ...bounds,
    signature: [source.lng, source.lat, bounds.west, bounds.south, bounds.east, bounds.north]
      .map((value) => value.toFixed(5)).join('|'),
  };
}

function addPlumeHazardsLayers(geojson) {
  if (!plumeMap || !geojson) return;
  const source = plumeMap.getSource('hazmat-plume-hazards');
  if (source) source.setData(geojson);
  else plumeMap.addSource('hazmat-plume-hazards', { type: 'geojson', data: geojson });
  addOptionalPlumeGuideLayer({
    id: 'hazmat-plume-hazards-points',
    type: 'circle',
    source: 'hazmat-plume-hazards',
    layout: { visibility: plumeLayerState.hazards ? 'visible' : 'none' },
    paint: {
      'circle-radius': 5,
      'circle-color': '#f05a28',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });
  if (activePlumeMapView !== 'satellite') {
    addOptionalPlumeGuideLayer({
      id: 'hazmat-plume-hazards-labels',
      type: 'symbol',
      source: 'hazmat-plume-hazards',
      layout: {
        visibility: plumeLayerState.hazards ? 'visible' : 'none',
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 1.1],
      },
      paint: {
        'text-color': '#17202a',
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });
  }
}

async function showPlumeHazards() {
  const bounds = getPlumeHazardsBounds();
  if (!bounds) {
    setText('plume-layers-status', 'Hazards unavailable until plume bounds or release point are available.');
    return false;
  }
  let cached = null;
  try {
    cached = JSON.parse(window.localStorage.getItem(plumeHazardsCacheKey) || 'null');
  } catch {
    // Continue without cached hazards.
  }
  if (currentPlumeHazardsSignature === bounds.signature && currentPlumeHazardsGeoJson) {
    // Reuse the current in-memory hazards.
  } else if (cached?.signature === bounds.signature && cached.geojson) {
    currentPlumeHazardsGeoJson = cached.geojson;
    currentPlumeHazardsSignature = cached.signature;
  } else {
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    const query = `[out:json][timeout:25];(nwr["name"]["amenity"](${bbox});nwr["name"]["shop"](${bbox});nwr["name"]["office"](${bbox});nwr["name"]["power"](${bbox});nwr["name"]["industrial"](${bbox}););out center tags;`;
    const data = await fetchExternalJson('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ data: query }),
    });
    currentPlumeHazardsGeoJson = {
      type: 'FeatureCollection',
      features: (data?.elements || []).flatMap((element, index) => {
        const lon = element.lon ?? element.center?.lon;
        const lat = element.lat ?? element.center?.lat;
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || !element.tags?.name) return [];
        return [{
          type: 'Feature', id: index,
          properties: { name: element.tags.name },
          geometry: { type: 'Point', coordinates: [lon, lat] },
        }];
      }),
    };
    currentPlumeHazardsSignature = bounds.signature;
    try {
      window.localStorage.setItem(plumeHazardsCacheKey, JSON.stringify({ signature: bounds.signature, geojson: currentPlumeHazardsGeoJson }));
    } catch {
      // The in-memory cache still prevents repeat calls this session.
    }
  }
  addPlumeHazardsLayers(currentPlumeHazardsGeoJson);
  setPlumeLayerVisibility('hazards', true);
  setText('plume-layers-status', 'Hazards loaded from OpenStreetMap/Overpass.');
  return true;
}

async function setPlumeMapView(viewName) {
  const view = plumeMapViews[viewName];
  if (!view) return;
  const activeZones = currentThreatZoneGeoJson;
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
  currentThreatZoneGeoJson = activeZones;
  addThreatZoneLayers();
  if (plumeLayerState.hazards && currentPlumeHazardsGeoJson) addPlumeHazardsLayers(currentPlumeHazardsGeoJson);

  const camera = { pitch: view.pitch, bearing: view.bearing, duration: 500 };
  if (view.minZoom) camera.zoom = Math.max(plumeMap.getZoom(), view.minZoom);
  if (activeZones?.features?.length) {
    const bounds = new window.maplibregl.LngLatBounds();
    forEachCoordinate(activeZones, (coordinate) => bounds.extend(coordinate));
    if (!bounds.isEmpty()) plumeMap.fitBounds(bounds, { padding: 70, maxZoom: 15, pitch: view.pitch, bearing: view.bearing, duration: 400 });
    const legend = document.getElementById('plume-map-legend');
    if (legend) legend.hidden = false;
  } else {
    plumeMap.easeTo(camera);
  }
}

async function clearThreatZones(message = '') {
  if (plumeMap && plumeMapReady) {
    await plumeMapReady;
    const source = plumeMap.getSource('hazmat-threat-zones');
    if (source) source.setData({ type: 'FeatureCollection', features: [] });
    const guideSource = plumeMap.getSource('hazmat-threat-zone-guides');
    if (guideSource) guideSource.setData({ type: 'FeatureCollection', features: [] });
  }
  currentThreatZoneGeoJson = null;
  currentThreatZoneGuideGeoJson = null;
  syncDistanceDomMarkers();
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
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure',
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
  for (const feature of stations?.features?.slice(0, 8) || []) {
    const station = feature?.properties;
    if (!station?.stationIdentifier) continue;
    const observation = await fetchJson(`https://api.weather.gov/stations/${encodeURIComponent(station.stationIdentifier)}/observations/latest?refresh=${Date.now()}`);
    const values = observation?.properties;
    const complete = typeof values?.temperature?.value === 'number' && Number.isFinite(values.temperature.value)
      && typeof values?.windSpeed?.value === 'number' && Number.isFinite(values.windSpeed.value) && values.windSpeed.value > 0
      && typeof values?.windDirection?.value === 'number' && Number.isFinite(values.windDirection.value);
    if (complete) {
      return { office: points.properties.gridId, station, observation: values };
    }
  }
  return null;
}

async function fetchWeatherSources(lat, lon) {
  const proxyQuery = new URLSearchParams({ lat: String(lat), lon: String(lon), refresh: String(Date.now()) });
  const proxy = await fetchJson(`/api/weather/current?${proxyQuery}`);
  if (proxy?.openMeteo || proxy?.nws) {
    return {
      openMeteo: formatOpenMeteo(proxy.openMeteo),
      nws: formatNws(proxy.nws),
    };
  }
  const [openMeteoResult, nwsResult] = await Promise.allSettled([
    fetchOpenMeteo(lat, lon),
    fetchNwsObservation(lat, lon),
  ]);
  return {
    openMeteo: formatOpenMeteo(openMeteoResult.status === 'fulfilled' ? openMeteoResult.value : null),
    nws: formatNws(nwsResult.status === 'fulfilled' ? nwsResult.value : null),
  };
}

async function refreshNotificationWeather({ lat, lon }) {
  notificationWeatherLocation = { lat, lon };
  const { openMeteo, nws } = await fetchWeatherSources(lat, lon);
  updateNotificationCenter({ weather: openMeteo?.conditions || nws?.conditions || 'Live weather unavailable' });
}

function formatOpenMeteo(data) {
  if (!data?.current) return null;
  const current = data.current;
  const temperatureF = Number(current.temperature_2m);
  const feelsLikeF = Number(current.apparent_temperature);
  const windSpeedMph = Number(current.wind_speed_10m);
  const pressureInHg = Number(current.surface_pressure) * 0.0295299830714;
  const elevationMeters = Number(data.elevation);
  const elevationFt = Number.isFinite(elevationMeters) ? Math.round(elevationMeters * 3.28084) : null;
  const feelsLike = Number.isFinite(feelsLikeF) ? ` · Feels Like ${feelsLikeF.toFixed(1)}°F` : '';
  return {
    location: `${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)}${elevationFt === null ? '' : ` · ${elevationFt.toLocaleString()} ft`} · ${data.timezone || 'local time'}`,
    elevationFt,
    conditions: `${current.temperature_2m}°F${feelsLike} · RH ${current.relative_humidity_2m}% · Wind ${current.wind_speed_10m} mph ${degreesToCompass(current.wind_direction_10m)} · Gust ${current.wind_gusts_10m} mph · Pressure ${pressureInHg.toFixed(2)} inHg`,
    temperatureF,
    feelsLikeF: Number.isFinite(feelsLikeF) ? feelsLikeF : null,
    temperatureC: (temperatureF - 32) * (5 / 9),
    windSpeedMph,
    windSpeedMps: windSpeedMph * 0.44704,
    windDirDeg: Number(current.wind_direction_10m),
    gustMph: Number(current.wind_gusts_10m),
    rh: Number(current.relative_humidity_2m),
    precipitationIn: Number(current.precipitation),
    pressureInHg,
    observedAt: current.time,
  };
}

function formatNws(data) {
  if (!data?.observation) return null;
  const observation = data.observation;
  const tempC = observation.temperature?.value;
  const windMps = observation.windSpeed?.value;
  const gustMps = observation.windGust?.value;
  const temperatureF = Number.isFinite(tempC) ? (tempC * 9) / 5 + 32 : null;
  const heatIndexC = observation.heatIndex?.value;
  const windChillC = observation.windChill?.value;
  const apparentC = Number.isFinite(heatIndexC) ? heatIndexC : windChillC;
  const feelsLikeF = Number.isFinite(apparentC) ? (apparentC * 9) / 5 + 32 : null;
  const windSpeedMph = Number.isFinite(windMps) ? windMps * 2.23694 : null;
  const gustMph = Number.isFinite(gustMps) ? gustMps * 2.23694 : null;
  const tempF = Number.isFinite(tempC) ? `${((tempC * 9) / 5 + 32).toFixed(1)}°F` : 'temperature unavailable';
  const feelsLike = Number.isFinite(feelsLikeF) ? ` · Feels Like ${feelsLikeF.toFixed(1)}°F` : '';
  const wind = Number.isFinite(windMps) ? `${(windMps * 2.23694).toFixed(1)} mph` : 'wind unavailable';
  return {
    station: `NWS ${data.office === 'BMX' ? 'Birmingham (BMX)' : data.office || 'office'} · ${data.station.stationIdentifier} ${data.station.name || ''}`.trim(),
    displayStation: `${data.station.stationIdentifier} · ${data.station.name || 'NWS weather station'}`,
    conditions: `${tempF}${feelsLike} · ${observation.textDescription || 'No description'} · Wind ${wind} ${degreesToCompass(observation.windDirection?.value)}`,
    observedAt: observation.timestamp,
    temperatureF,
    feelsLikeF,
    windSpeedMph,
    windDirDeg: Number(observation.windDirection?.value),
    gustMph,
    description: observation.textDescription || 'No description',
  };
}

function updateCommandWeatherState(openMeteo, nws, location) {
  if (!openMeteo && !nws) {
    activeWeatherCommand = null;
    renderIncidentCommandSnapshot();
    return;
  }
  const retrievedAt = new Date();
  const displayNumber = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : 'Unavailable';
  const compactNumber = (value, digits = 1) => value !== null && value !== '' && Number.isFinite(Number(value))
    ? Number(value).toFixed(digits).replace(/\.0$/, '')
    : 'Unavailable';
  activeWeatherCommand = openMeteo ? {
    rows: [
      { label: 'Temperature', value: `${compactNumber(openMeteo.temperatureF)}°F` },
      { label: 'Feels Like', value: `${compactNumber(openMeteo.feelsLikeF)}°F` },
      { label: 'Wind', value: `${compactNumber(openMeteo.windSpeedMph)} mph ${degreesToCompass(openMeteo.windDirDeg)}` },
      { label: 'Gust', value: `${compactNumber(openMeteo.gustMph)} mph` },
      { label: 'Humidity', value: `${compactNumber(openMeteo.rh, 0)}%` },
      { label: 'Pressure', value: `${compactNumber(openMeteo.pressureInHg, 2)} inHg` },
      { label: 'Precipitation', value: `${compactNumber(openMeteo.precipitationIn, 2)} in` },
    ],
    source: `Source: Open-Meteo current conditions used by Plume Modeling · retrieved ${retrievedAt.toLocaleTimeString()}.`,
    details: [
      `Incident coordinates: ${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`,
      `Open-Meteo observation time: ${openMeteo.observedAt || 'not provided'}`,
      `Precipitation: ${displayNumber(openMeteo.precipitationIn, 2)} in`,
      nws ? `${nws.station}: ${nws.conditions}` : 'NWS station observation unavailable.',
    ],
  } : {
    rows: [
      { label: 'Temperature', value: `${compactNumber(nws.temperatureF)}°F` },
      Number.isFinite(nws.feelsLikeF) ? { label: 'Feels Like', value: `${compactNumber(nws.feelsLikeF)}°F` } : null,
      { label: 'Conditions', value: nws.description },
      { label: 'Wind', value: `${compactNumber(nws.windSpeedMph)} mph ${degreesToCompass(nws.windDirDeg)}` },
      Number.isFinite(nws.gustMph) ? { label: 'Gust', value: `${compactNumber(nws.gustMph)} mph` } : null,
    ],
    source: `Source: ${nws.station} · retrieved ${retrievedAt.toLocaleTimeString()}.`,
    details: [
      `Incident coordinates: ${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`,
      `NWS observation time: ${nws.observedAt || 'not provided'}`,
    ],
  };
  renderIncidentCommandSnapshot();
  updateActiveIncidentRecord();
}

async function refreshCommandWeather({ requestGps = false } = {}) {
  const token = ++commandWeatherRequestToken;
  setText('command-weather-status', 'Loading');
  let location;
  try {
    location = await getIncidentCoordinates({ requestGps });
  } catch (error) {
    if (token !== commandWeatherRequestToken) return;
    activeWeatherCommand = null;
    renderIncidentCommandSnapshot();
    setText('command-weather-status', 'Location needed');
    document.getElementById('command-weather-data')?.setAttribute('aria-label', error instanceof Error ? error.message : 'Incident location is required.');
    return;
  }
  if (!location) {
    if (token !== commandWeatherRequestToken) return;
    activeWeatherCommand = null;
    renderIncidentCommandSnapshot();
    setText('command-weather-status', 'Location needed');
    return;
  }

  const { openMeteo, nws } = await fetchWeatherSources(location.lat, location.lon);
  if (token !== commandWeatherRequestToken) return;
  latestPlumeWeather = openMeteo;
  updateCommandWeatherState(openMeteo, nws, location);
  setText('open-meteo-location', openMeteo?.location || 'Open-Meteo unavailable');
  setText('open-meteo-conditions', openMeteo?.conditions || 'Open-Meteo unavailable');
  setText('nws-station-summary', nws?.station || 'NWS observation station unavailable');
  setText('nws-weather-summary', nws?.conditions || 'NWS live observation unavailable');
  setText('nws-observation-summary', nws?.observedAt || 'Observation time unavailable');
  updateNotificationCenter({ weather: openMeteo?.conditions || nws?.conditions || 'Live weather unavailable' });
}

function setPlumeInputValue(id, value) {
  const input = document.getElementById(id);
  if (input && Number.isFinite(Number(value))) input.value = String(value);
}

function applyLiveWeatherToPlumeInputs(weather) {
  if (!weather) return false;
  setPlumeInputValue('plume-wind-speed', Number(weather.windSpeedMph).toFixed(1));
  const compassBearing = Math.round(Number(weather.windDirDeg) / 45) % 8 * 45;
  setPlumeInputValue('plume-wind-direction', compassBearing);
  setPlumeInputValue('plume-temperature', Number(weather.temperatureF).toFixed(1));
  return true;
}

function selectPlumeWeather(openMeteo, nws) {
  const isReading = (value) => value !== null && value !== '' && Number.isFinite(Number(value));
  const isComplete = (weather) => weather
    && isReading(weather.temperatureF)
    && isReading(weather.windSpeedMph) && Number(weather.windSpeedMph) > 0
    && isReading(weather.windDirDeg);
  const observationAge = (weather) => Date.now() - Date.parse(weather?.observedAt || '');
  const nwsIsCurrent = isComplete(nws) && observationAge(nws) >= 0 && observationAge(nws) <= 2 * 60 * 60 * 1000;
  if (nwsIsCurrent) return { ...nws, source: nws.station || 'National Weather Service' };
  if (isComplete(openMeteo)) return { ...openMeteo, source: 'Open-Meteo current conditions', displayStation: 'Open-Meteo' };
  if (isComplete(nws)) return { ...nws, source: nws.station || 'National Weather Service' };
  return null;
}

// Operational planning defaults. Exact chemical profiles win; otherwise the
// chemical's UN number, hazard class, name, and likely phase select a family.
const containerProfiles = [
  { id: 'unknown', label: 'Unknown / Custom', sizes: ['User identified'], capacityDefault: '', typicalRange: '', possibleRange: '', pressureProfile: 'Unknown / verify', pressureNormal: 'Unknown; verify container markings', pressureRange: 'User verified', pressureUnit: 'psig' },
  { id: 'dot-406', label: 'DOT-406 / MC-306 cargo tank', sizes: ['Cargo tank trailer / transport', 'Compartmented cargo tank'], defaultSize: '8500', sizeUnit: 'gal', capacityDefault: '8,500 gal', typicalRange: '6,000–9,500 gal', possibleRange: 'Verify specification and compartments', pressureProfile: 'Atmospheric / non-pressure', pressureNormal: 'Near atmospheric; vented', pressureRange: 'Usually not pressure-driven', pressureUnit: 'psig' },
  { id: 'dot-407', label: 'DOT-407 / MC-307 cargo tank', sizes: ['Cargo tank trailer / transport'], defaultSize: '6500', sizeUnit: 'gal', capacityDefault: '6,500 gal', typicalRange: '5,000–7,500 gal', possibleRange: 'Verify specification plate', pressureProfile: 'Low-pressure liquid cargo tank', pressureNormal: 'Low pressure; transfer dependent', pressureRange: 'Commonly under 40 psig unless verified', pressureUnit: 'psig' },
  { id: 'dot-412', label: 'DOT-412 / MC-312 corrosive cargo tank', sizes: ['Corrosive cargo tank trailer'], defaultSize: '5500', sizeUnit: 'gal', capacityDefault: '5,500 gal', typicalRange: '4,000–7,000 gal', possibleRange: 'Verify product compatibility', pressureProfile: 'Low-pressure liquid cargo tank', pressureNormal: 'Low pressure; product/transfer dependent', pressureRange: 'Verify specification plate', pressureUnit: 'psig' },
  { id: 'mc-331', label: 'MC-331 pressure cargo tank', sizes: ['Cargo tank trailer / transport', 'Bobtail / small cargo tank'], defaultSize: '10000', sizeUnit: 'gal', capacityDefault: '10,000 water gal', typicalRange: '8,000–12,000 water gal', possibleRange: '3,500–15,000 water gal', pressureProfile: 'Liquefied compressed gas / vapor-pressure governed', pressureNormal: 'Chemical and temperature dependent', pressureRange: 'Use vapor pressure; operator override', pressureUnit: 'psig' },
  { id: 'mc-338', label: 'MC-338 cryogenic cargo tank', sizes: ['Cryogenic cargo tank trailer'], defaultSize: '7000', sizeUnit: 'gal', capacityDefault: '7,000 gal', typicalRange: '4,000–11,000 gal', possibleRange: 'Verify tank data plate', pressureProfile: 'Cryogenic refrigerated liquid', pressureNormal: 'Low-to-moderate cryogenic tank pressure', pressureRange: 'Product-specific; verify', pressureUnit: 'psig' },
  { id: 'tube-trailer', label: 'Tube trailer / compressed gas trailer', sizes: ['Tube trailer / cylinder bundle'], capacityDefault: 'Tube trailer / cylinder bundle', typicalRange: 'Configuration-specific', possibleRange: 'Verify tube count and water volume', pressureProfile: 'High-pressure compressed gas', pressureNormal: 'High pressure; verify service pressure', pressureRange: 'Broad product/container-specific range', pressureUnit: 'psig' },
  { id: 'ton-cylinder', label: 'Ton cylinder', sizes: ['Single ton cylinder', 'Multiple ton cylinders'], defaultSize: '2000', sizeUnit: 'lb', capacityDefault: '2,000 lb', typicalRange: '1 ton nominal', possibleRange: 'Single or multiple containers', pressureProfile: 'Liquefied compressed gas / vapor-pressure governed', pressureNormal: 'Product-temperature dependent', pressureRange: 'Use vapor pressure; verify', pressureUnit: 'psig' },
  { id: '150lb-cylinder', label: '150-lb cylinder', sizes: ['Single 150-lb cylinder', 'Multiple small cylinders'], defaultSize: '150', sizeUnit: 'lb', capacityDefault: '150 lb', typicalRange: '150 lb nominal', possibleRange: 'Single or multiple cylinders', pressureProfile: 'Liquefied compressed gas / vapor-pressure governed', pressureNormal: 'Product-temperature dependent', pressureRange: 'Verify cylinder and temperature', pressureUnit: 'psig' },
  { id: 'nurse-tank', label: 'Agricultural nurse tank', sizes: ['1,000 gal nurse tank', '1,500 gal nurse tank', '2,000 gal nurse tank'], defaultSize: '1000', sizeUnit: 'gal', capacityDefault: '1,000 gal', typicalRange: '1,000–1,500 gal', possibleRange: 'Up to 2,000 gal', pressureProfile: 'Liquefied compressed gas / vapor-pressure governed', pressureNormal: 'Chemical-temperature dependent', pressureRange: 'Use vapor pressure; verify', pressureUnit: 'psig' },
  { id: 'rail-pressure', label: 'Rail pressure tank car', sizes: ['Rail pressure tank car'], defaultSize: '20000', sizeUnit: 'gal', capacityDefault: '20,000 gal planning value', typicalRange: '10,000–33,500 gal', possibleRange: 'Commodity and car dependent', pressureProfile: 'Liquefied compressed gas / vapor-pressure governed', pressureNormal: 'Product-temperature dependent', pressureRange: 'Verify consist and car markings', pressureUnit: 'psig' },
  { id: 'rail-nonpressure', label: 'Rail non-pressure tank car', sizes: ['General service rail tank car'], defaultSize: '25000', sizeUnit: 'gal', capacityDefault: '25,000 gal', typicalRange: '20,000–30,000 gal', possibleRange: 'Car and commodity dependent', pressureProfile: 'Low-pressure liquid cargo tank', pressureNormal: 'Atmospheric or low pressure', pressureRange: 'Verify car markings', pressureUnit: 'psig' },
  { id: 'ibc', label: 'IBC tote', sizes: ['275 gal tote', '330 gal tote'], defaultSize: '275', sizeUnit: 'gal', capacityDefault: '275 gal', typicalRange: '275–330 gal', possibleRange: 'Verify UN marking', pressureProfile: 'Atmospheric / non-pressure', pressureNormal: 'Near atmospheric', pressureRange: 'Not pressure-driven', pressureUnit: 'psig' },
  { id: 'drum', label: 'Drum', sizes: ['55 gal liquid drum', 'Smaller package drum'], defaultSize: '55', sizeUnit: 'gal', capacityDefault: '55 gal', typicalRange: '55 gal liquid drum', possibleRange: 'Package-specific', pressureProfile: 'Atmospheric / non-pressure', pressureNormal: 'Near atmospheric', pressureRange: 'Not pressure-driven unless marked', pressureUnit: 'psig' },
  { id: 'portable-tank', label: 'Portable tank / ISO tank', sizes: ['20-ft ISO tank', 'Portable bulk tank'], defaultSize: '5500', sizeUnit: 'gal', capacityDefault: '5,500 gal', typicalRange: '5,000–6,600 gal', possibleRange: 'Tank instruction/commodity dependent', pressureProfile: 'Low-pressure liquid cargo tank', pressureNormal: 'Tank and commodity dependent', pressureRange: 'Verify data plate', pressureUnit: 'psig' },
  { id: 'compressed-cylinder', label: 'Compressed gas cylinder', sizes: ['Single cylinder', 'Cylinder bundle'], capacityDefault: 'Cylinder-specific', typicalRange: 'Verify marked water volume/service pressure', possibleRange: 'Single or multiple cylinders', pressureProfile: 'High-pressure compressed gas', pressureNormal: 'High pressure; marked service pressure', pressureRange: 'Verify cylinder marking', pressureUnit: 'psig' },
  { id: 'cryogenic-cylinder', label: 'Cryogenic cylinder', sizes: ['Cryogenic liquid cylinder'], capacityDefault: 'Cylinder-specific', typicalRange: 'Verify marked capacity', possibleRange: 'Single or multiple cylinders', pressureProfile: 'Cryogenic refrigerated liquid', pressureNormal: 'Relief-protected cryogenic pressure', pressureRange: 'Product-specific; verify', pressureUnit: 'psig' },
  { id: 'solid-package', label: 'Drum / bag / supersack / bulk package', sizes: ['Drum', 'Bag', 'Supersack', 'Box', 'Hopper / bulk package'], capacityDefault: 'Package-specific', typicalRange: 'Verify package marking', possibleRange: 'Small package through bulk package', pressureProfile: 'Atmospheric / non-pressure', pressureNormal: 'Non-pressure solid/package', pressureRange: 'Not pressure-driven', pressureUnit: 'psig' },
  { id: 'fixed-tank', label: 'Stationary pressure vessel', sizes: ['Facility-specific fixed tank'], capacityDefault: 'Facility-specific', typicalRange: 'Use facility inventory', possibleRange: 'Verify tank data', pressureProfile: 'Liquefied compressed gas / vapor-pressure governed', pressureNormal: 'Process/product dependent', pressureRange: 'Verify facility records', pressureUnit: 'psig' },
].map((profile) => {
  // Broad conditions guide responders without inventing an exact pressure.
  const pressureConditionByType = {
    'dot-406': 'Low pressure / product transfer',
    'dot-407': 'Low pressure / product transfer',
    'dot-412': 'Low pressure / product transfer',
    'mc-331': 'Liquefied compressed gas',
    'mc-338': 'Cryogenic / refrigerated liquid',
    'ton-cylinder': 'Liquefied compressed gas',
    '150lb-cylinder': 'Liquefied compressed gas',
    'nurse-tank': 'Liquefied compressed gas',
    'ibc': 'Atmospheric / open container',
    'drum': 'Atmospheric / open container',
    'compressed-cylinder': 'Compressed gas',
    'cryogenic-cylinder': 'Cryogenic / refrigerated liquid',
    'solid-package': 'Atmospheric / open container',
  };
  const pressureCondition = pressureConditionByType[profile.id] || 'Unknown / verify';
  return {
    ...profile,
    pressureCondition,
    pressureConfidence: 'Planning default',
    modelSourceType: profile.id === 'unknown'
      ? 'Auto-select'
      : profile.id === 'solid-package' ? 'Solid release' : 'Tank',
    pressureNote: pressureCondition === 'Unknown / verify'
      ? 'Verify pressure behavior from container or facility information.'
      : 'Planning assumption based on the selected container type.',
  };
});

const profileById = (id) => containerProfiles.find((item) => item.id === id) || containerProfiles[0];
const chemicalContainerOverrides = {
  '1005': { defaultId: 'mc-331', ids: ['mc-331', 'nurse-tank', 'rail-pressure', 'fixed-tank'] },
  '1017': { defaultId: 'ton-cylinder', ids: ['ton-cylinder', '150lb-cylinder', 'rail-pressure'] },
  '1075': { defaultId: 'mc-331', ids: ['mc-331', 'rail-pressure', 'fixed-tank'] },
  '1203': { defaultId: 'dot-406', ids: ['dot-406', 'rail-nonpressure', 'drum'] },
  '1202': { defaultId: 'dot-406', ids: ['dot-406', 'rail-nonpressure', 'drum'] },
  '1823': { defaultId: 'dot-412', ids: ['dot-412', 'ibc', 'drum', 'rail-nonpressure'] },
  '1824': { defaultId: 'dot-412', ids: ['dot-412', 'ibc', 'drum', 'rail-nonpressure'] },
  '1830': { defaultId: 'dot-412', ids: ['dot-412', 'rail-nonpressure', 'ibc', 'drum'] },
  '1789': { defaultId: 'dot-412', ids: ['dot-412', 'ibc', 'drum', 'rail-nonpressure'] },
  '2031': { defaultId: 'dot-412', ids: ['dot-412', 'ibc', 'drum', 'rail-nonpressure'] },
  '1170': { defaultId: 'dot-406', ids: ['dot-406', 'dot-407', 'rail-nonpressure', 'drum', 'ibc'] },
  '1230': { defaultId: 'dot-407', ids: ['dot-407', 'dot-406', 'rail-nonpressure', 'drum', 'ibc'] },
  '1049': { defaultId: 'tube-trailer', ids: ['tube-trailer', 'compressed-cylinder'] },
  '1073': { defaultId: 'mc-338', ids: ['mc-338', 'cryogenic-cylinder'] },
  '1977': { defaultId: 'mc-338', ids: ['mc-338', 'cryogenic-cylinder'] },
};

function getContainerOptionsForChemical(chemical) {
  if (!chemical) {
    const unknown = profileById('unknown');
    return {
      recommendedContainer: unknown.label,
      containerOptions: [unknown],
      containerSize: { default: unknown.sizes[0], options: unknown.sizes },
      capacity: { default: '', typicalRange: '', possibleRange: '', unit: '' },
      pressure: { default: unknown.pressureProfile, range: unknown.pressureRange, unit: unknown.pressureUnit, normalOperatingPressure: unknown.pressureNormal },
      pressureProfile: { default: unknown.pressureProfile },
      fillLevel: { defaultPercent: 85, options: [25, 50, 75, 85, 90, 95, 100] },
      releaseLocation: { default: 'Unknown', options: ['Unknown'] },
    };
  }
  const un = String(chemical?.un || '').replace(/\D/g, '');
  const name = String(chemical?.name || activeChemical?.name || '').toLowerCase();
  const hazard = `${chemical?.dotClass || ''} ${name}`.toLowerCase();
  let match = chemicalContainerOverrides[un];
  if (!match && /liquid oxygen|oxygen, refrigerated/.test(name)) match = chemicalContainerOverrides['1073'];
  if (!match && /liquid nitrogen|nitrogen, refrigerated/.test(name)) match = chemicalContainerOverrides['1977'];
  if (!match && /cryogenic|refrigerated liquid/.test(hazard)) match = { defaultId: 'mc-338', ids: ['mc-338', 'cryogenic-cylinder'] };
  if (!match && /(liquefied|liquified).*(gas)|lpg|propane|butane/.test(hazard)) match = { defaultId: 'mc-331', ids: ['mc-331', 'compressed-cylinder', 'rail-pressure'] };
  if (!match && /class 2|compressed gas|\b2\.[123]\b/.test(hazard)) match = { defaultId: 'compressed-cylinder', ids: ['compressed-cylinder', 'tube-trailer', 'mc-331', 'rail-pressure'] };
  if (!match && /class 3|flammable liquid|\b3\b/.test(hazard)) match = { defaultId: 'dot-406', ids: ['dot-406', 'dot-407', 'rail-nonpressure', 'ibc', 'drum'] };
  if (!match && /class 8|corrosive|\b8\b/.test(hazard)) match = { defaultId: 'dot-412', ids: ['dot-412', 'rail-nonpressure', 'ibc', 'drum'] };
  if (!match && /oxidizer|class 5\.1|\b5\.1\b/.test(hazard)) match = { defaultId: 'dot-407', ids: ['dot-407', 'dot-412', 'ibc', 'drum', 'rail-nonpressure'] };
  if (!match && /solid|powder/.test(hazard)) match = { defaultId: 'solid-package', ids: ['solid-package', 'drum'] };
  if (!match) match = { defaultId: 'dot-407', ids: ['dot-407', 'portable-tank', 'ibc', 'drum', 'unknown'] };
  const selected = profileById(match.defaultId);
  return {
    recommendedContainer: selected.label,
    containerOptions: match.ids.map(profileById),
    containerSize: { default: selected.sizes[0], options: selected.sizes },
    capacity: { default: selected.capacityDefault, typicalRange: selected.typicalRange, possibleRange: selected.possibleRange, unit: selected.sizeUnit || '' },
    pressure: { default: selected.pressureProfile, range: selected.pressureRange, unit: selected.pressureUnit, normalOperatingPressure: selected.pressureNormal },
    pressureProfile: { default: selected.pressureProfile },
    fillLevel: { defaultPercent: 85, options: [25, 50, 75, 85, 90, 95, 100] },
    releaseLocation: { default: 'Unknown', options: ['Vapor space leak', 'Liquid space leak', 'Bottom outlet / liquid release', 'Top fitting / vapor release', 'Valve / piping failure', 'Unknown'] },
  };
}

window.HazMatIQ.getContainerOptionsForChemical = getContainerOptionsForChemical;

let activeContainerOptions = getContainerOptionsForChemical(null);
let activePressureConfidence = 'Planning default';

function setSelectOptions(select, options, selectedValue) {
  if (!select) return;
  select.replaceChildren(...options.map(({ value, label }) => Object.assign(document.createElement('option'), { value, textContent: label })));
  if (selectedValue && options.some((option) => option.value === selectedValue)) select.value = selectedValue;
}

function updateContainerControlSummaries() {
  const container = profileById(document.getElementById('plume-container-type')?.value);
  const pressureCondition = document.getElementById('container-pressure-condition')?.value || 'Unknown / verify';
  setText('container-type-summary', container.label);
  setText('container-size-summary', document.getElementById('container-size-preset')?.value || 'User select');
  setText('container-capacity-summary', document.getElementById('container-capacity')?.value || container.capacityDefault || 'Verify container');
  setText('container-pressure-summary', pressureCondition);
  setText('container-pressure-profile-summary', document.getElementById('container-pressure-profile')?.value || 'Unknown / verify');
  setText('container-pressure-behavior', pressureCondition);
  setText('container-pressure-confidence', activePressureConfidence);
  setText('container-pressure-confidence-summary', activePressureConfidence);
  setText('container-pressure-note', container.pressureNote);
  setText('container-pressure-model-source', container.modelSourceType);
  setText('container-fill-summary', `${document.getElementById('container-fill-level')?.value || 85}% planning value`);
  setText('container-release-summary', `${document.getElementById('container-release-location')?.value || 'Unknown'} · ${document.getElementById('container-release-phase')?.value || 'Unknown / verify'}`);
}

function getCapacityBubbleValue(profile) {
  const capacity = String(profile.capacityDefault || '').replace(/,/g, '');
  const knownValues = { '5 gal': '5 gal', '30 gal': '30 gal', '55 gal': '55 gal', '275 gal': '275 gal', '330 gal': '330 gal', '500 gal': '500 gal', '1000 gal': '1,000 gal', '5000 gal': '5,000 gal', '10000 gal': '10,000 gal' };
  if (knownValues[capacity]) return knownValues[capacity];
  if (/^(150 lb|small|package)/i.test(capacity)) return 'Small package';
  return capacity ? 'Facility-specific / custom' : 'Unknown / verify';
}

function updatePressureConfidenceFromUser() {
  const source = document.getElementById('container-pressure-source')?.value || 'Unknown';
  const hasPsig = Boolean(document.getElementById('container-pressure')?.value);
  const verifiedSources = new Set(['Gauge observed', 'SDS / shipping papers', 'Facility inventory / E-Plan', 'Container spec plate', 'Pipeline operator confirmed']);
  activePressureConfidence = hasPsig && verifiedSources.has(source) ? 'Verified' : 'User entered';
  if (document.getElementById('container-pressure-condition')?.value === 'User-entered PSIG') {
    document.getElementById('pressure-override')?.setAttribute('open', '');
    document.getElementById('pressure-override')?.closest('.container-details')?.setAttribute('open', '');
  }
  updateContainerControlSummaries();
}

function applyContainerProfile({ keepUserValues = false } = {}) {
  const selectedId = document.getElementById('plume-container-type')?.value || 'unknown';
  const profile = profileById(selectedId);
  const setInput = (id, value = '') => {
    const input = document.getElementById(id);
    if (input && (!keepUserValues || !input.value)) input.value = value || '';
  };
  setSelectOptions(document.getElementById('container-size-preset'), profile.sizes.map((label) => ({ value: label, label })), profile.sizes[0]);
  setInput('container-size', profile.defaultSize);
  setInput('container-size-unit', profile.sizeUnit);
  setInput('container-fill-level', 85);
  setInput('container-pressure-condition', profile.pressureCondition);
  setInput('container-pressure');
  setInput('container-pressure-unit', 'psig');
  setInput('container-pressure-source', 'Unknown');
  setInput('container-capacity', getCapacityBubbleValue(profile));
  setInput('container-model-source', profile.modelSourceType);
  setInput('container-pressure-profile', profile.pressureProfile);
  setText('container-capacity-default', profile.capacityDefault || 'Verify container');
  setText('container-capacity-typical', profile.typicalRange || 'Verify container');
  setText('container-capacity-possible', profile.possibleRange || 'Verify container');
  setText('container-pressure-normal', profile.pressureNormal);
  setText('container-pressure-range', profile.pressureRange);
  activePressureConfidence = profile.pressureConfidence;
  setText('container-profile-guidance', profile.id === 'unknown'
    ? 'Unknown / Custom'
    : profile.label);
  updateContainerControlSummaries();
}

function applyChemicalContainerProfile() {
  activeContainerOptions = getContainerOptionsForChemical(activeChemicalRecord || activeChemical);
  const select = document.getElementById('plume-container-type');
  setSelectOptions(select, activeContainerOptions.containerOptions.map((profile) => ({ value: profile.id, label: profile.label })), activeContainerOptions.containerOptions[0]?.id);
  applyContainerProfile();
}

function restoreIncidentContainerData() {
  const incident = getActiveIncident();
  if (!incident) return;
  const containerSelect = document.getElementById('plume-container-type');
  if (containerSelect && incident.containerProfileId) containerSelect.value = incident.containerProfileId;
  applyContainerProfile();
  const savedValues = {
    'container-size': incident.containerSize,
    'container-size-unit': incident.containerSizeUnit,
    'container-fill-level': incident.containerFillLevel,
    'container-pressure-condition': incident.containerPressureCondition,
    'container-pressure': incident.containerPressure,
    'container-pressure-unit': incident.containerPressureUnit,
    'container-pressure-source': incident.containerPressureSource,
    'container-capacity': incident.containerCapacity,
    'container-pressure-profile': incident.containerPressureProfile,
    'container-release-location': incident.containerReleaseLocation,
    'container-release-phase': incident.containerReleasePhase,
  };
  Object.entries(savedValues).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input && value !== undefined && value !== null) {
      const savedValue = String(value);
      if (input.tagName === 'SELECT' && savedValue && !Array.from(input.options).some((option) => option.value === savedValue)) {
        input.add(new Option(savedValue, savedValue));
      }
      input.value = savedValue;
    }
  });
  activePressureConfidence = incident.containerPressureConfidence || 'Planning default';
  updateContainerControlSummaries();
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
  if (!activeChemical) throw new Error('Identify a chemical before plotting.');
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
    if (!result?.isopleths?.some((item) => item.polygon?.length >= 2)) {
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

async function capturePlumeMapImage() {
  if (!plumeMap) return '';
  await new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    plumeMap.once('idle', finish);
    window.setTimeout(finish, 1200);
  });
  try {
    return plumeMap.getCanvas().toDataURL('image/jpeg', 0.82);
  } catch {
    return '';
  }
}

// Planning results stay separate from official incident documentation.
function savePlumeResult(command, mapImage = '') {
  const savedAt = new Date().toISOString();
  const activeId = window.localStorage.getItem(activeIncidentIdStorageKey);
  if (!activeId) {
    savePlanningState({
      selectedChemical: activeChemical,
      plumeSummary: command,
      ...(mapImage ? { plumeMapImage: mapImage } : {}),
      savedAt,
    });
    return;
  }
  const incidents = readIncidents();
  const index = incidents.findIndex((incident) => incident.incidentId === activeId);
  if (index < 0) return;
  incidents[index] = {
    ...incidents[index],
    plumeSummary: command,
    plumeUpdatedAt: savedAt,
    ...(mapImage ? { plumeMapImage: mapImage } : {}),
  };
  try {
    writeIncidents(incidents);
  } catch {
    delete incidents[index].plumeMapImage;
    writeIncidents(incidents);
  }
}

async function plotPlumeFromControls() {
  const plotButton = document.getElementById('plot-plume-btn');
  if (plotButton) plotButton.disabled = true;
  setText('plume-input-status', 'Validating location and model inputs…');
  setText('plume-overlay-status', 'Calculating plume zones…');
  try {
    const location = await getIncidentCoordinates({ requestGps: true });
    if (!location) throw new Error('Enter a location before plotting.');
    await ensurePlumeMap(location);
    const inputs = readPlumeModelInputs(location);
    if (hasActiveIncident()) saveIncidentBrief({ quiet: true });
    const modeled = await runBackendPlume(inputs);
    setText('backend-model-summary', modeled.summary);
    if (!modeled.result) {
      await clearThreatZones(modeled.summary);
      setText('plume-input-status', modeled.summary);
      return;
    }

    importedPlumeOverlay = null;
    const geojson = plumeResultToGeoJson(modeled.result, location);
    const label = '';
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
    savePlumeResult(activePlumeCommand, await capturePlumeMapImage());
    renderIncidentCommandSnapshot();
    const documentationNote = hasActiveIncident()
      ? 'Saved to the active incident.'
      : 'Planning result only; not part of incident documentation.';
    setText('plume-input-status', `Plotted ${activeChemical.name}. ${documentationNote}`);
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

  const incident = getActiveIncident();
  setText('plume-summary-incident-name', incident?.incidentName || 'Planning Mode');
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

  const { openMeteo, nws } = await fetchWeatherSources(location.lat, location.lon);
  if (token !== plumeRefreshToken) return;
  const elevationInput = document.getElementById('plume-elevation');
  if (elevationInput) {
    elevationInput.value = Number.isFinite(openMeteo?.elevationFt) ? openMeteo.elevationFt.toLocaleString() : '';
  }
  setText('open-meteo-location', openMeteo?.location || 'Open-Meteo unavailable');
  setText('open-meteo-conditions', openMeteo?.conditions || 'Open-Meteo unavailable');
  setText('open-meteo-summary', openMeteo
    ? `${openMeteo.conditions}${openMeteo.elevationFt === null ? '' : ` · Elevation ${openMeteo.elevationFt.toLocaleString()} ft`}`
    : 'Open-Meteo unavailable');
  setText('nws-station-summary', nws?.station || 'NWS observation station unavailable');
  setText('nws-weather-summary', nws?.conditions || 'NWS live observation unavailable');
  setText('nws-observation-summary', nws?.observedAt || 'Observation time unavailable');

  const weatherNotification = openMeteo?.conditions || nws?.conditions || 'Live weather unavailable';
  updateNotificationCenter({ weather: weatherNotification });
  latestPlumeWeather = selectPlumeWeather(openMeteo, nws);
  updateCommandWeatherState(openMeteo, nws, location);
  if (latestPlumeWeather) applyLiveWeatherToPlumeInputs(latestPlumeWeather);
  else setText('plume-input-status', 'Live weather is unavailable. Enter weather observations manually before plotting.');
  setText('backend-model-summary', 'Run plume model to view result.');
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
  savePlumeResult(activePlumeCommand, await capturePlumeMapImage());
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
document.getElementById('refresh-command-weather-btn')?.addEventListener('click', () => refreshCommandWeather({ requestGps: true }));
document.getElementById('change-plume-chemical-btn')?.addEventListener('click', () => {
  showView('lookup');
  chemicalSearchInput?.focus();
  chemicalSearchInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
document.getElementById('plume-release-type')?.addEventListener('change', updatePlumeReleaseQuantityLabel);
document.getElementById('plume-container-type')?.addEventListener('change', () => {
  applyContainerProfile();
  updateActiveIncidentRecord();
});
document.getElementById('container-pressure-condition')?.addEventListener('change', updatePressureConfidenceFromUser);
document.getElementById('container-pressure')?.addEventListener('input', updatePressureConfidenceFromUser);
document.getElementById('container-pressure-source')?.addEventListener('change', updatePressureConfidenceFromUser);
incidentContainerFieldIds.slice(1).forEach((id) => {
  const field = document.getElementById(id);
  field?.addEventListener(field.tagName === 'SELECT' ? 'change' : 'input', () => {
    updateContainerControlSummaries();
    updateActiveIncidentRecord();
  });
});
document.getElementById('use-live-plume-weather-btn')?.addEventListener('click', async () => {
  const button = document.getElementById('use-live-plume-weather-btn');
  if (button) {
    button.disabled = true;
    button.textContent = 'Refreshing…';
  }
  try {
    await refreshPlumeWorkspace({ requestGps: true });
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Refresh Weather';
    }
  }
});
document.getElementById('plume-model-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await plotPlumeFromControls();
});
updatePlumeReleaseQuantityLabel();
applyChemicalContainerProfile();
window.setInterval(() => {
  if (document.getElementById('incident')?.classList.contains('active')) {
    void refreshCommandWeather({ requestGps: false });
  }
}, 5 * 60 * 1000);
document.querySelectorAll('[data-plume-map-view]').forEach((button) => {
  button.addEventListener('click', () => setPlumeMapView(button.dataset.plumeMapView));
});
document.querySelectorAll('[data-plume-layer]').forEach((button) => {
  button.addEventListener('click', async () => {
    const layerName = button.dataset.plumeLayer;
    if (plumeLayerState[layerName]) {
      plumeLayerState[layerName] = false;
      setPlumeLayerVisibility(layerName, false);
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
      setText('plume-layers-status', layerName === 'hazards' ? 'Hazards layer hidden.' : '');
      return;
    }

    const guidesAvailable = currentThreatZoneGuideGeoJson?.features?.some((feature) => feature.properties?.guideType === 'centerline');
    if (layerName === 'centerline' && !guidesAvailable) {
      setText('plume-layers-status', 'Centerline unavailable until plume model is run.');
      return;
    }
    if (layerName === 'distance' && !guidesAvailable) {
      setText('plume-layers-status', 'Distance markers unavailable until plume model is run.');
      return;
    }

    plumeLayerState[layerName] = true;
    try {
      if (layerName === 'hazards' && !await showPlumeHazards()) {
        plumeLayerState.hazards = false;
        return;
      }
      setPlumeLayerVisibility(layerName, true);
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      if (layerName !== 'hazards') setText('plume-layers-status', '');
    } catch {
      plumeLayerState[layerName] = false;
      setText('plume-layers-status', layerName === 'hazards'
        ? 'Hazards unavailable until plume bounds or release point are available.'
        : '');
    }
  });
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
    await refreshNotificationWeather(gps);
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
