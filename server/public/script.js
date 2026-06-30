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
  if (targetId === 'incident') void refreshCommandWeather({ requestGps: false });
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

const incidentBriefStorageKey = 'hazmatiq.incidentBrief';
const incidentBriefFieldIds = [
  'incidentName',
  'incident-address-input',
  'incident-city',
  'incident-state',
  'incident-coordinates-input',
  'incident-product',
  'incident-notes',
];
const incidentsStorageKey = 'hazmatiq_incidents';
const activeIncidentIdStorageKey = 'hazmatiq_active_incident_id';
const plumePlanningStorageKey = 'hazmatiq_plume_planning_session';
let incidentTimerInterval = null;

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
}

function getActiveIncident() {
  const activeId = window.localStorage.getItem(activeIncidentIdStorageKey);
  return readIncidents().find((incident) => incident.incidentId === activeId) || null;
}

function hasActiveIncident() {
  return Boolean(window.localStorage.getItem(activeIncidentIdStorageKey));
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
    ? { ...incident, status: 'Completed', completedAt: now.toISOString() }
    : incident);
  const incident = {
    incidentId: window.crypto?.randomUUID?.() || `incident-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    incidentName: document.getElementById('incidentName')?.value.trim() || 'New Incident',
    startDate: now.toLocaleDateString(),
    startTime: now.toLocaleTimeString(),
    startedAt: now.toISOString(),
    status: 'Active',
  };
  writeIncidents([incident, ...incidents]);
  window.localStorage.setItem(activeIncidentIdStorageKey, incident.incidentId);
  startIncidentTimer();
  renderIncidentLists();
}

function renderIncidentTimer() {
  const timer = document.getElementById('active-incident-timer');
  if (!timer) return;
  const startedAt = Date.parse(getActiveIncident()?.startedAt || '');
  const elapsedSeconds = Number.isFinite(startedAt) ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  timer.textContent = `${hours}:${minutes}:${seconds}`;
}

function startIncidentTimer() {
  renderIncidentTimer();
  if (!incidentTimerInterval) incidentTimerInterval = window.setInterval(renderIncidentTimer, 1000);
}

function getIncidentFormData() {
  const coordinates = parseGpsCoordinate(document.getElementById('incident-coordinates-input')?.value);
  const advanced = Object.fromEntries(activeChemicalRecord?.advanced || []);
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
    chemicalName: document.getElementById('incident-product')?.value.trim() || activeChemical?.name || '',
    casNumber: advanced.CAS === 'N/A' ? '' : advanced.CAS || '',
    unNumber: activeChemicalRecord?.un === 'N/A' ? '' : activeChemicalRecord?.un || '',
    quantity: document.getElementById('plume-release-quantity')?.value || '',
    containerType: document.getElementById('incident-container-type')?.value.trim() || '',
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
  };
  writeIncidents(incidents);
  window.localStorage.removeItem(activeIncidentIdStorageKey);
  renderIncidentTimer();
  renderIncidentLists();
  setIncidentStatus('Incident completed and moved to Completed Reports.');
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
  if (!previous.length && previousContainer) previousContainer.textContent = 'No completed incidents saved yet.';
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

function openIncidentSummary(incidentId) {
  const incident = readIncidents().find((item) => item.incidentId === incidentId);
  const summary = document.getElementById('incident-report-summary');
  const content = document.getElementById('incident-report-summary-content');
  if (!incident || !summary || !content) return;
  document.getElementById('incident-report-summary-title').textContent = incident.incidentName || 'Incident Summary';
  content.replaceChildren();
  appendIncidentSummarySection(content, 'Incident Details', [
    ['Incident name', incident.incidentName],
    ['Incident number', incident.incidentNumber],
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
    ['Sources', incident.chemicalSources],
  ]);
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
    mapHeading.textContent = 'Most Recent Plume Map';
    const mapImage = document.createElement('img');
    mapImage.src = incident.plumeMapImage;
    mapImage.alt = 'Most recent plume model map for this incident';
    mapSection.append(mapHeading, mapImage);
    content.append(mapSection);
  }
  appendIncidentSummarySection(content, 'Documentation Notes', [['Notes', incident.notes]]);
  document.querySelector('.report-tabs').hidden = true;
  ['current', 'previous', 'library'].forEach((name) => {
    const section = document.getElementById(`report-${name}-section`);
    if (section) section.hidden = true;
  });
  summary.hidden = false;
  summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeIncidentSummary() {
  const summary = document.getElementById('incident-report-summary');
  if (summary) summary.hidden = true;
  const tabs = document.querySelector('.report-tabs');
  if (tabs) tabs.hidden = false;
  const selected = document.querySelector('[data-report-tab].primary-btn')?.dataset.reportTab || 'current';
  const selectedSection = document.getElementById(`report-${selected}-section`);
  if (selectedSection) selectedSection.hidden = false;
}

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
  if (createRecord) createIncidentRecord();
  setIncidentStatus('New incident started. Select a chemical to populate HAZMAT COMMAND data.');
}

function resumeActiveIncident() {
  incidentWorkflowActive = true;
  restoreIncidentBrief();
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

function uniquePpeItems(items = []) {
  return [...new Map(items
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
  return {
    title: hasScba ? `${levelLabel} + SCBA` : levelLabel,
    summary: 'Source-backed starting PPE reference for the identified chemical; not an IC-confirmed selection.',
    source: `Sources available: backend chemical PPE record${hasNiosh ? ', NIOSH NPG' : ''}${kappler.length ? ', Kappler HazMatch' : ''}.`,
    details: [
      clothing.length ? `Protective clothing — backend chemical PPE: ${clothing.join('; ')}` : 'Protective clothing level: not specified in the current backend record.',
      respiratory.length ? `Respiratory — ${[nioshRespiratory.length ? `NIOSH: ${nioshRespiratory.join('; ')}` : '', chemicalRespiratory.length ? `backend chemical PPE: ${chemicalRespiratory.join('; ')}` : ''].filter(Boolean).join(' · ')}` : 'Respiratory protection: not specified in the current backend record.',
      skin.length ? `Gloves / boots / skin — ${[nioshSkin.length ? `NIOSH: ${nioshSkin.join('; ')}` : '', chemicalSkin.length ? `backend chemical PPE: ${chemicalSkin.join('; ')}` : ''].filter(Boolean).join(' · ')}` : 'Gloves / boots / skin protection: not specified in the current backend record.',
      eye.length ? `Eye / face — ${[nioshEye.length ? `NIOSH: ${nioshEye.join('; ')}` : '', chemicalEye.length ? `backend chemical PPE: ${chemicalEye.join('; ')}` : ''].filter(Boolean).join(' · ')}` : 'Eye / face protection: not specified in the current backend record.',
      kappler.length ? `Kappler HazMatch garment data: ${kappler.join('; ')}` : 'Kappler HazMatch: no chemical-specific result is stored in the backend.',
    ],
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

function renderIncidentGuidance() {
  const enteredChemical = document.getElementById('incident-product')?.value.trim();
  const hasSelectedChemical = getActiveIncident() && activeChemical && enteredChemical === activeChemical.name;
  if (!hasSelectedChemical) {
    renderGuidanceBox('incident-ppe-guidance', 'incident-ppe-sources', null, 'Select or identify a chemical to populate PPE guidance.');
    renderGuidanceBox('incident-medical-guidance', 'incident-medical-sources', null, 'Select or identify a chemical to populate medical guidance.');
    return;
  }
  if (!activeChemicalRecord) {
    renderGuidanceBox('incident-ppe-guidance', 'incident-ppe-sources', null, 'No verified PPE guidance available for this chemical.');
    renderGuidanceBox('incident-medical-guidance', 'incident-medical-sources', null, 'No verified medical guidance available for this chemical.');
    return;
  }
  const ppeSummary = buildIncidentPpeSummary(activeChemicalRecord);
  const medicalSummary = buildIncidentMedicalSummary(activeChemicalRecord);
  renderGuidanceBox('incident-ppe-guidance', 'incident-ppe-sources', ppeSummary, 'No verified PPE guidance available for this chemical.');
  renderGuidanceBox('incident-medical-guidance', 'incident-medical-sources', medicalSummary, 'No verified medical guidance available for this chemical.');

  saveIncidentGuidance(ppeSummary, medicalSummary, activeChemicalRecord.summarySources);
}

function renderIncidentCommandSnapshot() {
  const chemicalLoaded = incidentWorkflowActive && Boolean(activeChemical);
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
    ].forEach((id) => setText(id, ''));
    ['command-chemical-details', 'command-plume-details', 'command-ppe-details'].forEach((id) => {
      document.getElementById(id)?.replaceChildren();
    });
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
    setText('plume-input-status', 'Select a chemical through Chemical ID to begin.');
  } else {
    const mode = hasActiveIncident() ? 'active incident' : 'planning session';
    setText('plume-input-status', `${activeChemical.name} is linked to the ${mode}. Confirm the release and weather inputs.`);
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
    setText('backend-model-summary', 'Awaiting operator-entered model inputs');
  }
  syncPlumeChemicalSelection();
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
      if (activeChemical?.id === chemical.id) {
        activeChemicalRecord = record;
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
  latestChemicalSearch += 1;
  window.clearTimeout(chemicalSearchTimer);
  setChemicalSearchStatus(`Loading ${chemical.name || 'chemical'}…`, 'loading');
  const record = await buildFullChemicalRecord(chemical);
  if (activeChemical?.id === chemical.id) {
    activeChemicalRecord = record;
    updateActiveIncidentRecord();
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
  const chemicals = readSavedChemicals();
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
  if (activeChemical?.id !== chemical.id) return;
  activeChemicalRecord = record;
  updateActiveIncidentRecord();
  renderIncidentCommandSnapshot();
  setIncidentStatus(`${chemical.name} selected for the active incident.`);
}

async function searchIncidentProducts(value) {
  const requestId = ++latestIncidentProductSearch;
  const data = await fetchJson(`/api/chemicals?q=${encodeURIComponent(normalizeChemicalQuery(value))}`);
  if (requestId !== latestIncidentProductSearch || !incidentProductSuggestions) return;
  incidentProductSuggestions.replaceChildren();
  (data?.chemicals || []).slice(0, 8).forEach((chemical) => {
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
  const windSpeedMph = Number.isFinite(windMps) ? windMps * 2.23694 : null;
  const gustMph = Number.isFinite(gustMps) ? gustMps * 2.23694 : null;
  const tempF = Number.isFinite(tempC) ? `${((tempC * 9) / 5 + 32).toFixed(1)}°F` : 'temperature unavailable';
  const wind = Number.isFinite(windMps) ? `${(windMps * 2.23694).toFixed(1)} mph` : 'wind unavailable';
  return {
    station: `NWS ${data.office === 'BMX' ? 'Birmingham (BMX)' : data.office || 'office'} · ${data.station.stationIdentifier} ${data.station.name || ''}`.trim(),
    conditions: `${tempF} · ${observation.textDescription || 'No description'} · Wind ${wind} ${degreesToCompass(observation.windDirection?.value)}`,
    observedAt: observation.timestamp,
    temperatureF,
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

  const [openMeteoResponse, nwsResponse] = await Promise.all([
    fetchOpenMeteo(location.lat, location.lon),
    fetchNwsObservation(location.lat, location.lon),
  ]);
  if (token !== commandWeatherRequestToken) return;
  const openMeteo = formatOpenMeteo(openMeteoResponse);
  const nws = formatNws(nwsResponse);
  latestPlumeWeather = openMeteo;
  updateCommandWeatherState(openMeteo, nws, location);
  setText('open-meteo-location', openMeteo?.location || 'Open-Meteo unavailable');
  setText('open-meteo-conditions', openMeteo?.conditions || 'Open-Meteo unavailable');
  setText('nws-station-summary', nws?.station || 'NWS observation station unavailable');
  setText('nws-weather-summary', nws?.conditions || 'NWS live observation unavailable');
  updateNotificationCenter({ weather: openMeteo?.conditions || nws?.conditions || 'Live weather unavailable' });
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
  updateCommandWeatherState(openMeteo, nws, location);
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
window.setInterval(() => {
  if (document.getElementById('incident')?.classList.contains('active')) {
    void refreshCommandWeather({ requestGps: false });
  }
}, 5 * 60 * 1000);
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
