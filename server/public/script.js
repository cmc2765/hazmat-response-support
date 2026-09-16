const buttons = document.querySelectorAll('.module-btn');
const views = document.querySelectorAll('.view');
const tacticalAlertMessage = document.getElementById('tactical-alert-message');
const notificationWeather = document.getElementById('notification-weather');
const notificationWeatherSource = document.getElementById('notification-weather-source');
const notificationMonitoring = document.getElementById('notification-monitoring');
const notificationUpdated = document.getElementById('notification-updated');
const notificationCenter = document.getElementById('notification-center');
const notificationAlertCount = document.getElementById('notification-alert-count');
const notificationDrawer = document.getElementById('notification-drawer');
const notificationDrawerBackdrop = document.getElementById('notification-drawer-backdrop');
const notificationDrawerBody = document.getElementById('notification-drawer-body');
const notificationDrawerClose = document.getElementById('notification-drawer-close');
const commandReferencePanels = document.querySelectorAll('[data-command-reference]');
const commandReferenceStack = document.querySelector('.command-reference-stack');
const commandSmokeCanvas = document.getElementById('command-smoke-canvas');

function initializeCommandSmokeCanvas() {
  if (!(commandSmokeCanvas instanceof HTMLCanvasElement)) return;
  const context = commandSmokeCanvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const billows = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let animationFrame = 0;
  let lastFrame = 0;
  let spawnCarry = 0;
  let randomState = 0x4d495148;

  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };

  function makeSmokeTexture(variant) {
    const texture = document.createElement('canvas');
    texture.width = 256;
    texture.height = 256;
    const textureContext = texture.getContext('2d');
    if (!textureContext) return texture;
    const center = 128;
    const drawPuff = (x, y, radius, opacity) => {
      const gradient = textureContext.createRadialGradient(x, y, radius * 0.06, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
      gradient.addColorStop(0.38, `rgba(246, 250, 252, ${opacity * 0.94})`);
      gradient.addColorStop(0.7, `rgba(222, 233, 240, ${opacity * 0.58})`);
      gradient.addColorStop(0.9, `rgba(198, 216, 227, ${opacity * 0.18})`);
      gradient.addColorStop(1, 'rgba(190, 211, 224, 0)');
      textureContext.fillStyle = gradient;
      textureContext.beginPath();
      textureContext.arc(x, y, radius, 0, Math.PI * 2);
      textureContext.fill();
    };

    drawPuff(center, center, 82, 0.78);
    textureContext.globalCompositeOperation = 'screen';
    for (let index = 0; index < 11; index += 1) {
      const angle = random() * Math.PI * 2;
      const distance = 18 + random() * 56;
      const x = center + Math.cos(angle) * distance * (0.76 + variant * 0.04);
      const y = center + Math.sin(angle) * distance * 0.72;
      drawPuff(x, y, 34 + random() * 38, 0.3 + random() * 0.2);
    }
    return texture;
  }

  const smokeTextures = Array.from({ length: 4 }, (_, index) => makeSmokeTexture(index));

  function createBillow(prefill = false) {
    const life = 5.8 + random() * 2.8;
    const age = prefill ? random() * life * 0.9 : 0;
    return {
      age,
      life,
      originX: width * (0.82 + (random() - 0.5) * 0.055),
      originY: height * (0.98 + random() * 0.05),
      startSize: Math.max(38, height * (0.14 + random() * 0.07)),
      rise: height * (0.105 + random() * 0.045),
      wind: width * (0.022 + random() * 0.018),
      curl: Math.max(9, height * (0.035 + random() * 0.045)),
      frequency: 0.72 + random() * 0.55,
      phase: random() * Math.PI * 2,
      rotation: (random() - 0.5) * 0.32,
      spin: (random() - 0.5) * 0.035,
      texture: smokeTextures[Math.floor(random() * smokeTextures.length)],
      opacity: 0.34 + random() * 0.22,
    };
  }

  function drawSmoke() {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'screen';
    for (const billow of billows) {
      const progress = Math.min(1, billow.age / billow.life);
      const fadeIn = Math.min(1, progress / 0.08);
      const fadeOut = Math.min(1, (1 - progress) / 0.24);
      const alpha = billow.opacity * fadeIn * fadeOut;
      if (alpha <= 0) continue;
      const drawSize = billow.startSize * (1 + progress * 2.35);
      const x = billow.originX
        - billow.wind * billow.age
        + Math.sin(billow.phase + billow.age * billow.frequency) * billow.curl;
      const y = billow.originY - billow.rise * billow.age;
      context.save();
      context.globalAlpha = alpha;
      context.translate(x, y);
      context.rotate(billow.rotation + billow.spin * billow.age);
      context.scale(1.18 + progress * 0.22, 0.9 + progress * 0.18);
      context.drawImage(billow.texture, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      context.restore();
    }
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
  }

  function resizeCanvas() {
    const bounds = commandSmokeCanvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    commandSmokeCanvas.width = Math.round(width * pixelRatio);
    commandSmokeCanvas.height = Math.round(height * pixelRatio);
    billows.length = 0;
    const initialCount = reducedMotion.matches ? 18 : Math.min(38, Math.max(24, Math.round(width / 34)));
    for (let index = 0; index < initialCount; index += 1) billows.push(createBillow(true));
    drawSmoke();
  }

  function animate(timestamp) {
    if (document.hidden || reducedMotion.matches) {
      animationFrame = 0;
      return;
    }
    const elapsed = Math.min(0.05, Math.max(0, (timestamp - lastFrame) / 1000 || 0));
    lastFrame = timestamp;
    spawnCarry += elapsed * Math.max(7.2, width / 145);
    while (spawnCarry >= 1) {
      billows.push(createBillow());
      spawnCarry -= 1;
    }
    for (let index = billows.length - 1; index >= 0; index -= 1) {
      const billow = billows[index];
      billow.age += elapsed;
      if (billow.age >= billow.life) billows.splice(index, 1);
    }
    drawSmoke();
    animationFrame = window.requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (reducedMotion.matches) {
      drawSmoke();
      return;
    }
    if (!animationFrame) {
      lastFrame = performance.now();
      animationFrame = window.requestAnimationFrame(animate);
    }
  }

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resizeCanvas) : null;
  resizeObserver?.observe(commandSmokeCanvas);
  if (!resizeObserver) window.addEventListener('resize', resizeCanvas);
  reducedMotion.addEventListener?.('change', () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    resizeCanvas();
    startAnimation();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startAnimation();
  });
  resizeCanvas();
  startAnimation();
}

function syncCommandReferenceScrollAreas() {
  commandReferencePanels.forEach((panel) => {
    const content = panel.querySelector('.command-reference-content');
    const summary = panel.querySelector(':scope > summary');
    if (!content || !summary || !panel.open || window.innerWidth <= 980) {
      if (content) content.style.height = '';
      return;
    }
    content.style.height = `${Math.max(0, panel.clientHeight - summary.offsetHeight)}px`;
  });
}

commandReferencePanels.forEach((panel) => {
  panel.addEventListener('toggle', () => {
    if (panel.open) {
      commandReferencePanels.forEach((otherPanel) => {
        if (otherPanel !== panel) otherPanel.open = false;
      });
    }
    window.requestAnimationFrame(syncCommandReferenceScrollAreas);
  });
});

window.addEventListener('resize', syncCommandReferenceScrollAreas);
if (commandReferenceStack && 'ResizeObserver' in window) {
  new ResizeObserver(syncCommandReferenceScrollAreas).observe(commandReferenceStack);
}

let tacticalClockTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let tacticalClockUsesGpsTimeZone = false;
let notificationWeatherLocation = null;
let notificationDrawerTrigger = null;
const notificationHistoryStorageKey = 'hazmatiq_notification_history';
const notificationSources = { tactical: 'System', weather: 'Weather', monitoring: 'Monitoring' };
const notificationSeverityRank = { normal: 0, advisory: 1, warning: 2, critical: 3 };
const notificationCurrentValues = {
  tactical: tacticalAlertMessage?.textContent || 'System Normal',
  weather: notificationWeather?.textContent || '',
  monitoring: notificationMonitoring?.textContent || '',
};
let notificationHistory = [];

try {
  notificationHistory = JSON.parse(window.localStorage.getItem(notificationHistoryStorageKey) || '[]');
  if (!Array.isArray(notificationHistory)) notificationHistory = [];
} catch {
  notificationHistory = [];
}

function classifyNotification(message) {
  const text = String(message || '');
  if (/\b(critical|danger|evacuat|life safety|alarm)\b/i.test(text)) return 'critical';
  if (/\b(warning|alert|failed|failure|lost|disconnect|conflict|error)\b/i.test(text) && !/no alerts?/i.test(text)) return 'warning';
  if (/\b(loading|awaiting|needed|stale|verify|unavailable)\b/i.test(text)) return 'advisory';
  return 'normal';
}

function persistNotificationHistory() {
  try {
    window.localStorage.setItem(notificationHistoryStorageKey, JSON.stringify(notificationHistory.slice(0, 100)));
  } catch {
    // Notification display remains operational when storage is unavailable.
  }
}

function getActiveNotifications() {
  return notificationHistory.filter((entry) => !entry.resolved && entry.severity !== 'normal');
}

function getPrimaryNotification() {
  return getActiveNotifications().sort((a, b) =>
    notificationSeverityRank[b.severity] - notificationSeverityRank[a.severity]
    || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || null;
}

function renderNotificationDrawer() {
  if (!notificationDrawerBody) return;
  notificationDrawerBody.replaceChildren();
  const entries = [...notificationHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No notification history recorded.';
    notificationDrawerBody.append(empty);
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement('article');
    item.className = 'notification-history-item';
    item.dataset.severity = entry.severity;
    const heading = document.createElement('div');
    heading.className = 'notification-history-heading';
    const source = document.createElement('strong');
    source.textContent = entry.source;
    const status = document.createElement('span');
    status.textContent = entry.resolved ? 'Resolved' : entry.acknowledged ? 'Acknowledged' : entry.severity;
    heading.append(source, status);
    const message = document.createElement('p');
    message.textContent = entry.message;
    const time = document.createElement('time');
    time.dateTime = entry.timestamp;
    time.textContent = new Date(entry.timestamp).toLocaleString();
    item.append(heading, message, time);
    notificationDrawerBody.append(item);
  });
}

function renderNotificationStrip() {
  const active = getActiveNotifications();
  const primary = getPrimaryNotification();
  notificationCenter?.setAttribute('data-severity', primary?.severity || 'normal');
  if (tacticalAlertMessage) tacticalAlertMessage.textContent = primary
    ? `${primary.source}: ${primary.message}`
    : notificationCurrentValues.tactical;
  if (notificationAlertCount) notificationAlertCount.textContent = `Alerts: ${active.length}`;
  renderNotificationDrawer();
}

function recordNotification(sourceKey, message) {
  const normalized = String(message || '').trim();
  const source = notificationSources[sourceKey];
  const previous = notificationHistory.find((entry) => entry.source === source && !entry.resolved);
  if (previous?.message === normalized) return;
  if (previous) previous.resolved = true;
  notificationHistory.unshift({
    id: `${Date.now()}-${sourceKey}`,
    source,
    message: normalized,
    severity: classifyNotification(normalized),
    timestamp: new Date().toISOString(),
    acknowledged: false,
    resolved: false,
  });
  notificationHistory = notificationHistory.slice(0, 100);
  persistNotificationHistory();
}

function openNotificationDrawer(trigger) {
  if (!notificationDrawer || !notificationDrawerBackdrop) return;
  notificationDrawerTrigger = trigger || document.activeElement;
  renderNotificationDrawer();
  notificationDrawer.hidden = false;
  notificationDrawerBackdrop.hidden = false;
  notificationDrawerClose?.focus();
}

function closeNotificationDrawer() {
  if (!notificationDrawer || !notificationDrawerBackdrop) return;
  notificationDrawer.hidden = true;
  notificationDrawerBackdrop.hidden = true;
  notificationDrawerTrigger?.focus?.();
}

function formatConcentration(value) {
  const text = String(value ?? '').trim();
  if (!text || /^(not available|not established|n\/a)$/i.test(text)) return text;
  if (/(?:\b(?:ppm|ppb|percent)\b|\b(?:[µμu]?g|mg|kg)\s*[\/-]\s*m(?:\^?3|³)|%(?:\s*(?:LEL|UEL))?)/i.test(text)) return text;
  return /^([<>≤≥~]?\s*\d[\d,.]*(?:\s*[-–]\s*\d[\d,.]*)?)(\s*.*)$/.test(text)
    ? text.replace(/^([<>≤≥~]?\s*\d[\d,.]*(?:\s*[-–]\s*\d[\d,.]*)?)(\s*.*)$/, '$1 ppm$2')
    : text;
}

function formatIdlh(value) {
  return formatConcentration(value);
}

function appendMeasurementUnit(value, unit, existingUnitPattern) {
  const text = String(value ?? '').trim();
  if (!text || !/\d/.test(text) || existingUnitPattern.test(text)) return text;
  return text.replace(
    /^([<>≤≥~]?\s*[+-]?\d+(?:\.\d+)?(?:\s*[-–]\s*[+-]?\d+(?:\.\d+)?)?)/,
    `$1 ${unit}`,
  );
}

function formatTemperatureMeasurement(value) {
  const text = String(value ?? '').trim();
  if (!text || !/\d/.test(text) || /°\s*[CF]\b/i.test(text)) return text;
  return text.replace(
    /([+-]?\d+(?:\.\d+)?(?:\s*[-–]\s*[+-]?\d+(?:\.\d+)?)?)(?![\d.]|\s*°)/g,
    '$1°C',
  );
}

function formatExplosiveLimits(value) {
  return String(value ?? '').split('/').map((part) => appendMeasurementUnit(
    part,
    '% vol',
    /%|percent|not available|not established|not relevant/i,
  )).join(' / ');
}

function formatProfileMeasurement(label, value) {
  if (Array.isArray(value)) return value;
  const key = String(label || '').toLowerCase();
  if (/flash point|boiling point|melting|freezing|ignition temperature|decomposition point/.test(key)) {
    return formatTemperatureMeasurement(value);
  }
  if (/molecular weight/.test(key)) return appendMeasurementUnit(value, 'g/mol', /g\s*\/\s*mol/i);
  if (/vapor pressure/.test(key)) return appendMeasurementUnit(value, 'mmHg', /mm\s*hg|torr|\b(?:k|m)?pa\b|\batm\b/i);
  if (/liquid density/.test(key)) return appendMeasurementUnit(value, 'g/mL', /g\s*\/\s*(?:ml|cm)/i);
  if (/vapor density/.test(key)) return appendMeasurementUnit(value, '(air = 1)', /air\s*=\s*1/i);
  if (/specific gravity/.test(key)) return appendMeasurementUnit(value, '(water = 1)', /water\s*=\s*1/i);
  if (/evaporation rate/.test(key)) return appendMeasurementUnit(value, '(butyl acetate = 1)', /(?:butyl acetate|ether)\s*=\s*1/i);
  if (/lel\s*\/\s*uel/.test(key)) return formatExplosiveLimits(value);
  if (/odor threshold/.test(key)) return appendMeasurementUnit(value, 'ppm', /ppm|ppb|mg\s*\/|µg\s*\//i);
  if (/ionization potential/.test(key)) return appendMeasurementUnit(value, 'eV', /\bev\b/i);
  if (/heat of vaporization/.test(key)) return appendMeasurementUnit(value, 'cal/g', /(?:cal|j|kj)\s*\/\s*(?:g|mol|kg)/i);
  return value;
}

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
    const savedLocation = await getIncidentCoordinates({ requestGps: false }).catch(() => null);
    const gps = savedLocation || await getCurrentGps();
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
    const value = String(update.tactical ?? '').trim();
    notificationCurrentValues.tactical = value;
    tacticalAlertMessage.textContent = value;
    recordNotification('tactical', value);
  }
  if (Object.prototype.hasOwnProperty.call(update, 'weather') && notificationWeather) {
    const value = String(update.weather ?? '').trim();
    notificationCurrentValues.weather = value;
    notificationWeather.textContent = value;
    recordNotification('weather', value);
  }
  if (Object.prototype.hasOwnProperty.call(update, 'monitoring') && notificationMonitoring) {
    const alerts = Array.isArray(update.monitoring)
      ? update.monitoring.filter(Boolean).join(' · ')
      : String(update.monitoring ?? '').trim();
    notificationCurrentValues.monitoring = alerts || 'No Alerts Found';
    notificationMonitoring.textContent = alerts || 'No Alerts Found';
    recordNotification('monitoring', alerts || 'No Alerts Found');
  }
  renderNotificationStrip();
}

notificationAlertCount?.addEventListener('click', () => openNotificationDrawer(notificationAlertCount));
notificationDrawerClose?.addEventListener('click', closeNotificationDrawer);
notificationDrawerBackdrop?.addEventListener('click', closeNotificationDrawer);
document.addEventListener('keydown', (event) => {
  if (!notificationDrawer || notificationDrawer.hidden) return;
  if (event.key === 'Escape') {
    closeNotificationDrawer();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...notificationDrawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && !element.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

window.HazMatIQ = window.HazMatIQ || {};
window.HazMatIQ.updateNotifications = updateNotificationCenter;

document.addEventListener('hazmatiq:telemetry', (event) => {
  updateNotificationCenter(event.detail || {});
});

function showView(targetId, { preserveHazardState = false, skipPlumeInitialization = false, plumeContext = null } = {}) {
  if (targetId === 'plume' && !skipPlumeInitialization) {
    return openPlumeModel(plumeContext || {});
  }
  if (targetId === 'lookup' && !preserveHazardState) setHazardProfileMode('empty');
  buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === targetId));
  views.forEach((view) => {
    const active = view.id === targetId;
    view.classList.toggle('active', active);
    view.hidden = !active;
    view.setAttribute('aria-hidden', String(!active));
  });
  document.documentElement.dataset.activeWorkspace = targetId;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  syncCommandBarContext();
  const plumeMapWorkspace = document.querySelector('.plume-main-workspace');
  if (plumeMapWorkspace) plumeMapWorkspace.hidden = targetId !== 'plume';
  if (targetId === 'incident') {
    renderIncidentCommandSnapshot();
    void refreshCommandWeather({ requestGps: true });
  }
  if (targetId === 'report') renderIncidentLists();
  if (targetId === 'my-chemicals') renderSavedChemicals();
  if (targetId === 'guided-response') renderGuidedResponse();
  if (targetId === 'map') window.requestAnimationFrame(initializeLiveMap);
  if (targetId === 'plume') updatePlumeModeLabel();
  if (targetId === 'plume' && !skipPlumeInitialization) window.requestAnimationFrame(() => void refreshPlumeWorkspace({ requestGps: true }));
}

// Every HAZMATIQ logo in the Command Dashboard is a dedicated Home control.
function returnToHazMatIqHome() {
  closeWorkspaceDrawer({ restoreFocus: false });
  showView('overview');
}

document.querySelectorAll('#command-brand-home, .workspace-drawer-home').forEach((control) => {
  control.addEventListener('click', returnToHazMatIqHome);
});

function syncCommandBarContext() {
  const activeIncident = getActiveIncident();
  const incidentName = activeIncident?.incidentName || 'Planning Workspace';
  let systemMode = 'Planning';
  try {
    if (activeIncident) systemMode = activeIncident.status || 'Active';
    else if (window.sessionStorage.getItem(systemModeStorageKey) === 'training') systemMode = 'Training';
  } catch {
    if (activeIncident) systemMode = activeIncident.status || 'Active';
  }
  setText('command-bar-incident', incidentName);
  setText('command-bar-mode', systemMode);
  const activeIncidentCard = document.getElementById('overview-active-incident-card');
  if (activeIncidentCard) activeIncidentCard.classList.toggle('is-empty', !activeIncident);
  setText('overview-active-incident-summary', activeIncident
    ? `Resume ${activeIncident.incidentName || 'the current incident'} command workspace.`
    : 'Open the incident command workspace.');
}

const workspaceDrawer = document.getElementById('workspace-navigation-drawer');
const workspaceDrawerBackdrop = document.getElementById('workspace-drawer-backdrop');
const workspaceDrawerToggle = document.getElementById('command-menu-toggle');
const workspaceDrawerClose = document.getElementById('workspace-drawer-close');
const workspaceProfileControl = document.getElementById('command-profile-control');
const workspaceDarkThemeOption = document.getElementById('workspace-dark-theme-option');
let workspaceDrawerReturnFocus = null;

function activateDarkCommandTheme({ persist = true } = {}) {
  document.documentElement.dataset.theme = 'dark';
  workspaceDarkThemeOption?.classList.add('active');
  workspaceDarkThemeOption?.setAttribute('aria-pressed', 'true');
  const status = workspaceDarkThemeOption?.querySelector('b');
  if (status) status.textContent = 'Active';
  if (!persist) return;
  try {
    window.localStorage.setItem('hazmatiq-theme', 'dark');
  } catch {
    // Theme persistence is optional when storage is unavailable.
  }
}

activateDarkCommandTheme({ persist: false });
workspaceDarkThemeOption?.addEventListener('click', () => activateDarkCommandTheme());

function positionHomepageWorkspaceDrawer() {
  if (!workspaceDrawer || !workspaceDrawerBackdrop || !workspaceDrawerToggle) return false;
  const isHomepage = document.getElementById('overview')?.classList.contains('active');
  workspaceDrawer.classList.toggle('workspace-drawer-home', isHomepage);
  workspaceDrawerBackdrop.classList.toggle('workspace-drawer-home', isHomepage);
  if (!isHomepage) {
    workspaceDrawer.style.removeProperty('--workspace-drawer-top');
    workspaceDrawer.style.removeProperty('--workspace-drawer-left');
    workspaceDrawerBackdrop.style.removeProperty('--workspace-drawer-top');
    return false;
  }
  const toggleRect = workspaceDrawerToggle.getBoundingClientRect();
  const drawerTop = `${Math.round(toggleRect.bottom + 5)}px`;
  workspaceDrawer.style.setProperty('--workspace-drawer-top', drawerTop);
  workspaceDrawer.style.setProperty('--workspace-drawer-left', `${Math.max(6, Math.round(toggleRect.left))}px`);
  workspaceDrawerBackdrop.style.setProperty('--workspace-drawer-top', drawerTop);
  return true;
}

function openWorkspaceDrawer(trigger = workspaceDrawerToggle) {
  if (!workspaceDrawer || !workspaceDrawerBackdrop) return;
  workspaceDrawerReturnFocus = trigger;
  positionHomepageWorkspaceDrawer();
  workspaceDrawer.hidden = false;
  workspaceDrawerBackdrop.hidden = false;
  workspaceDrawerToggle?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('workspace-drawer-open');
  workspaceDrawerClose?.focus();
}

function closeWorkspaceDrawer({ restoreFocus = true } = {}) {
  if (!workspaceDrawer || !workspaceDrawerBackdrop) return;
  workspaceDrawer.hidden = true;
  workspaceDrawerBackdrop.hidden = true;
  workspaceDrawerToggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('workspace-drawer-open');
  workspaceDrawer.classList.remove('workspace-drawer-home');
  workspaceDrawerBackdrop.classList.remove('workspace-drawer-home');
  if (restoreFocus) workspaceDrawerReturnFocus?.focus?.();
}

workspaceDrawerToggle?.addEventListener('click', () => openWorkspaceDrawer(workspaceDrawerToggle));
workspaceProfileControl?.addEventListener('click', () => openWorkspaceDrawer(workspaceProfileControl));
workspaceDrawerClose?.addEventListener('click', () => closeWorkspaceDrawer());
workspaceDrawerBackdrop?.addEventListener('click', () => closeWorkspaceDrawer());
window.addEventListener('resize', () => {
  if (!workspaceDrawer?.hidden) positionHomepageWorkspaceDrawer();
});
workspaceDrawer?.querySelectorAll('[data-view]').forEach((control) => {
  control.addEventListener('click', () => closeWorkspaceDrawer({ restoreFocus: false }));
});
workspaceDrawer?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeWorkspaceDrawer();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...workspaceDrawer.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

function addInternalCommandMenus() {
  document.querySelectorAll('.view:not(#overview) .hazmat-page-hero, .view:not(#overview) .plume-page-header').forEach((hero) => {
    if (hero.querySelector('.internal-command-menu')) return;
    const title = hero.querySelector('.hazmat-hero-title');
    if (!title) return;
    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'command-menu-toggle internal-command-menu';
    menu.setAttribute('aria-label', 'Open command dashboard navigation');
    menu.setAttribute('aria-controls', 'workspace-navigation-drawer');
    menu.setAttribute('aria-expanded', 'false');
    menu.innerHTML = '<span></span><span></span><span></span>';
    menu.addEventListener('click', () => openWorkspaceDrawer(menu));

    const titleRow = document.createElement('div');
    titleRow.className = 'internal-command-title-row';
    title.before(titleRow);
    titleRow.append(menu, title);
  });
}

addInternalCommandMenus();

function showMonitorPanel(targetId) {
  const targetPanel = document.getElementById(targetId);
  if (!targetPanel?.classList.contains('monitor-tab-panel')) return;
  document.querySelectorAll('#monitor-tabs [data-monitor-tab]').forEach((tab) => {
    const active = tab.dataset.monitorTab === targetId;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('#monitor > .monitor-tab-panel').forEach((panel) => {
    const active = panel === targetPanel;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });
}

// Register Monitoring Equipment tabs with the core page navigation so the
// inventory remains reachable even if a later, unrelated module fails to load.
document.getElementById('monitor-tabs')?.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-monitor-tab]');
  if (!tab) return;
  showMonitorPanel(tab.dataset.monitorTab);
});

// MapLibre needs an explicit resize when the responsive plume workspace changes size.
const plumeWorkspace = document.getElementById('plume');
if (plumeWorkspace && 'ResizeObserver' in window) {
  new ResizeObserver(() => {
    if (plumeWorkspace.classList.contains('active')) {
      window.requestAnimationFrame(() => plumeMap?.resize());
    }
  }).observe(plumeWorkspace);
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

document.querySelectorAll('[data-hero-trigger]').forEach((panel) => {
  panel.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    panel.querySelector('.overview-command-primary')?.click();
  });
});

document.querySelectorAll('[data-report-shortcut]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector(`.report-tabs [data-report-tab="${button.dataset.reportShortcut}"]`)?.click();
  });
});

document.querySelectorAll('[data-preplan-name]').forEach((button) => {
  button.addEventListener('click', () => {
    setText('facility-preplan-status', `${button.dataset.preplanName} pre-plan is awaiting upload.`);
  });
});

document.querySelectorAll('.planning-tool-section [data-view]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

// The pre-plan builder lives outside the planning-tool-section grid, but its
// navigation controls still use the same canonical page router.
document.querySelectorAll('.preplan-actions [data-view]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

document.querySelectorAll('[data-planning-status]').forEach((button) => {
  button.addEventListener('click', () => setText('planning-tools-status', button.dataset.planningStatus));
});

const preplanFields = ['name','type','facility','address','occupancy','review-date','status','contacts','access','utilities','fire-water','hazards','tactical','map-zones','event','resources','notes'];
const preplanStoreKey = 'hazmatiq_preplan_records';
const preplanEl = (id) => document.getElementById(`preplan-${id}`);
function readPreplans() { try { const value = JSON.parse(localStorage.getItem(preplanStoreKey) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function setPreplanMessage(message) { setText('preplan-status-message', message); }
function collectPreplan() {
  const existing = preplanEl('id')?.value;
  const now = new Date().toISOString();
  const record = { id: existing || `preplan-${Date.now()}`, createdAt: now, updatedAt: now };
  preplanFields.forEach((field) => { const input = preplanEl(field); if (input) record[field] = input.value.trim(); });
  return record;
}
function openPreplan(record = null) {
  document.getElementById('preplan-builder').hidden = false;
  document.getElementById('preplan-saved-card').hidden = true;
  preplanFields.forEach((field) => { const input = preplanEl(field); if (input) input.value = record?.[field] || (field === 'status' ? 'Draft' : ''); });
  let hiddenId = preplanEl('id'); if (!hiddenId) { hiddenId = document.createElement('input'); hiddenId.type = 'hidden'; hiddenId.id = 'preplan-id'; document.getElementById('preplan-form')?.append(hiddenId); } hiddenId.value = record?.id || '';
}
function renderSavedPreplans() {
  const list = document.getElementById('preplan-saved-list'); if (!list) return; list.replaceChildren();
  const records = readPreplans();
  if (!records.length) { list.textContent = 'No saved pre-plans yet.'; return; }
  records.forEach((record) => { const row = document.createElement('div'); row.className = 'preplan-saved-row'; const title = document.createElement('strong'); title.textContent = record.name || 'Untitled Pre-Plan'; const meta = document.createElement('span'); meta.textContent = `${record.type || 'Facility Pre-Plan'} · ${record.status || 'Draft'}`; const button = document.createElement('button'); button.className = 'ghost-btn'; button.type = 'button'; button.textContent = 'Edit'; button.addEventListener('click', () => openPreplan(record)); row.append(title, meta, button); list.append(row); });
}
document.getElementById('new-preplan-btn')?.addEventListener('click', () => openPreplan());
document.getElementById('pipeline-preplan-btn')?.addEventListener('click', () => {
  openPreplan();
  const type = preplanEl('type');
  if (type) type.value = 'Pipeline Incident Pre-Plan';
  const name = preplanEl('name');
  if (name) name.placeholder = 'Pipeline, operator, or segment name';
  setPreplanMessage('Pipeline planning template opened. Add operator, product, pressure, valve, access, and isolation information.');
});
document.getElementById('open-preplans-btn')?.addEventListener('click', () => { document.getElementById('preplan-saved-card').hidden = false; document.getElementById('preplan-builder').hidden = true; renderSavedPreplans(); });
document.getElementById('preplan-close-btn')?.addEventListener('click', () => { document.getElementById('preplan-builder').hidden = true; });
document.getElementById('preplan-saved-close-btn')?.addEventListener('click', () => { document.getElementById('preplan-saved-card').hidden = true; });
document.getElementById('preplan-form')?.addEventListener('submit', (event) => { event.preventDefault(); const record = collectPreplan(); const records = readPreplans(); const index = records.findIndex((item) => item.id === record.id); if (index >= 0) { record.createdAt = records[index].createdAt; records[index] = record; } else records.unshift(record); localStorage.setItem(preplanStoreKey, JSON.stringify(records)); setPreplanMessage(`Saved ${record.name || 'pre-plan'} locally.`); });
document.getElementById('preplan-print-btn')?.addEventListener('click', () => window.print());
document.getElementById('preplan-send-incident-btn')?.addEventListener('click', () => setPreplanMessage('Pre-plan summary ready to attach when an active incident is selected.'));
document.getElementById('preplan-import-btn')?.addEventListener('click', () => setText('planning-tools-status', 'Document attachments are recorded as links or notes in the pre-plan; credentials are never stored.'));

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
  'incident-operational-mode',
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
const guidedResponseTacticalStorageKey = 'hazmatiq_guided_response_tactical_record';
const noCurrentDataText = 'No Current Data Exists';
const responderText = window.HazMatResponderText || {
  normalizeResponderText: (value) => String(value ?? '').replace(/\s+/g, ' ').trim(),
  normalizeSectionHeading: (value) => String(value ?? '').replace(/\s+/g, ' ').trim(),
  normalizeBulletList: (items) => items.flat(Infinity).map((value) => String(value ?? '').trim()).filter(Boolean),
  formatResponderGuidance: (items) => items.flat(Infinity).map((value) => String(value ?? '').trim()).filter(Boolean),
};
const chemicalProfileText = window.HazMatChemicalProfileText || {
  NO_DATA: noCurrentDataText,
  isEmpty: (value) => !String(value ?? '').trim() || /^(?:none|n\/?a|not available|no data|null|undefined|unknown|no current data exists)\.?$/i.test(String(value).trim()),
  normalizeChemicalProfileText: (value) => responderText.normalizeResponderText(value),
  normalizeGuidanceItems: (items) => responderText.formatResponderGuidance(items),
  normalizeEmptyState: (value) => String(value ?? '').trim() || noCurrentDataText,
  normalizeHeading: (value) => responderText.normalizeSectionHeading(value),
  normalizeSourceLabel: (value) => responderText.normalizeResponderText(value),
};
const readinessStatus = Object.freeze({
  verified: 'Verified Source',
  imported: 'Imported Source',
  planning: 'Planning Estimate',
  manual: 'Manual Entry',
  verify: 'Needs Verification',
  missing: noCurrentDataText,
  blocked: 'Blocked Pending Validation',
});

// Approved household-count display vocabulary. Only methods supported by the
// available evidence are selected below; the remaining labels are reserved for
// future field-verified or reviewed estimation workflows.
const householdEstimateLabels = Object.freeze({
  exact: 'Exact field-verified count',
  building: 'Building-footprint estimate',
  areaWeighted: 'Area-weighted Census estimate',
  censusTotal: 'Census geography total',
  visual: 'Visual map estimate',
});
const ppeSuitWarning = 'PPE recommendations are source-backed planning guidance and must be verified by Incident Command, air monitoring, oxygen concentration, concentration below IDLH/exposure limits, suit compatibility, cartridge suitability, and agency SOPs before entry.';
const medicalProtectiveWarning = 'Verify all medical guidance, protective actions, isolation distances, and evacuation/shelter decisions with official sources, agency SOPs, field observations, and Incident Command.';
const plumePlanningNotices = [
  'HazMatIQ is a decision-support and planning tool. Verify all chemical data, weather data, protective actions, isolation distances, PPE, medical guidance, and plume model outputs with official sources, agency SOPs, field observations, and Incident Command before taking action.',
  'Plume results are planning estimates only and are not a substitute for field monitoring, official modeling, or Incident Command decision-making.',
  'Missing, outdated, or unverified data should be treated as No Current Data Exists until confirmed by an approved source.',
  'Weather data source and observation time must be verified. Stale or manually entered weather can significantly affect plume output.',
];
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

function readIncidentCommandStorage(key, fallback) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function incidentCommandValue(value, fallback = noCurrentDataText) {
  if (Array.isArray(value)) {
    const values = value.map((item) => incidentCommandValue(item, '')).filter(Boolean);
    return values.length ? values.join(' · ') : fallback;
  }
  if (value && typeof value === 'object') {
    const summary = value.summary || value.display || value.label || value.status || value.value;
    return incidentCommandValue(summary, fallback);
  }
  const text = String(value ?? '').trim();
  return text || fallback;
}

function firstChemicalDataValue(...values) {
  return values.find((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    const text = String(value ?? '').trim();
    return text && !/^(?:N\/?A|Not available|No Current Data Exists)$/i.test(text);
  });
}

function selectedChemicalOperationalData({ record = activeChemicalRecord, chemical = activeChemical, incident = null, profile: suppliedProfile } = {}) {
  const profile = suppliedProfile !== undefined
    ? (suppliedProfile || {})
    : (record?.profile || incident?.chemicalProfile || {});
  const advanced = Object.fromEntries(Array.isArray(record?.advanced) ? record.advanced : []);
  const chemicalName = firstChemicalDataValue(
    profile.header?.name,
    record?.name,
    chemical?.name,
    incident?.chemicalName,
  );
  const hazardClass = firstChemicalDataValue(
    profile.header?.hazardClass,
    record?.dotClass,
    advanced['DOT Hazard Class'],
    incident?.hazardClass,
    profile.header?.hazard,
  );
  const idlh = firstChemicalDataValue(
    profile.header?.idlh,
    profile.exposures?.idlh,
    record?.commandFacts?.idlh,
    record?.idlh,
    advanced.IDLH,
    incident?.idlh,
  );
  const niosh = profile.niosh || {};
  return {
    chemicalName,
    selectedChemicalId: firstChemicalDataValue(chemical?.selectedChemicalId, chemical?.id, profile.selectedChemicalId, profile.id, incident?.selectedChemicalId),
    casNumber: firstChemicalDataValue(profile.header?.cas, advanced.CAS, incident?.casNumber),
    unNumber: firstChemicalDataValue(profile.header?.un, record?.un, advanced.UN, incident?.unNumber),
    ergGuide: firstChemicalDataValue(profile.header?.ergGuide, record?.ergGuide, advanced['ERG Guide'], incident?.ergGuide),
    hazardClass,
    primaryHazard: firstChemicalDataValue(profile.header?.hazard, incident?.primaryHazard, hazardClass),
    idlh: idlh ? formatIdlh(idlh) : '',
    nioshSourceId: firstChemicalDataValue(niosh.sourceRecordId, incident?.nioshSourceId),
    nioshIdentityStatus: firstChemicalDataValue(niosh.status, incident?.nioshIdentityStatus),
    chemicalSources: firstChemicalDataValue(
      profile.sources,
      profile.header?.sources,
      incident?.chemicalSources,
    ),
    initialIsolation: firstChemicalDataValue(profile.isolationErg?.initialIsolationDistance, record?.commandFacts?.initialIsolation),
    protectiveAction: firstChemicalDataValue(profile.isolationErg?.protectiveActionDistance, record?.commandFacts?.protectiveAction),
    profile,
  };
}

function cleanIncidentOperationalMode(value) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const modes = {
    HAZMATIQ_ESTIMATE: 'HazMatIQ Estimate',
    HAZMATIQ_VALIDATED: 'HazMatIQ Validated',
    HAZMATIQ_FIELD_VERIFIED: 'HazMatIQ Field Verified',
    ERG_PROTECTIVE_ACTION_OVERLAY_ONLY: 'ERG Overlay Only',
    BLOCKED_MISSING_REQUIRED_DATA: 'Missing Required Data',
    PLANNING_ESTIMATE: 'HazMatIQ Estimate',
  };
  return modes[normalized] || (value ? String(value).replace(/_/g, ' ') : 'Assessment Pending');
}

function incidentCommandSummary(value, fallback, limit = 2) {
  const collect = (candidate) => {
    if (Array.isArray(candidate)) return candidate.flatMap(collect);
    if (candidate && typeof candidate === 'object') {
      const preferredKeys = [
        'items', 'importedGuidance', 'planningEstimates', 'exposureLimits', 'preferredMethod',
        'hazmatPersonnelProcedure', 'technicalDecon', 'firstAid', 'responderHazards',
        'signsSymptoms', 'displayLabel', 'title', 'summary', 'value',
      ];
      return preferredKeys.flatMap((key) => collect(candidate[key]));
    }
    const text = String(candidate ?? '').trim();
    return text && !/^(?:No Current Data Exists|Not available|Data unavailable from current source)$/i.test(text) ? [text] : [];
  };
  const values = [...new Set(collect(value))];
  return values.length ? values.slice(0, limit).join(' · ') : fallback;
}

function incidentCommandMonitoringState(incident) {
  const readings = readIncidentCommandStorage('hazmatiq_monitor_readings', []);
  const assignments = readIncidentCommandStorage('hazmatiq_incident_monitor_assignments', []);
  const incidentReadings = Array.isArray(readings)
    ? readings.filter((reading) => !reading?.incidentId || reading.incidentId === incident?.incidentId)
    : [];
  const incidentAssignments = Array.isArray(assignments)
    ? assignments.filter((assignment) => !assignment?.incidentId || assignment.incidentId === incident?.incidentId)
    : [];
  const latest = [...incidentReadings].sort((a, b) => Date.parse(b.dateTime || b.createdAt || '') - Date.parse(a.dateTime || a.createdAt || ''))[0];
  if (latest) {
    const alarm = incidentCommandValue(latest.alarmState, 'Reading Logged');
    const reading = [latest.sensor, latest.readingValue, latest.unit].filter(Boolean).join(' ');
    return {
      available: true,
      status: /alarm|high|danger/i.test(alarm) && !/no alarm|cleared/i.test(alarm) ? 'Alarm' : 'Active',
      summary: `${incidentAssignments.length || 1} deployed · Latest ${latest.monitorName || 'monitor'}${reading ? `: ${reading}` : ''} · ${alarm}`,
    };
  }
  if (incidentAssignments.length) return {
    available: true,
    status: 'Deployed',
    summary: `${incidentAssignments.length} monitor${incidentAssignments.length === 1 ? '' : 's'} deployed · Awaiting field readings`,
  };
  return { available: false, status: 'Not Deployed', summary: 'No monitors assigned to this incident' };
}

function buildIncidentCommandViewModel() {
  const incident = getActiveIncident();
  if (!incident) return { hasActiveIncident: false };
  const location = [incident.facilityName, incident.address, incident.city, incident.state, incident.zip].filter(Boolean).join(', ');
  const planning = readIncidentCommandStorage(plumePlanningStorageKey, {});
  const plume = incident.plumeModelResults || planning.plumeModelResults || readIncidentCommandStorage('hazmatiq_latest_plume_overlay', null);
  const plumeStatus = plume || incident.plumeMapImage
    ? incident.plumeUpdatedAt ? `Plotted · ${new Date(incident.plumeUpdatedAt).toLocaleString()}` : 'Plotted'
    : noCurrentDataText;
  const operationalMode = cleanIncidentOperationalMode(
    incident.operationalMode
      || incident.plumeConfidenceTier
      || incident.plumeModelResults?.confidenceTier
      || incident.plumeModelResults?.modelMode
      || planning.plumeModelResults?.confidenceTier
      || planning.plumeModelResults?.modelMode
      || incident.operationalMode,
  );
  const weather = incident.weather
    || planning.weather?.conditions
    || [incident.windSpeed && `Wind ${incident.windSpeed} mph`, incident.windDirection && `from ${incident.windDirection}°`].filter(Boolean).join(' ');
  const notes = Array.isArray(incident.incidentNotes) ? incident.incidentNotes : [];
  const monitoring = incidentCommandMonitoringState(incident);
  const activeSelectionMatchesIncident = String(activeChemical?.selectedChemicalId ?? activeChemical?.id ?? '')
    === String(incident.selectedChemicalId ?? '');
  const profile = incident.chemicalProfile
    || (activeSelectionMatchesIncident ? activeChemicalRecord?.profile : null)
    || {};
  const chemicalData = selectedChemicalOperationalData({ incident, profile });
  const hazards = [chemicalData.chemicalName, chemicalData.primaryHazard].filter(Boolean);
  const sourceStatus = incident.sourceStatuses || {};
  const operationalStatus = (value, fallback) => incidentCommandSummary(value, fallback, 1);
  const hazardClass = chemicalData.hazardClass || 'Hazard class pending verification';
  const protectiveSummary = incidentCommandSummary(
    incident.protectiveActionSummary,
    plume ? 'Plume available for protective-action review' : 'Protective-action assessment pending',
  );
  // Prefer the current Chemical Companion domain record over a previously
  // persisted summary. A pending CBRNE/PPE fact must not replace verified
  // ordinary chemical PPE guidance for the same incident.
  const ppeSource = profile.ppeRecommendation || profile.ppeRespiratory || incident.ppeSummary;
  const persistedMedicalSource = incident.medicalSummary || profile.medical;
  const medicalSource = profile.medical || persistedMedicalSource;
  const ppePending = chemicalData.chemicalName ? 'PPE review pending for the identified product' : 'Identify the hazard to calculate PPE requirements';
  const ppeSummary = incidentCommandSummary(
    ppeSource,
    ppePending,
  );
  const deconPending = chemicalData.chemicalName ? 'Product-specific decon review pending' : 'Identify the hazard to load decon guidance';
  const deconSummary = incidentCommandSummary(
    profile.decon,
    deconPending,
  );
  const medicalPending = chemicalData.chemicalName ? 'Medical guidance review pending' : 'Identify the hazard to load medical guidance';
  const medicalSummary = incidentCommandSummary(
    medicalSource,
    medicalPending,
  );
  const hasPpe = ppeSummary !== ppePending;
  const hasDecon = deconSummary !== deconPending;
  const hasMedical = medicalSummary !== medicalPending;
  const facilitySummary = location
    ? `${incident.facilityName || 'Scene location'} identified${incident.address ? ` · ${incident.address}` : ''}`
    : 'No facility or scene location linked';
  const tacticalStatus = [
    { id: 'protective', icon: '🛡️', label: 'Protective Actions', available: Boolean(incident.protectiveActionSummary || plume), status: operationalStatus(sourceStatus.protectiveActions, incident.protectiveActionSummary ? 'Available' : 'Assessment Pending'), summary: protectiveSummary, actionLabel: 'Open', target: 'details' },
    { id: 'ppe', icon: '🥽', label: 'PPE Requirements', available: hasPpe, status: operationalStatus(ppeSource?.status || ppeSource?.recommendationStatus, hasPpe ? 'Source Backed' : 'Review Pending'), summary: ppeSummary, actionLabel: 'Open', target: 'lookup' },
    { id: 'decon', icon: '💧', label: 'Decon', available: hasDecon, status: hasDecon ? 'Available' : 'Review Pending', summary: deconSummary, actionLabel: 'Open', target: 'lookup' },
    { id: 'medical', icon: '❤️', label: 'Medical', available: hasMedical, status: operationalStatus(medicalSource?.status, hasMedical ? 'Available' : 'Review Pending'), summary: medicalSummary, actionLabel: 'Open', target: 'lookup', lifeSafety: true },
    { id: 'eplan', icon: '🏭', label: 'Facility / E-Plan', available: Boolean(location), status: incident.facilityName ? 'Facility Identified' : (location ? 'Scene Located' : 'Not Linked'), summary: facilitySummary, actionLabel: 'Review', target: 'details' },
    { id: 'plume', icon: '☁️', label: 'Plume', available: Boolean(plume || incident.plumeMapImage), status: plume || incident.plumeMapImage ? 'Plotted' : 'Not Plotted', summary: plume || incident.plumeMapImage ? plumeStatus : 'No plume run saved for this incident', actionLabel: plume || incident.plumeMapImage ? 'View' : 'Plot', target: 'plume' },
    { id: 'monitoring', icon: '📡', label: 'Monitoring', available: monitoring.available, status: monitoring.status, summary: monitoring.summary, actionLabel: monitoring.available ? 'Open' : 'Deploy', target: 'monitor' },
  ];
  return {
    hasActiveIncident: true,
    incidentId: incident.incidentId,
    incidentName: incidentCommandValue(incident.incidentName),
    status: incidentCommandValue(incident.status, 'Active'),
    location: incidentCommandValue(location, 'Location not set'),
    coordinates: Number.isFinite(Number(incident.latitude)) && Number.isFinite(Number(incident.longitude)) ? { lat: Number(incident.latitude), lon: Number(incident.longitude) } : null,
    startTime: incident.startedAt || [incident.startDate, incident.startTime].filter(Boolean).join(' '),
    elapsedTime: getIncidentElapsedTime(incident),
    hazards,
    hazardClass: incidentCommandValue(hazardClass),
    primaryHazard: incidentCommandValue(chemicalData.primaryHazard, 'Hazard classification pending'),
    idlh: incidentCommandValue(chemicalData.idlh, 'IDLH not established for this incident'),
    nioshSourceId: incidentCommandValue(chemicalData.nioshSourceId, ''),
    nioshIdentityStatus: incidentCommandValue(chemicalData.nioshIdentityStatus, ''),
    operationalMode,
    protectiveActionsSummary: protectiveSummary,
    entryTeamPpe: ppeSummary,
    deconTeamPpe: deconSummary,
    medicalConcerns: medicalSummary,
    plumeStatus,
    weatherSnapshot: incidentCommandValue(weather, location ? 'Location available; live weather not loaded' : 'Location needed for live weather'),
    monitoringStatus: monitoring.summary,
    keyTacticalNotes: incidentCommandValue(incident.notes || notes.at(-1)?.text, 'No tactical notes entered'),
    lastUpdated: incident.updatedAt ? new Date(incident.updatedAt).toLocaleString() : 'Not yet updated',
    notes,
    tacticalStatus,
    completedReports: readIncidents().filter((item) => item.status === 'Completed').slice(0, 4),
    incident,
  };
}

function incidentCommandStatusClass(status) {
  const normalized = String(status).toLowerCase();
  if (/completed|verified|available|source backed|imported|facility identified/.test(normalized)) return 'is-available';
  if (/active|plotted|deployed|scene located|planning estimate/.test(normalized)) return 'is-active';
  if (/blocked|missing|no current/.test(normalized)) return 'is-missing';
  if (/review|not started|not plotted|not linked|not deployed|pending|draft/.test(normalized)) return 'is-review';
  return '';
}

function renderIncidentGuidedResponse(model) {
  const priorities = document.getElementById('ic-guided-priorities');
  const recommendations = document.getElementById('ic-guided-recommendations');
  const progress = document.getElementById('ic-guided-progress');
  if (!priorities || !recommendations || !progress) return;

  const priorityItems = [
    ['Confirm product identity', model.hazards.length > 0, 'lookup'],
    ['Establish protective actions', model.tacticalStatus[0]?.available, 'details'],
    ['Select and verify PPE', model.entryTeamPpe !== noCurrentDataText && !/pending|identify/i.test(model.entryTeamPpe), 'lookup'],
    ['Establish decontamination', model.deconTeamPpe !== noCurrentDataText && !/pending|identify/i.test(model.deconTeamPpe), 'lookup'],
    ['Initiate field monitoring', model.monitoringStatus !== 'No monitors assigned to this incident', 'monitor'],
  ];
  priorities.replaceChildren();
  priorityItems.forEach(([label, complete, target]) => {
    const item = document.createElement('li');
    item.className = complete ? 'is-complete' : 'is-pending';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.commandView = target;
    button.textContent = complete ? '✓' : '○';
    button.setAttribute('aria-label', `${complete ? 'Complete' : 'Pending'}: ${label}`);
    const text = document.createElement('span');
    text.textContent = label;
    item.append(button, text);
    priorities.append(item);
  });

  const recommendationsList = [
    ['Protective actions', model.protectiveActionsSummary, model.tacticalStatus[0]?.status],
    ['PPE and entry', model.entryTeamPpe, model.tacticalStatus[1]?.status],
    ['Threat zone', model.plumeStatus, model.tacticalStatus[5]?.status],
    ['Medical review', model.medicalConcerns, model.tacticalStatus[3]?.status],
  ];
  recommendations.replaceChildren();
  recommendationsList.forEach(([label, summary, status]) => {
    const row = document.createElement('div');
    const title = document.createElement('strong');
    const detail = document.createElement('span');
    const state = document.createElement('small');
    title.textContent = label;
    detail.textContent = summary;
    state.textContent = status;
    row.append(title, detail, state);
    recommendations.append(row);
  });

  const savedRecord = model.incident.guidedResponseTacticalRecord;
  const progressItems = [
    ['Incident established', true],
    ['Chemical verified', model.hazards.length > 0],
    ['Guided decision record', Boolean(savedRecord)],
    ['Plume assessment', Boolean(model.incident.plumeModelResults || model.incident.plumeMapImage)],
  ];
  progress.replaceChildren();
  progressItems.forEach(([label, complete]) => {
    const row = document.createElement('div');
    const state = document.createElement('span');
    const title = document.createElement('strong');
    row.className = complete ? 'is-complete' : 'is-pending';
    state.textContent = complete ? 'COMPLETE' : 'PENDING';
    title.textContent = label;
    row.append(state, title);
    progress.append(row);
  });
}

function renderIncidentCommandDashboard() {
  const model = buildIncidentCommandViewModel();
  const empty = document.getElementById('incident-command-empty');
  const active = document.getElementById('incident-command-active');
  if (!empty || !active) return;
  empty.hidden = model.hasActiveIncident;
  active.hidden = !model.hasActiveIncident;
  if (!model.hasActiveIncident) return;

  const incidentNameInput = document.getElementById('incidentName');
  if (incidentNameInput && document.activeElement !== incidentNameInput) incidentNameInput.value = model.incidentName === 'Incident not named' ? '' : model.incidentName;
  const locationInput = document.getElementById('incident-address-input');
  if (locationInput && document.activeElement !== locationInput) locationInput.value = model.incident.address || '';
  const productInput = document.getElementById('incident-product');
  if (productInput && document.activeElement !== productInput) productInput.value = model.incident.chemicalName || '';
  const modeInput = document.getElementById('incident-operational-mode');
  if (modeInput) modeInput.value = model.incident.operationalMode || 'Research & Assessment';
  setText('ic-summary-elapsed', model.elapsedTime);
  const realTime = document.getElementById('ic-real-time');
  if (realTime) {
    const now = new Date();
    realTime.dateTime = now.toISOString();
    realTime.textContent = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()} ${now.toLocaleTimeString()}`;
  }

  const brief = document.getElementById('ic-brief-list');
  brief?.replaceChildren();
  [
    ['Incident Name', model.incidentName], ['Status', model.status], ['Location', model.location],
    ['Date / Time Started', model.startTime ? new Date(model.startTime).toLocaleString() : noCurrentDataText],
    ['Elapsed Time', model.elapsedTime], ['Chemical(s) / Hazard(s)', incidentCommandValue(model.hazards)], ['Hazard Class', model.hazardClass],
    ['Primary Hazard', model.primaryHazard, true], ['IDLH', model.idlh, true, 'idlh'],
    ['IDLH Source', model.nioshSourceId ? `NIOSH · ${model.nioshSourceId}` : noCurrentDataText], ['Operational Mode', model.operationalMode],
    ['Protective Actions Summary', model.protectiveActionsSummary], ['Entry Team PPE', model.entryTeamPpe],
    ['DECON Team PPE', model.deconTeamPpe], ['Medical Concerns', model.medicalConcerns, true],
    ['Plume / Threat Zone Status', model.plumeStatus], ['Weather Snapshot', model.weatherSnapshot],
    ['Monitoring Status', model.monitoringStatus], ['Key Tactical Notes', model.keyTacticalNotes], ['Last Updated', model.lastUpdated],
  ].forEach(([labelText, value, lifeSafety, field]) => {
    const row = document.createElement('div');
    if (lifeSafety) row.classList.add('is-life-safety');
    if (field) row.dataset.field = field;
    const label = document.createElement('dt');
    label.textContent = labelText;
    const detail = document.createElement('dd');
    detail.textContent = value;
    row.append(label, detail);
    brief?.append(row);
  });

  const tactical = document.getElementById('ic-tactical-list');
  tactical?.replaceChildren();
  model.tacticalStatus.forEach((item) => {
    const row = document.createElement('div');
    row.className = `incident-command-tactical-row${item.lifeSafety ? ' is-life-safety' : ''}`;
    row.dataset.tacticalId = item.id;
    const identity = document.createElement('strong');
    identity.textContent = item.label;
    const badge = document.createElement('span');
    badge.className = `incident-command-badge ${incidentCommandStatusClass(item.status)}`;
    badge.textContent = item.status;
    const summary = document.createElement('p');
    summary.textContent = item.summary;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.actionLabel;
    button.dataset.commandView = item.target;
    button.setAttribute('aria-label', `${item.actionLabel} ${item.label}`);
    row.append(identity, badge, summary, button);
    tactical?.append(row);
  });
  renderIncidentGuidedResponse(model);

  const report = document.getElementById('ic-current-report');
  if (report) {
    const name = document.createElement('strong');
    name.textContent = model.incidentName;
    const type = document.createElement('span');
    type.textContent = 'Incident Report';
    const updated = document.createElement('small');
    updated.textContent = `Updated: ${model.lastUpdated}`;
    report.replaceChildren(name, type, updated);
  }
  const recent = document.getElementById('ic-recent-reports');
  recent?.replaceChildren();
  if (!model.completedReports.length && recent) recent.textContent = 'No completed reports yet';
  model.completedReports.forEach((item) => {
    const row = document.createElement('div');
    const text = document.createElement('span');
    text.textContent = `${item.incidentName || 'Incident'} · ${item.completedAt ? new Date(item.completedAt).toLocaleString() : 'Completed'}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'View';
    button.dataset.incidentReportId = item.incidentId;
    row.append(text, button);
    recent?.append(row);
  });

  setText('ic-detail-notes', model.notes.length ? model.notes.map((note) => `${new Date(note.createdAt).toLocaleString()} — ${note.text}`).join(' · ') : model.keyTacticalNotes);
  setText('ic-detail-weather', model.weatherSnapshot);
  setText('ic-detail-plume', model.plumeStatus);
  setText('ic-detail-monitoring', model.monitoringStatus);
  setText('ic-detail-protective', model.protectiveActionsSummary);
  setText('ic-detail-safety', `PPE: ${model.entryTeamPpe} · Decon: ${model.deconTeamPpe} · Medical: ${model.medicalConcerns}`);
  setText('ic-detail-reports', model.completedReports.length ? `${model.completedReports.length} recent completed report${model.completedReports.length === 1 ? '' : 's'}` : 'No completed reports yet');
}

function renderSystemNotification() {
  syncCommandBarContext();
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
  const active = Boolean(getActiveIncident());
  setText('plume-mode-summary', active ? 'Active Incident Mode' : 'Planning Mode');
}

function readPlanningState() {
  try {
    return JSON.parse(window.localStorage.getItem(plumePlanningStorageKey) || '{}');
  } catch {
    return {};
  }
}

function savePlanningState(update) {
  try {
    const current = readPlanningState();
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
  renderIncidentCommandDashboard();
  renderSystemNotification();
}

function startIncidentTimer() {
  renderIncidentTimer();
  if (!incidentTimerInterval) incidentTimerInterval = window.setInterval(renderIncidentTimer, 1000);
}

function getIncidentFormData() {
  const coordinates = parseGpsCoordinate(document.getElementById('incident-coordinates-input')?.value);
  const containerSelect = document.getElementById('plume-container-type');
  const existingIncident = getActiveIncident();
  const selectionMatchesIncident = String(activeChemical?.selectedChemicalId ?? '') === String(existingIncident?.selectedChemicalId ?? '');
  const chemicalProfile = activeChemicalRecord?.profile
    || (selectionMatchesIncident ? existingIncident?.chemicalProfile : null)
    || null;
  const chemicalData = selectedChemicalOperationalData({
    record: activeChemicalRecord,
    chemical: activeChemical,
    incident: selectionMatchesIncident ? existingIncident : null,
    profile: chemicalProfile,
  });
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
    weatherSource: document.getElementById('plume-weather-source-name')?.textContent?.trim() || noCurrentDataText,
    weatherObservationTime: document.getElementById('plume-weather-observation-time')?.textContent?.trim() || noCurrentDataText,
    weatherSourceStatus: document.getElementById('plume-weather-source')?.value === 'manual'
      ? readinessStatus.manual
      : (document.getElementById('plume-weather-source-state')?.textContent?.trim() || readinessStatus.verify),
    windSpeed: document.getElementById('plume-wind-speed')?.value || latestPlumeWeather?.windSpeedMph || '',
    windDirection: document.getElementById('plume-wind-direction')?.value || latestPlumeWeather?.windDirDeg || '',
    chemicalName: chemicalData.chemicalName || document.getElementById('incident-product')?.value.trim() || '',
    operationalMode: document.getElementById('incident-operational-mode')?.value || existingIncident?.operationalMode || 'Research & Assessment',
    selectedChemicalId: chemicalData.selectedChemicalId ?? null,
    casNumber: chemicalData.casNumber || '',
    unNumber: chemicalData.unNumber || '',
    ergGuide: chemicalData.ergGuide || '',
    idlh: chemicalData.idlh || '',
    nioshSourceId: chemicalData.nioshSourceId || '',
    nioshIdentityStatus: chemicalData.nioshIdentityStatus || '',
    chemicalSources: chemicalProfile ? chemicalProfileSources(chemicalProfile) : (existingIncident?.chemicalSources || []),
    hazardClass: chemicalData.hazardClass || '',
    primaryHazard: chemicalData.primaryHazard || '',
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
    sourceStatuses: {
      chemical: chemicalProfile ? readinessStatus.imported : readinessStatus.missing,
      weather: document.getElementById('plume-weather-source')?.value === 'manual' ? readinessStatus.manual : readinessStatus.verify,
      plume: existingIncident?.plumeModelResults ? readinessStatus.planning : readinessStatus.missing,
      ppe: existingIncident?.ppeSummary?.status || readinessStatus.missing,
      medical: existingIncident?.medicalSummary?.status || readinessStatus.missing,
      protectiveActions: existingIncident?.protectiveActionSummary?.status || readinessStatus.missing,
    },
    safetyDisclaimers: {
      decisionSupport: plumePlanningNotices[0],
      plume: plumePlanningNotices[1],
      missingData: plumePlanningNotices[2],
      weather: plumePlanningNotices[3],
      ppeSuit: ppeSuitWarning,
      medicalProtectiveActions: medicalProtectiveWarning,
    },
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
  renderIncidentCommandDashboard();
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
  heading.textContent = responderText.normalizeSectionHeading(title);
  const list = document.createElement('dl');
  applicable.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'report-summary-row';
    row.dataset.field = String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const term = document.createElement('dt');
    term.textContent = responderText.normalizeSectionHeading(label);
    const description = document.createElement('dd');
    if (Array.isArray(value)) {
      const bullets = document.createElement('ul');
      responderText.formatResponderGuidance(value).forEach((item) => {
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
    ['IDLH source', profile.niosh?.status === 'VERIFIED_NIOSH' && profile.niosh?.sourceRecordId
      ? `NIOSH · ${profile.niosh.sourceRecordId}` : ''],
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
  ['windSpeed', 'Wind speed (mph)', 'text'],
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
    ['Wind speed (mph)', incident.windSpeed],
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
  void refreshCommandWeather({ requestGps: false });
}

async function reverseGeocodeIncidentGps(gps) {
  const query = new URLSearchParams({
    f: 'json',
    location: `${gps.lon},${gps.lat}`,
    outFields: 'Address,City,Region,RegionAbbr,Postal',
    forStorage: 'false',
  });
  const result = await fetchJson(`${arcgisGeocoderUrl}/reverseGeocode?${query}`);
  const address = result?.address;
  if (!address) return false;
  const values = {
    'incident-address-input': address.Address || address.ShortLabel || '',
    'incident-city': address.City || '',
    'incident-state': address.RegionAbbr || address.Region || '',
    'incident-zip': address.Postal || '',
  };
  Object.entries(values).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  });
  clearIncidentAddressSuggestions();
  updateActiveIncidentRecord();
  return true;
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

document.getElementById('incident-coordinates-input')?.addEventListener('change', () => {
  void refreshCommandWeather({ requestGps: false });
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
document.getElementById('ic-save-incident-name')?.addEventListener('click', () => {
  const nameInput = document.getElementById('incidentName');
  if (!nameInput?.reportValidity()) {
    setIncidentStatus('Enter an Incident Name before saving.');
    nameInput?.focus();
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

const incidentCommandDashboard = document.querySelector('.incident-command-dashboard');
const incidentNoteDialog = document.getElementById('incident-note-dialog');

function openCurrentIncidentReport() {
  const active = getActiveIncident();
  if (!active) return;
  showView('report');
  document.querySelector('[data-report-tab="current"]')?.click();
  openIncidentSummary(active.incidentId);
}

incidentCommandDashboard?.addEventListener('click', (event) => {
  const reportButton = event.target.closest('[data-incident-report-id]');
  if (reportButton) {
    showView('report');
    openIncidentSummary(reportButton.dataset.incidentReportId);
    return;
  }
  const tacticalButton = event.target.closest('[data-command-view]');
  if (tacticalButton) {
    const target = tacticalButton.dataset.commandView;
    if (target === 'details') {
      const details = document.querySelector('.incident-command-operational-details');
      if (details) details.open = true;
      details?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (target === 'plume') openPlumeWorkspace({ sourcePage: 'incident', incident: getActiveIncident() });
    else if (target === 'guided-response') void openGuidedResponseWorkspace();
    else if (target) showView(target);
    return;
  }
  const control = event.target.closest('[data-incident-command-action]');
  if (!control) return;
  const action = control.dataset.incidentCommandAction;
  if (action === 'start') {
    beginNewIncident({ createRecord: true });
    renderIncidentCommandDashboard();
  } else if (action === 'note') {
    document.getElementById('incident-command-note').value = '';
    setText('incident-note-status', '');
    incidentNoteDialog?.showModal();
  } else if (action === 'complete') {
    document.getElementById('complete-incident-dialog')?.showModal();
  } else if (action === 'open-report' || action === 'generate-report' || action === 'export-package') {
    openCurrentIncidentReport();
  } else if (action === 'ics') {
    showView('report');
    document.querySelector('[data-report-tab="current"]')?.click();
    document.getElementById('active-ics-form-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

document.getElementById('ic-edit-scene-btn')?.addEventListener('click', () => {
  document.getElementById('incident')?.classList.toggle('show-incident-editor');
  document.querySelector('.incident-input-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('cancel-incident-note-btn')?.addEventListener('click', () => incidentNoteDialog?.close());
document.getElementById('save-incident-note-btn')?.addEventListener('click', () => {
  const input = document.getElementById('incident-command-note');
  const text = input?.value.trim();
  const incident = getActiveIncident();
  if (!incident || !text) {
    setText('incident-note-status', incident ? 'Enter a tactical note before saving.' : 'No active incident is available.');
    return;
  }
  const incidents = readIncidents();
  const index = incidents.findIndex((item) => item.incidentId === incident.incidentId);
  if (index < 0) return;
  const createdAt = new Date().toISOString();
  incidents[index] = {
    ...incidents[index],
    incidentNotes: [...(Array.isArray(incidents[index].incidentNotes) ? incidents[index].incidentNotes : []), { text, createdAt }],
    updatedAt: createdAt,
  };
  writeIncidents(incidents);
  renderIncidentLists();
  incidentNoteDialog?.close();
});

// ─── Chemical lookup/card: backed by the real API (207-chemical dataset, NPG, thresholds) ───

async function fetchJson(url, { timeoutMs = 15000 } = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timeout !== null) window.clearTimeout(timeout);
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

function isChemicalCompanionSelection(chemical) {
  const candidate = chemical?.selectedChemicalId ?? chemical?.ChemicalID ?? chemical?.id;
  return /^\d+$/.test(String(candidate ?? '').trim()) && Number(candidate) > 0;
}

function normalizeChemicalSelectionId(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim();
  return /^\d+$/.test(normalized) && Number(normalized) > 0 ? Number(normalized) : value;
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
      idlh: exposureLimits.idlh ? formatIdlh(exposureLimits.idlh) : null,
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
    // Companion selections load authoritative NIOSH linkage from the primary
    // profile endpoint. Legacy enrichment must not manufacture a linkage
    // warning while that independent request is in flight or unavailable.
    idlh: exposureLimits.idlh ? formatIdlh(exposureLimits.idlh) : 'N/A',
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
      ['Melting Point', physical.mp ? formatTemperatureMeasurement(formatTempFahrenheit(physical.mp)) : 'N/A'],
      ['Boiling Point', physical.bp ? formatTemperatureMeasurement(formatTempFahrenheit(physical.bp)) : 'N/A'],
      ['Vapor Pressure', physical.vpMmHg ? `${physical.vpMmHg} mmHg` : 'N/A'],
      ['Specific Gravity', physical.sg ? `${physical.sg} (water = 1)` : 'N/A'],
      ['Flash Point', physical.flPt ? formatTemperatureMeasurement(formatTempFahrenheit(physical.flPt)) : 'N/A'],
      ['LEL / UEL', (physical.lel || physical.uel) ? formatExplosiveLimits(`${physical.lel || '—'} / ${physical.uel || '—'}`) : 'N/A'],
      ['NIOSH REL', exposureLimits.rel || 'N/A'],
      ['OSHA PEL', exposureLimits.pel || 'N/A'],
      ['IDLH', exposureLimits.idlh ? formatIdlh(exposureLimits.idlh) : 'N/A'],
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
  const npgRequest = isChemicalCompanionSelection(chem)
    ? Promise.resolve(null)
    : fetchJson(`/api/npg/${encodeURIComponent(chem.id)}`);
  const [npg, thresholdsData, guideLibrary, ergTable] = await Promise.all([
    npgRequest,
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

/*
 * Hazard ID profile contract
 *
 * Chemical Companion and the CBRNE starter adapter intentionally have
 * different source shapes. Keep that distinction at the API boundary: the
 * renderers consume this defensive view model and never have to decide
 * whether an optional field was an array, object, scalar, or null.
 */
function profileObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function profileArray(value) {
  if (Array.isArray(value)) return value.flat(Infinity).filter((item) => item !== null && item !== undefined);
  return value === null || value === undefined || value === '' ? [] : [value];
}

function profileFacts(value) {
  return profileArray(value)
    .filter((fact) => fact && typeof fact === 'object')
    .map((fact) => ({
      ...fact,
      limitations: profileArray(fact.limitations),
    }));
}

function uniqueProfileFacts(facts) {
  const seen = new Set();
  return facts.filter((fact) => {
    const key = `${fact.id || ''}|${fact.fieldName || ''}|${fact.value ?? ''}|${fact.sourceArtifactId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function profileFactsForGroups(profile, groups) {
  const requested = new Set(groups);
  return profileFacts(profile?.sourceFacts).filter((fact) => requested.has(fact.fieldGroup));
}

function physicsProfileFacts(profile) {
  const physics = profileObject(profile?.radionuclidePhysics);
  if (!Object.keys(physics).length) return [];
  const facts = [
    ['Nuclide', physics.nndcName || physics.canonicalNuclideId],
    ['Element', [physics.element, physics.elementSymbol].filter(Boolean).join(' · ')],
    ['Atomic / neutron number', [physics.atomicNumber, physics.neutronNumber].filter((value) => value !== null && value !== undefined).join(' / ')],
    ['Mass number', physics.massNumber],
    ['Half-life', [physics.halfLifeOriginal, physics.halfLifeValue, physics.halfLifeUnits].filter(Boolean).join(' · ')],
    ['Decay modes', profileArray(physics.decayModes).map((mode) => profileObject(mode).decayMode || mode).join(' · ')],
    ['Adopted dataset', profileObject(physics.adoptedDataset).datasetName],
    ['Physics review status', physics.reviewStatus],
  ];
  return facts.filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([fieldName, value], index) => ({
      id: `${profile?.id || 'radionuclide'}-physics-${index}`,
      recordId: profile?.id,
      fieldGroup: 'TECHNICAL_OPERATIONS',
      fieldName,
      value,
      sourceName: profileArray(physics.sourceArtifacts).length ? 'NNDC NuDat' : 'Manual Review',
      sourceArtifactId: profileArray(physics.sourceArtifacts)[0],
      verificationStatus: physics.reviewStatus || 'Requires SME Review',
      notes: profileArray(physics.limitations).join(' · '),
      limitations: profileArray(physics.limitations),
    }));
}

function normalizeChemicalProfileForUi(profile, fallback = {}) {
  const raw = profileObject(profile?.profile || profile);
  const source = profileObject(raw);
  const section = (name) => profileObject(source[name]);
  const listFields = {
    exposures: ['routes', 'symptoms', 'targetOrgans', 'acuteNotes', 'monitoringConcerns'],
    reactivity: ['incompatibilities', 'polymerizationRisk', 'waterReactivity', 'oxidizerReducerConcerns', 'decompositionProducts'],
    fire: ['extinguishingMedia', 'firefightingPrecautions', 'vaporBehavior', 'explosionHazards', 'runoffConcerns'],
    decon: ['preferredMethod', 'hazmatPersonnelProcedure', 'waterReactiveCautions', 'grossDecon', 'technicalDecon', 'patientVictimDecon', 'equipmentDecon', 'runoffContainment', 'sourceBasis'],
    medical: ['signsSymptoms', 'firstAid', 'emsConsiderations', 'antidotes', 'treatmentNotes', 'responderHazards', 'contaminatedPatientHandling'],
    properties: ['synonyms', 'characteristics'],
    detectors: ['items', 'pidRelevance', 'lelMeterRelevance', 'colorimetricTubes', 'electrochemicalSensors', 'limitations'],
    isolationErg: ['protectiveActionDistance', 'dayNightValues', 'ergTable1', 'ergTable2', 'ergTable3'],
  };
  const normalizedSections = Object.fromEntries(Object.entries(listFields).map(([name, fields]) => {
    const value = { ...section(name) };
    fields.forEach((field) => { value[field] = profileArray(value[field]); });
    return [name, value];
  }));
  const header = profileObject(source.header);
  const fallbackHeader = profileObject(fallback.header);
  const sourceCandidates = [
    profileArray(source.sources),
    profileArray(source.sourceLabels),
    profileArray(source.header?.sources),
    profileArray(fallback.summarySources),
  ];
  const sources = (sourceCandidates.find((candidate) => candidate.length) || []).filter(Boolean);
  return {
    ...source,
    kind: 'chemical',
    id: source.id ?? fallback.id ?? fallback.selectedChemicalId,
    selectedChemicalId: source.selectedChemicalId ?? fallback.selectedChemicalId,
    header: {
      ...fallbackHeader,
      ...header,
      name: header.name || fallback.name || fallback.ChemicalName || 'Select a chemical',
      cas: header.cas || fallback.cas || fallback.CasNumber || '',
      un: header.un || fallback.un || fallback.UnnaNumber || '',
      ergGuide: header.ergGuide || fallback.ergGuide || fallback.ErgNumber || '',
      sources,
    },
    properties: normalizedSections.properties,
    exposures: normalizedSections.exposures,
    reactivity: normalizedSections.reactivity,
    fire: normalizedSections.fire,
    decon: normalizedSections.decon,
    medical: normalizedSections.medical,
    detectors: normalizedSections.detectors,
    isolationErg: normalizedSections.isolationErg,
    ppeRecommendation: profileObject(source.ppeRecommendation),
    sourceLabels: sources,
  };
}

function normalizeHazardProfileForUi(profile) {
  const source = profileObject(profile);
  const facts = profileFacts(source.sourceFacts);
  const groups = (existing, fieldGroups) => uniqueProfileFacts([
    ...profileFacts(existing),
    ...profileFactsForGroups(source, fieldGroups),
  ]);
  const physicsFacts = physicsProfileFacts(source);
  const radiological = source.lane === 'RADIOLOGICAL';
  const category = String(source.category || 'UNKNOWN').replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toLocaleUpperCase());
  return {
    ...source,
    kind: 'hazard',
    id: source.id || '',
    displayName: source.displayName || 'Select a hazard',
    category,
    identifiers: profileObject(source.identifiers),
    overviewFacts: groups(source.overviewFacts, ['IDENTITY']),
    hazardFacts: groups(source.hazardFacts, ['HAZARDS', 'SYMPTOMS']),
    detectionFacts: groups(source.detectionFacts, ['DETECTION', 'RADIOLOGICAL_SURVEY']),
    samplingFacts: groups(source.samplingFacts, ['SAMPLING']),
    analysisFacts: groups(source.analysisFacts, ['ANALYSIS']),
    ppeFacts: groups(source.ppeFacts, ['PPE']),
    isolationStandoffFacts: groups(source.isolationStandoffFacts, ['ISOLATION_STANDOFF', 'PROTECTIVE_ACTION']),
    protectiveActionFacts: groups(source.protectiveActionFacts, ['PROTECTIVE_ACTION']),
    deconFacts: groups(source.deconFacts, ['DECON']),
    medicalFacts: groups(source.medicalFacts, ['MEDICAL']),
    technicalOperationsFacts: groups(source.technicalOperationsFacts, ['TECHNICAL_OPERATIONS', 'LIMITATIONS']),
    physicsFacts,
    radOperationsFacts: uniqueProfileFacts([...groups([], ['RADIOLOGICAL_SURVEY', 'ISOLATION_STANDOFF', 'PROTECTIVE_ACTION', 'TECHNICAL_OPERATIONS']), ...physicsFacts]),
    sourceFacts: facts,
    limitations: profileArray(source.limitations),
    dataStatusBadges: profileArray(source.dataStatusBadges),
    actionCards: profileArray(source.actionCards).filter((card) => card && typeof card === 'object'),
    sourceStatus: profileObject(source.sourceStatus),
    sourceStatusDomains: profileObject(source.sourceStatusDomains),
    summary: profileArray([
      ...groups(source.overviewFacts, ['IDENTITY']),
      ...groups(source.hazardFacts, ['HAZARDS']),
    ]).slice(0, 4),
    profileTypeLabel: radiological ? 'Radiological / Nuclear' : source.domain === 'BIOLOGICAL' ? 'Biological' : 'CBRNE / CWA',
  };
}

function normalizeProfileForUi(profile, fallback = {}) {
  const source = profileObject(profile?.profile || profile);
  return source.lane === 'CBRNE_CWA' || source.lane === 'RADIOLOGICAL'
    ? normalizeHazardProfileForUi(source)
    : normalizeChemicalProfileForUi(profile, fallback);
}

function chemicalFrontlineValues(value, predicate = () => true, limit = 5) {
  return [...new Set(profileArray(value)
    .filter(hasMeaningfulChemicalProfileData)
    .filter(predicate)
    .map((item) => normalizeDataSourceOutput(item))
    .filter(Boolean))].slice(0, limit);
}

function chemicalFrontlineRows(profile) {
  const header = profileObject(profile?.header);
  const recommendation = profileObject(profile?.ppeRecommendation);
  const ppe = profileObject(profile?.ppeRespiratory);
  const response = profileObject(profile?.response);
  const isolation = profileObject(profile?.isolationErg);
  const fire = profileObject(profile?.fire);
  const rows = [];
  const add = (label, value) => {
    if (hasMeaningfulChemicalProfileData(value)) rows.push({ label, value });
  };

  add('PPE / respiratory protection', recommendation.displayLabel || recommendation.respiratoryProtection || ppe.bestMatch);
  if (recommendation.scbaRequired && hasMeaningfulChemicalProfileData(recommendation.respiratoryProtection)) {
    add('SCBA requirement', recommendation.respiratoryProtection);
  }
  add('Protection-level basis', chemicalFrontlineValues(recommendation.decisionReasons));

  add('Isolation / protective action', chemicalFrontlineValues([
    isolation.initialIsolationDistance,
    isolation.protectiveActionDistance,
  ], () => true, 3));

  add('Fire considerations', chemicalFrontlineValues([
    fire.flammability,
    fire.firefightingPrecautions,
    fire.explosionHazards,
    fire.runoffConcerns,
  ], () => true, 3));

  const sceneCautions = chemicalFrontlineValues([
    ...chemicalFrontlineValues(response.publicSafety, (item) => /upwind|uphill|upstream|unauthorized|ground|confined|sewer|basement|tank/i.test(item)),
    ...chemicalFrontlineValues(response.spillOrLeak),
    ...chemicalFrontlineValues(response.healthHazards, (item) => /toxic|corrosive|vapor|gas|frostbite|oxygen|confined/i.test(item)),
  ]);
  add('Entry / scene cautions', sceneCautions);

  add('Identity / verification', chemicalFrontlineValues([
    header.cas ? `CAS ${header.cas}` : '',
    header.ergGuide ? `ERG Guide ${header.ergGuide}` : '',
    profile.identificationSupport,
    profile.confirmationGuidance,
    profile.fieldIdentification,
  ], () => true, 3));
  return rows;
}

function hasAvailableProfileData(value) {
  if (Array.isArray(value)) return value.some(hasAvailableProfileData);
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return Object.values(value).some(hasAvailableProfileData);
  const text = String(value).trim();
  if (!text) return false;
  if (/^(?:not available|n\/?a|not established|null|undefined)(?:\s*[/|·—–-]\s*(?:not available|n\/?a|not established|null|undefined))*$/i.test(text)) return false;
  if (/^[^:]+:\s*(?:not available|n\/a|not established|null|undefined)$/i.test(text)) return false;
  if (/^no\s+.+\s+(?:available|record available)$/i.test(text)) return false;
  return true;
}

function hasMeaningfulChemicalProfileData(value) {
  if (Array.isArray(value)) return value.some(hasMeaningfulChemicalProfileData);
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulChemicalProfileData);
  return hasAvailableProfileData(value) && !chemicalProfileText.isEmpty(value);
}

function normalizeDataSourceOutput(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(normalizeDataSourceOutput).filter(Boolean).join(' · ');
  }
  return responderText.normalizeResponderText(String(value)
    .normalize('NFKC')
    .replace(/\\(?:r\\n|[nrt])/g, ' · ')
    .replace(/[\r\n\t]+/g, ' · ')
    .replace(/\s*[•·]+\s*/g, ' · ')
    .replace(/(?:\s*·\s*){2,}/g, ' · ')
    .replace(/[ \f\v]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
    .replace(/^[·,;:\s]+|[·,;:\s]+$/g, ''));
}

function profileDisplayParts(value) {
  const values = Array.isArray(value) ? value : [value];
  const parts = values
    .flatMap((item) => {
      const text = normalizeDataSourceOutput(item);
      if (!text) return [];
      if (text.includes(' · ')) return text.split(/\s*·\s*/);
      if (text.includes(';')) return text.split(/\s*;\s*/);
      if (text.length >= 160) return readableProfileBullets(text);
      return [text];
    })
    .map((item) => item.trim())
    .filter(hasAvailableProfileData);
  const normalized = chemicalProfileText.normalizeGuidanceItems(parts);
  return normalized.filter(hasMeaningfulChemicalProfileData);
}

function shouldUseCompactColumns(items) {
  if (!Array.isArray(items) || items.length < 6 || items.some((item) => typeof item !== 'string')) return false;
  const lengths = items.map((item) => item.trim().length);
  const averageLength = lengths.reduce((total, length) => total + length, 0) / lengths.length;
  return Math.max(...lengths) <= 120 && averageLength <= 72;
}

function titleCaseProfileLabel(value) {
  const heading = chemicalProfileText.normalizeHeading(value);
  return heading.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

const chemicalProfileIconPaths = Object.freeze({
  overview: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  properties: '<path d="M9 3h6M10 3v5l-5.5 9.2A2.5 2.5 0 0 0 6.7 21h10.6a2.5 2.5 0 0 0 2.2-3.8L14 8V3"/><path d="M7.5 16h9"/>',
  isolation: '<circle cx="12" cy="12" r="8"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/>',
  exposures: '<path d="M4 18h16M6 15l3-3 3 2 5-7 2 2"/><path d="M6 6v3M12 4v4M18 5v3"/>',
  ppe: '<path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>',
  detectors: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>',
  reactivity: '<path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>',
  medical: '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z"/>',
  fire: '<path d="M12 22c4 0 7-2.7 7-6.5 0-3-1.8-5.2-4.2-7.7-.3 2-1.2 3.2-2.2 4.1.2-3.5-1.7-6.7-4.2-9.2.1 3.4-1.7 5.3-2.8 7.1C4.5 11.5 5 14 5 15.5 5 19.3 8 22 12 22Z"/>',
  decon: '<path d="M12 3s5 5.5 5 10a5 5 0 0 1-10 0c0-4.5 5-10 5-10Z"/><path d="M4 19h16"/>',
  sources: '<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/>',
});

function chemicalProfileIconKey(value) {
  const text = String(value || '').toLowerCase();
  if (/medical|ems|treatment|patient|symptom|first aid/.test(text)) return 'medical';
  if (/fire|flamm|explosion/.test(text)) return 'fire';
  if (/decon|runoff/.test(text)) return 'decon';
  if (/ppe|respirat|glove|suit/.test(text)) return 'ppe';
  if (/detector|monitor|aegl|exposure|limit/.test(text)) return 'detectors';
  if (/react|stability|decomposition/.test(text)) return 'reactivity';
  if (/isolation|erg/.test(text)) return 'isolation';
  if (/source/.test(text)) return 'sources';
  if (/propert|chemical|summary|synonym/.test(text)) return 'properties';
  return chemicalProfileIconPaths[text] ? text : 'overview';
}

function createChemicalProfileIcon(value) {
  const icon = document.createElement('span');
  icon.className = 'chemical-profile-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${chemicalProfileIconPaths[chemicalProfileIconKey(value)]}</svg>`;
  return icon;
}

function createHybridDeconLink() {
  const section = document.createElement('section');
  section.className = 'chemical-profile-section hybrid-decon-section';
  section.dataset.section = 'hybrid-decon';

  const heading = document.createElement('h4');
  heading.textContent = 'Hybrid Decon';

  const link = document.createElement('a');
  link.className = 'hybrid-decon-link';
  link.href = 'https://dfg.firstlinetech.com/login/?redirect_to=https%3A%2F%2Fdfg.firstlinetech.com%2Flogout%2F';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', 'Open the Decon Field Guide login in a new tab');

  const logo = document.createElement('img');
  logo.className = 'hybrid-decon-logo';
  logo.src = 'https://dfg.firstlinetech.com/wp-content/uploads/2022/08/DFG-Logo-2022-1024x430.png';
  logo.alt = 'Decon Field Guide';
  logo.referrerPolicy = 'no-referrer';

  const action = document.createElement('span');
  action.className = 'hybrid-decon-action';
  action.textContent = 'Open Field Guide';
  action.setAttribute('aria-hidden', 'true');

  const consideration = document.createElement('p');
  consideration.className = 'hybrid-decon-consideration';
  consideration.textContent = 'Consider FirstLine Hybrid Decon only when product-specific guidance is available, agency-approved, and compatible with the selected chemical, its physical state, PPE, and runoff controls.';

  link.append(logo, action);
  section.append(heading, consideration, link);
  return section;
}

function createProfileSection(title, rows, list = false) {
  const section = document.createElement('section');
  section.className = 'chemical-profile-section';
  section.dataset.section = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const lifeSafetyText = `${title} ${JSON.stringify(rows ?? '')}`;
  if (/(?:responder(?:s)? hazards?|life[ -]?safety|life[ -]?threat|fatal|death|cardiac arrest|respiratory failure|asphyxi|seizure|unconscious|IDLH)/i.test(lifeSafetyText)) {
    section.classList.add('chemical-profile-life-safety');
  }
  const heading = document.createElement('h4');
  const headingText = document.createElement('span');
  headingText.textContent = titleCaseProfileLabel(title);
  heading.append(createChemicalProfileIcon(title), headingText);
  section.append(heading);
  if (list) {
    const rawItems = (Array.isArray(rows) ? rows : [rows]).filter(hasMeaningfulChemicalProfileData);
    const textItems = rawItems.filter((item) => !item || typeof item !== 'object');
    const items = textItems.length === rawItems.length
      ? chemicalProfileText.normalizeGuidanceItems(textItems).filter(hasMeaningfulChemicalProfileData)
      : rawItems;
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
        value.textContent = normalizeDataSourceOutput(item.value);
        li.append(label, value);
      } else {
        li.textContent = normalizeDataSourceOutput(item);
      }
      listEl.append(li);
    });
    section.append(listEl);
  } else {
    const entries = (Array.isArray(rows) ? rows : [rows])
      .filter((entry) => entry && hasMeaningfulChemicalProfileData(entry.value));
    if (!entries.length) return null;
    const grid = document.createElement('div');
    grid.className = 'chemical-profile-grid';
    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'chemical-profile-row';
      row.dataset.field = String(entry.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const label = document.createElement('span');
      label.textContent = titleCaseProfileLabel(entry.label);
      const parts = profileDisplayParts(formatProfileMeasurement(entry.label, entry.value));
      const hasTreatmentGroups = row.dataset.field === 'treatment-notes'
        && parts.some((part) => /^(?:BLS|ALS)$/i.test(part));
      let value;
      if (hasTreatmentGroups) {
        value = document.createElement('div');
        value.className = 'chemical-treatment-columns';
        const groups = { bls: [], als: [] };
        let treatmentLevel = '';
        parts.forEach((part) => {
          if (/^BLS$/i.test(part)) treatmentLevel = 'bls';
          else if (/^ALS$/i.test(part)) treatmentLevel = 'als';
          else if (treatmentLevel) groups[treatmentLevel].push(part);
        });
        Object.entries(groups).forEach(([level, treatments]) => {
          if (!treatments.length) return;
          const column = document.createElement('section');
          column.className = `chemical-treatment-column treatment-${level}`;
          const subtitle = document.createElement('h5');
          subtitle.textContent = level.toUpperCase();
          const list = document.createElement('ul');
          treatments.forEach((treatment) => {
            const item = document.createElement('li');
            item.textContent = treatment;
            list.append(item);
          });
          column.append(subtitle, list);
          value.append(column);
        });
      } else if (parts.length > 1) {
        value = document.createElement('ul');
        value.className = 'chemical-profile-value-list';
        if (shouldUseCompactColumns(parts)) value.classList.add('compact-columns');
        parts.forEach((part) => {
          const item = document.createElement('li');
          item.textContent = part;
          value.append(item);
        });
      } else {
        value = document.createElement('strong');
        value.textContent = parts[0];
      }
      row.append(label, value);
      grid.append(row);
    });
    section.append(grid);
  }
  return section;
}

function createChemicalProfileColumn(name, sections) {
  const availableSections = sections.filter(Boolean);
  if (!availableSections.length) return null;
  const column = document.createElement('div');
  column.className = 'chemical-profile-overview-column';
  column.dataset.column = name;
  column.append(...availableSections);
  return column;
}

const ppeLevelTiles = Object.freeze([
  ['LEVEL_A_VAPOR_PROTECTIVE_SCBA', 'Vapor Protective Level A w/ SCBA', 'level-a'],
  ['LEVEL_B_SCBA', 'Level B w/ SCBA', 'level-b'],
  ['LEVEL_C_APR_APPROPRIATE_CARTRIDGE', 'Level C w/ APR — Appropriate Cartridge Required', 'level-c'],
  ['LEVEL_D_NO_CHEMICAL_PROTECTION', 'Level D — No Chemical Protection Required', 'level-d'],
]);

function appendPpeRecommendationList(container, title, values, emptyText = noCurrentDataText) {
  const section = document.createElement('section');
  section.className = 'ppe-recommendation-list-section';
  const heading = document.createElement('h5');
  heading.textContent = title;
  const items = (Array.isArray(values) ? values : [values]).filter(hasAvailableProfileData);
  const list = document.createElement('ul');
  (items.length ? items : [emptyText]).forEach((value) => {
    const item = document.createElement('li');
    item.textContent = normalizeDataSourceOutput(value);
    list.append(item);
  });
  section.append(heading, list);
  container.append(section);
}

function createPpeRecommendationCard(recommendation = {}) {
  const section = document.createElement('section');
  section.className = 'chemical-profile-section ppe-recommendation-card';
  section.dataset.section = 'ppe-recommendation';
  section.dataset.recommendationStatus = recommendation.recommendationStatus || 'NO_CURRENT_DATA';

  const heading = document.createElement('h4');
  const headingText = document.createElement('span');
  headingText.textContent = 'PPE Recommendation';
  heading.append(createChemicalProfileIcon('ppe'), headingText);

  const status = document.createElement('div');
  status.className = 'ppe-recommendation-status';
  const statusLabel = document.createElement('span');
  statusLabel.textContent = recommendation.recommendationStatus === 'SOURCE_BACKED_RECOMMENDATION'
    ? 'Source-backed recommendation'
    : (recommendation.recommendationStatus === 'BLOCKED' ? 'Blocked' : 'Safety review status');
  const badge = document.createElement('strong');
  badge.textContent = recommendation.displayLabel || noCurrentDataText;
  status.append(statusLabel, badge);

  const tileGrid = document.createElement('div');
  tileGrid.className = 'ppe-level-options';
  ppeLevelTiles.forEach(([level, label, accent]) => {
    const tile = document.createElement('article');
    tile.className = `ppe-level-option ${accent}`;
    tile.dataset.level = level;
    const selected = recommendation.selectedLevel === level;
    let tileState = selected ? 'Recommended' : 'Not Recommended';
    if (recommendation.selectedLevel === 'NO_CURRENT_DATA_EXISTS') tileState = noCurrentDataText;
    else if (recommendation.selectedLevel === 'REQUIRES_REVIEW') tileState = level === 'LEVEL_C_APR_APPROPRIATE_CARTRIDGE' ? 'Blocked' : 'Conditional';
    else if (recommendation.selectedLevel === 'BLOCKED_PENDING_VERIFIED_CHEMICAL_LINK') tileState = 'Blocked';
    else if (level === 'LEVEL_C_APR_APPROPRIATE_CARTRIDGE' && !recommendation.levelCAllowed) tileState = 'Blocked';
    tile.dataset.state = tileState.toLowerCase().replace(/\s+/g, '-');
    const tileTitle = document.createElement('strong');
    tileTitle.textContent = label;
    const tileStatus = document.createElement('span');
    tileStatus.textContent = tileState;
    tile.append(tileTitle, tileStatus);
    tileGrid.append(tile);
  });

  const summary = document.createElement('dl');
  summary.className = 'ppe-recommendation-summary';
  [
    ['Respiratory', recommendation.respiratoryProtection],
    ['Skin / Suit', recommendation.skinProtection],
    ['Eye / Face', recommendation.eyeFaceProtection],
    ['Cartridge', recommendation.cartridgeRequirement],
  ].forEach(([label, value]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = normalizeDataSourceOutput(value || noCurrentDataText);
    row.append(term, detail);
    summary.append(row);
  });

  const support = document.createElement('div');
  support.className = 'ppe-recommendation-support';
  appendPpeRecommendationList(support, 'Why', recommendation.decisionReasons);
  appendPpeRecommendationList(support, 'Verification Required', recommendation.verificationRequirements);
  appendPpeRecommendationList(support, 'Limitations', recommendation.limitations);
  appendPpeRecommendationList(support, 'Sources Reviewed', recommendation.sourcesReviewed);

  const rawDetails = document.createElement('details');
  rawDetails.className = 'ppe-source-details';
  const rawSummary = document.createElement('summary');
  rawSummary.textContent = 'Source Details / Manufacturer Details';
  const rawContent = document.createElement('div');
  rawContent.className = 'ppe-source-details-content';
  const rawGroups = Object.entries(recommendation.hiddenRawOptions || {});
  if (rawGroups.some(([, values]) => Array.isArray(values) && values.length)) {
    rawGroups.forEach(([group, values]) => {
      if (!Array.isArray(values) || !values.length) return;
      appendPpeRecommendationList(rawContent, titleCaseProfileLabel(group.replace(/([a-z])([A-Z])/g, '$1 $2')), values);
    });
  } else rawContent.textContent = noCurrentDataText;
  rawDetails.append(rawSummary, rawContent);

  const disclaimer = document.createElement('p');
  disclaimer.className = 'ppe-recommendation-disclaimer';
  disclaimer.textContent = ppeSuitWarning;
  section.append(heading, status, tileGrid, summary, support, rawDetails, disclaimer);
  return section;
}

function readableProfileBullets(value) {
  const text = String(value || '').trim();
  if (!hasMeaningfulChemicalProfileData(text)) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])|;\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function patientHandlingSteps(values) {
  const steps = [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => String(value || '').trim())
    .filter(hasAvailableProfileData))];
  const hasSpecificDeconInstruction = steps.some((step) => /decontaminate with enhanced ventilation or water/i.test(step));
  const filtered = steps.filter((step) => !(
    hasSpecificDeconInstruction
    && /^Remove from hazardous area, decontaminate, and treat symptomatically\.?$/i.test(step)
  ));
  const formatted = chemicalProfileText.normalizeGuidanceItems(responderText.formatResponderGuidance(filtered))
    .filter(hasMeaningfulChemicalProfileData);
  const preferredOrder = [
    'If damp, remove clothing immediately.',
    'If wearing bulky clothing or denim, remove outer layer.',
    'Add fans if available to enhance ventilation effectiveness.',
  ];
  return formatted.length === preferredOrder.length
    && preferredOrder.every((instruction) => formatted.includes(instruction))
    ? preferredOrder
    : formatted;
}

function deconGuidanceItems(values) {
  return chemicalProfileText.normalizeGuidanceItems(Array.isArray(values) ? values : [values])
    .filter((value) => !/skin is damaged|visible signs of eczema/i.test(String(value)));
}

function createChemicalProfileEmptyState() {
  const state = document.createElement('section');
  state.className = 'chemical-profile-empty-state';
  const title = document.createElement('strong');
  title.textContent = noCurrentDataText;
  state.append(title);
  return state;
}

function chemicalProfileSources(profile) {
  return [...new Set([
    ...profileArray(profile?.sourceLabels),
    ...profileArray(profile?.sources),
    ...profileArray(profile?.header?.sources),
    ...profileArray(profile?.sourceLinks).map((link) => link?.sourceName),
  ]
    .filter(Boolean)
    .map(chemicalProfileText.normalizeSourceLabel)
    .filter(hasMeaningfulChemicalProfileData))];
}

function createChemicalProfileSourceSummary(profile, expanded = false) {
  const sources = chemicalProfileSources(profile);
  const details = document.createElement('details');
  details.className = 'chemical-profile-source-summary';
  details.open = expanded;
  const summary = document.createElement('summary');
  summary.textContent = 'Source Summary / Data Status / Confidence';
  details.append(summary);
  const statusGrid = document.createElement('dl');
  statusGrid.className = 'chemical-profile-source-status-grid';
  [
    ['Source Summary', sources.length ? sources.join(', ') : noCurrentDataText],
    ['Data Status', sources.length ? 'Verified source data' : 'Requires review'],
    ['Confidence', sources.length ? 'Source-backed' : 'No current source confidence'],
  ].forEach(([label, value]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    statusGrid.append(row);
  });
  details.append(statusGrid);
  return details;
}

const primaryLimitLabels = {
  IDLHPpm: 'IDLH (ppm)',
  RELTWAPpm: 'REL/TWA (ppm)',
  RELSTEL: 'REL/STEL',
  RELCeiling: 'REL/Ceiling',
  PELTWAPpm: 'PEL/TWA (ppm)',
  PELSTEL: 'PEL/STEL',
  PELCeiling: 'PEL/Ceiling',
  TLVTWAPpm: 'TLV/TWA (ppm)',
  TLVSTEL: 'TLV/STEL',
  TLVCeiling: 'TLV/Ceiling',
  LOC: 'LOC',
};

function monitoringConcernEntries(values) {
  return (Array.isArray(values) ? values : [values]).map((item) => {
    const [rawLabel, ...valueParts] = String(item || '').split(':');
    const rawValue = valueParts.join(':').trim() || 'Not available';
    const label = primaryLimitLabels[rawLabel] || rawLabel
      .replaceAll('_', ' ')
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
      .replace(/Ppm\b/g, 'ppm')
      .replace(/MgM3\b/g, 'mg/m³')
      .replace(/\bhr\b/gi, ' hr')
      .trim();
    const value = /^(?:IDLH|REL|PEL|TLV)/.test(rawLabel)
      ? formatConcentration(rawValue)
      : rawValue;
    return { key: rawLabel, label, value };
  }).filter(({ value }) => !/^(?:not relevant|not established|not available)$/i.test(value));
}

function groupedAeglProfileEntries(values) {
  return chemicalProfileText.groupAeglByTimeframe?.(Array.isArray(values) ? values : [values]) || [];
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
    if (title === 'AEGL Levels') {
      entries.forEach((entry, index) => {
        if (pattern.test(entry.key)) assigned.add(index);
      });
      return createProfileSection(title, groupedAeglProfileEntries(values), true);
    }
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

function createDetailedMonitoringSections(profile) {
  const detectors = profileObject(profile?.detectors);
  const monitoring = profileObject(profile?.monitoring);
  const recommendation = profileObject(profile?.ppeRecommendation);
  const displayValues = (...values) => chemicalFrontlineValues(values.flatMap((value) => profileArray(value).flatMap((item) => {
    if (!item || typeof item !== 'object') return [item];
    return Object.entries(item).map(([key, nested]) => `${key}: ${normalizeDataSourceOutput(nested)}`);
  })));
  const monitoringApproach = displayValues(
    profile?.monitoringApproach,
    monitoring.approach,
    monitoring.continuousMonitoring,
    profileArray(recommendation.verificationRequirements).filter((item) => /air monitoring|oxygen|IDLH|concentration|atmosphere/i.test(String(item))),
  );
  const detectorTypes = displayValues(
    detectors.items,
    detectors.instrumentTypes,
    detectors.sensorTypes,
  );
  const analyticalMethods = displayValues(
    detectors.analyticalMethods,
    detectors.secondaryMethods,
    detectors.confirmationMethods,
    profile?.confirmationGuidance,
    profile?.identificationSupport,
  );
  const limitations = displayValues(
    detectors.limitations,
    detectors.instrumentLimitations,
    detectors.crossSensitivity,
    detectors.crossSensitivities,
    detectors.interferences,
    monitoring.limitations,
  );
  const fieldReadings = displayValues(
    profile?.fieldMonitoring,
    profile?.currentReadings,
    profile?.readings,
    profile?.incidentReadings,
    detectors.fieldReadings,
    detectors.negativeTestRelevance,
  );

  return [
    createProfileSection('Monitoring Methods', [
      { label: 'Sensor / instrument types', value: detectorTypes },
      { label: 'Colorimetric tubes', value: displayValues(detectors.colorimetricTubes) },
      { label: 'Electrochemical sensors', value: displayValues(detectors.electrochemicalSensors) },
      { label: 'PID / photoionization', value: displayValues(detectors.pidRelevance) },
      { label: 'LEL / combustible-gas meters', value: displayValues(detectors.lelMeterRelevance) },
      { label: 'Monitoring approach', value: monitoringApproach },
    ]),
    createProfileSection('Detection / Identification', [
      { label: 'Direct-reading methods', value: displayValues(detectors.directReadingMethods, detectors.items) },
      { label: 'Analytical / secondary confirmation', value: analyticalMethods },
      { label: 'Multi-method confirmation', value: displayValues(detectors.multiMethodConfirmation, monitoring.confirmationStrategy) },
    ]),
    createProfileSection('Instrument Limitations / Interferences', [
      { label: 'Limitations / cross-sensitivity', value: limitations },
      { label: 'Useful negative findings', value: displayValues(detectors.negativeFindings, detectors.negativeTestRelevance, monitoring.negativeTestRelevance) },
    ]),
    createProfileSection('Field Monitoring / Readings', [
      { label: 'Current readings / context', value: fieldReadings },
      { label: 'Units / threshold comparison', value: displayValues(profile?.readingUnits, profile?.thresholdComparison, monitoring.readingContext) },
    ]),
  ].filter(Boolean);
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
  const table1 = isolationErg?.ergTable1?.find((entry) => entry && typeof entry === 'object');
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
  const table2Rows = (isolationErg?.ergTable2 || [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => [entry.title, entry.detail]);
  const table2Section = createErgGreenTable(
    'ERG Green Table 2 — Water-Reactive Toxic Gases',
    ['Reference', 'Response information'],
    table2Rows,
  );
  const table3Rows = (isolationErg?.ergTable3 || [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => [
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

function renderNfpa704Placard(nfpa704, chemicalName) {
  const placard = document.getElementById('chemical-nfpa-placard');
  if (!placard) return;
  const rating = (value) => /^[0-4]$/.test(String(value ?? '').trim()) ? String(value).trim() : '—';
  const special = chemicalProfileText.isEmpty(nfpa704?.special) ? '—' : String(nfpa704.special).trim();
  const values = {
    health: rating(nfpa704?.health),
    flammability: rating(nfpa704?.flammability),
    instability: rating(nfpa704?.instability),
    special,
  };
  const descriptions = {
    health: nfpa704?.healthDescription,
    flammability: nfpa704?.flammabilityDescription,
    instability: nfpa704?.instabilityDescription,
    special: nfpa704?.specialDescription,
  };
  Object.entries(values).forEach(([field, value]) => {
    const cell = document.getElementById(`nfpa-704-${field}`);
    if (!cell) return;
    const displayedValue = cell.querySelector('b');
    if (displayedValue) displayedValue.textContent = value;
    const description = descriptions[field];
    cell.title = hasMeaningfulChemicalProfileData(description) ? String(description) : '';
  });
  const hasRecord = [values.health, values.flammability, values.instability].some((value) => value !== '—')
    || values.special !== '—';
  placard.dataset.state = hasRecord ? 'available' : 'missing';
  placard.setAttribute('aria-label', hasRecord
    ? `NFPA 704 for ${chemicalName}: health ${values.health}, flammability ${values.flammability}, instability ${values.instability}, special ${values.special}.`
    : `NFPA 704 for ${chemicalName}: ${noCurrentDataText}.`);
  const source = document.getElementById('nfpa-704-source');
  if (source) source.textContent = hasRecord ? '' : noCurrentDataText;
}

function renderChemicalHazardOverview(profile) {
  const list = document.getElementById('chemical-hazard-overview-list');
  if (!list) return;
  const candidates = [
    profile?.header?.hazard,
    profile?.fire?.flammability,
    profile?.reactivity?.waterReactivity,
    profile?.reactivity?.oxidizerReducerConcerns,
  ]
    .flat(2)
    .flatMap(profileDisplayParts)
    .filter(hasMeaningfulChemicalProfileData);
  const items = [...new Map(candidates.map((value) => [String(value).toLowerCase(), value])).values()].slice(0, 4);
  list.replaceChildren(...(items.length ? items : [noCurrentDataText]).map((value) => {
    const item = document.createElement('li');
    const textValue = document.createElement('span');
    textValue.textContent = value;
    item.append(createChemicalProfileIcon(value), textValue);
    return item;
  }));
}

function formatHazardClassLines(value) {
  const raw = profileDisplayParts(value).map((part) => String(part).trim()).filter(Boolean);
  const lines = raw.flatMap((part) => part.split(/\s*[,;]\s*/)).map((part) => part.trim()).filter(Boolean);
  return [...new Map(lines.map((line) => {
    const match = line.match(/^\s*(\d+(?:\.\d+)?)\s*(?:\(([^)]+)\)|[-:]\s*(.*))?\s*$/);
    if (!match) return [line.toLowerCase(), line];
    const description = (match[2] || match[3] || '').trim();
    const label = description ? `Class ${match[1]}: ${description}` : `Class ${match[1]}`;
    return [label.toLowerCase(), label];
  })).values()];
}

function renderChemicalProfile(profile) {
  profile = normalizeChemicalProfileForUi(profile);
  const content = document.getElementById('chemical-profile-content');
  const tabs = document.getElementById('chemical-profile-tabs');
  const meta = document.getElementById('chemical-profile-meta');
  const nameEl = document.getElementById('chemical-name');
  const summaryEl = document.getElementById('chemical-summary');
  if (!content || !tabs || !meta || !nameEl || !summaryEl) return;

  const sections = [
    { key: 'overview', title: 'Overview', render: () => {
      const aeglValues = profileArray(profile?.exposures?.monitoringConcerns)
        .filter((value) => /^AEGL/i.test(String(value).split(':')[0].trim()));
      const chemicalSummary = createProfileSection('Chemical Summary', [
        { label: 'Primary hazard', value: profile?.header?.hazard },
        { label: 'Physical state', value: profile?.properties?.physicalState },
        { label: 'Odor', value: profile?.properties?.odor || profile?.properties?.characteristics },
        { label: 'Color', value: profile?.properties?.color },
        { label: 'Molecular formula', value: profile?.properties?.formula },
        { label: 'Molecular weight', value: profile?.properties?.molecularWeight },
        { label: 'Boiling point', value: profile?.properties?.boilingPoint },
        { label: 'Solubility', value: profile?.properties?.waterSolubility },
        { label: 'ERG guide', value: profile?.header?.ergGuide },
      ]);
      const exposureSummary = createProfileSection('Exposure Limits', [
        { label: 'IDLH', value: formatIdlh(profile?.exposures?.idlh) },
        { label: 'OSHA PEL', value: formatConcentration(profile?.exposures?.oshaPel) },
        { label: 'NIOSH REL', value: formatConcentration(profile?.exposures?.nioshRel) },
        { label: 'ACGIH TLV', value: formatConcentration(profile?.exposures?.acgihTlv) },
      ]);
      return [
        createChemicalProfileColumn('summary', [
          chemicalSummary,
          createProfileSection('AEGL Values', groupedAeglProfileEntries(aeglValues), true),
          exposureSummary,
        ]),
        createChemicalProfileColumn('operations', [
          createProfileSection('Frontline Considerations', chemicalFrontlineRows(profile)),
          createProfileSection('EMS Considerations', profile?.medical?.emsConsiderations, true),
        ]),
      ];
    } },
    { key: 'properties', title: 'Properties', render: () => {
      const chemicalProperties = createProfileSection('Chemical Properties', [
        { label: 'Chemical formula', value: profile?.properties?.formula },
        { label: 'Physical state', value: profile?.properties?.physicalState },
        { label: 'Appearance', value: profile?.properties?.appearance },
        { label: 'Color', value: profile?.properties?.color },
        { label: 'Odor', value: profile?.properties?.odor },
        { label: 'Molecular weight', value: profile?.properties?.molecularWeight },
        { label: 'Boiling point', value: profile?.properties?.boilingPoint },
        { label: 'Melting / freezing point', value: profile?.properties?.meltingPoint },
        { label: 'Vapor pressure', value: profile?.properties?.vaporPressure },
        { label: 'Vapor density', value: profile?.properties?.vaporDensity },
        { label: 'Liquid density', value: profile?.properties?.liquidDensity },
        { label: 'Specific gravity', value: profile?.properties?.specificGravity },
        { label: 'Water solubility', value: profile?.properties?.waterSolubility },
        { label: 'Flash point', value: profile?.properties?.flashPoint },
        { label: 'Ignition / autoignition temperature', value: profile?.properties?.ignitionTemperature },
        { label: 'LEL / UEL', value: profile?.properties?.lelUel },
        { label: 'Odor threshold', value: profile?.properties?.odorThreshold },
        { label: 'Ionization potential', value: profile?.properties?.ionizationPotential },
        { label: 'Decomposition point', value: profile?.properties?.decompositionPoint },
        { label: 'Heat of vaporization', value: profile?.properties?.heatOfVaporization },
        { label: 'Evaporation rate', value: profile?.properties?.evaporationRate },
      ]);
      const synonyms = profileArray(profile?.properties?.synonyms).filter(hasMeaningfulChemicalProfileData);
      if (chemicalProperties && synonyms.length) {
        const details = document.createElement('details');
        details.className = 'chemical-profile-secondary-details';
        const summary = document.createElement('summary');
        summary.textContent = 'Synonyms / aliases';
        const list = document.createElement('span');
        list.textContent = synonyms.map(normalizeDataSourceOutput).join(' · ');
        details.append(summary, list);
        chemicalProperties.append(details);
      }
      return [chemicalProperties, createProfileSection('Reactivity', readableProfileBullets(profile?.properties?.mixtureReactivity), true)];
    } },
    { key: 'exposures', title: 'Exposures', render: () => [
      createProfileSection('EXPOSURE LIMITS', [
        { label: 'IDLH', value: formatIdlh(profile?.exposures?.idlh) || 'Not available' },
        { label: 'OSHA PEL', value: formatConcentration(profile?.exposures?.oshaPel) || 'Not available' },
        { label: 'NIOSH REL', value: formatConcentration(profile?.exposures?.nioshRel) || 'Not available' },
        { label: 'ACGIH TLV', value: formatConcentration(profile?.exposures?.acgihTlv) || 'Not available' },
      ]),
      createProfileSection('Acute / Chronic Notes', profile?.exposures?.acuteNotes || ['Not available'], true),
      ...createMonitoringConcernSections(profile?.exposures?.monitoringConcerns || ['Not available']),
    ] },
    { key: 'ppeRespiratory', title: 'PPE / Respiratory Protection', render: () => [
      createPpeRecommendationCard(profile?.ppeRecommendation),
    ] },
    { key: 'detectors', title: 'Detectors', render: () => createDetailedMonitoringSections(profile) },
    { key: 'reactivity', title: 'Reactivity', render: () => [
      createProfileSection('Reactivity profile', [
        { label: 'Incompatibilities', value: profileArray(profile?.reactivity?.incompatibilities).join(' · ') || 'Not available' },
        { label: 'Polymerization risk', value: profileArray(profile?.reactivity?.polymerizationRisk).join(' · ') || 'Not available' },
        { label: 'Water reactivity', value: profileArray(profile?.reactivity?.waterReactivity).join(' · ') || 'Not available' },
        { label: 'Oxidizer / reducer concerns', value: profileArray(profile?.reactivity?.oxidizerReducerConcerns).join(' · ') || 'Not available' },
      ]),
      createProfileSection('Stability and decomposition', [
        { label: 'Overall stability', value: profile?.reactivity?.stabilityNotes || 'Not available' },
        { label: 'Mixing risk', value: profile?.reactivity?.chemicalMixtureReactivity || 'Not available' },
        { label: 'Decomposition products', value: profileArray(profile?.reactivity?.decompositionProducts).join(' · ') || 'Not available' },
      ]),
    ] },
    { key: 'isolationErg', title: 'Isolation Distance', render: () => {
      const isolationErg = profile?.isolationErg || {};
      const hasGreenTable = [isolationErg.ergTable1, isolationErg.ergTable2, isolationErg.ergTable3]
        .some((table) => table?.some((entry) => entry && typeof entry === 'object'));
      const distanceRows = [
        { label: 'ERG guide number', value: isolationErg.ergGuide || 'Not available' },
        { label: 'Initial isolation distance', value: isolationErg.initialIsolationDistance || 'Not available' },
        ...(!hasGreenTable ? [
          { label: 'Protective action distance', value: isolationErg.protectiveActionDistance || 'Not available' },
          { label: 'Small spill / large spill', value: `${isolationErg.smallSpill || 'Not available'} / ${isolationErg.largeSpill || 'Not available'}` },
          { label: 'Day / night values', value: profileArray(isolationErg.dayNightValues).join(' · ') || 'Not available' },
        ] : []),
      ];
      const distanceSection = createProfileSection('Isolation Distances', distanceRows);
      const notesSection = createProfileSection('ERG Notes', [
          { label: 'Note', value: isolationErg.note || 'Not available' },
        ]);
      if (hasGreenTable) {
        distanceSection?.classList.add('erg-profile-summary');
        notesSection?.classList.add('erg-profile-summary');
      }
      return [
        distanceSection,
        notesSection,
        ...createErgReferenceTables(isolationErg),
      ];
    } },
    { key: 'medical', title: 'Medical Considerations', render: () => [
      createProfileSection('Routes and symptoms', [
        { label: 'Routes of exposure', value: profile?.exposures?.routes || ['Not available'] },
        { label: 'Symptoms', value: profile?.exposures?.symptoms || ['Not available'] },
        { label: 'Target organs', value: profile?.exposures?.targetOrgans || ['Not available'] },
      ]),
      createProfileSection('Treatment', [
        { label: 'First aid', value: profile?.medical?.firstAid || ['Not available'] },
        { label: 'EMS considerations', value: profile?.medical?.emsConsiderations || ['Not available'] },
        { label: 'Antidotes', value: profile?.medical?.antidotes || ['Not available'] },
        { label: 'Treatment notes', value: profile?.medical?.treatmentNotes || ['Not available'] },
        { label: 'Contaminated patient handling', value: patientHandlingSteps(profile?.medical?.contaminatedPatientHandling || ['Not available']) },
      ]),
      createProfileSection('Responders hazards', [
        { label: 'Responders hazards', value: profile?.medical?.responderHazards || ['Not available'] },
      ]),
    ] },
    { key: 'fire', title: 'Fire', render: () => [
      createProfileSection('Fire behavior', [
        { label: 'Flammability', value: profile?.fire?.flammability || 'Not available' },
        { label: 'Flash point', value: profile?.fire?.flashPoint || 'Not available' },
        { label: 'LEL / UEL', value: profile?.fire?.lelUel || 'Not available' },
        { label: 'Extinguishing media', value: profileArray(profile?.fire?.extinguishingMedia).join(' · ') || 'Not available' },
      ]),
      createProfileSection('Fire response', [
        { label: 'Firefighting precautions', value: profileArray(profile?.fire?.firefightingPrecautions).join(' · ') || 'Not available' },
        { label: 'Vapor behavior', value: profileArray(profile?.fire?.vaporBehavior).join(' · ') || 'Not available' },
        { label: 'Explosion hazards', value: profileArray(profile?.fire?.explosionHazards).join(' · ') || 'Not available' },
        { label: 'Runoff concerns', value: profileArray(profile?.fire?.runoffConcerns).join(' · ') || 'Not available' },
      ]),
    ] },
    { key: 'decon', title: 'DECON', render: () => [
      createProfileSection('Personnel / Product Decon', [
        { label: 'Preferred route / source matrix', value: profile?.decon?.preferredMethod || ['Not available'] },
        { label: 'HazMat personnel procedure', value: deconGuidanceItems(profile?.decon?.hazmatPersonnelProcedure || ['Not available']) },
        { label: 'Water-reactive cautions', value: profileArray(profile?.decon?.waterReactiveCautions).join(' · ') || 'Not available' },
      ]),
      createProfileSection('Technical Decon', [
        { label: 'Selected-product methods and process', value: deconGuidanceItems(profile?.decon?.technicalDecon || ['Not available']) },
        { label: 'Equipment / object decon', value: deconGuidanceItems(profile?.decon?.equipmentDecon || ['Not available']) },
        { label: 'Runoff containment', value: deconGuidanceItems(profile?.decon?.runoffContainment || ['Not available']) },
        { label: 'Guidance basis', value: profileArray(profile?.decon?.sourceBasis).join(' · ') || 'Not available' },
      ]),
      createHybridDeconLink(),
    ] },
    { key: 'sources', title: 'Sources', render: () => [
      createChemicalProfileSourceSummary(profile, true),
      createProfileSection('Source Traceability', chemicalProfileSources(profile), true),
    ] },
  ];

  const renderSectionGroups = (...keys) => keys.flatMap((key) =>
    sections.find((section) => section.key === key)?.render() || []);
  sections.push(
    {
      key: 'ppeMonitoring',
      title: 'PPE & Monitoring',
      render: () => renderSectionGroups('ppeRespiratory', 'detectors'),
    },
    {
      key: 'response',
      title: 'Response',
      render: () => renderSectionGroups('isolationErg', 'reactivity', 'fire'),
    },
  );

  const tabsList = [
    ['Overview', 'overview'],
    ['Properties', 'properties'],
    ['Exposures', 'exposures'],
    ['PPE & Monitoring', 'ppeMonitoring'],
    ['Response', 'response'],
    ['Medical', 'medical'],
    ['Decon', 'decon'],
    ['Sources', 'sources'],
  ];

  nameEl.textContent = profile?.header?.name || 'Select a chemical';

  // Commit the primary navigation and profile body before enriching the hero.
  // A malformed optional source, NFPA, or overview field must never prevent the
  // operator from seeing and using the profile tabs.
  tabs.replaceChildren();
  const tabButtons = tabsList.map(([label, key]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chemical-profile-tab';
    button.dataset.tab = key;
    const tabLabel = document.createElement('span');
    tabLabel.textContent = label;
    button.append(createChemicalProfileIcon(key), tabLabel);
    button.addEventListener('click', () => {
      renderChemicalProfile({ ...profile, activeTab: key });
    });
    return button;
  });
  tabs.append(...tabButtons);

  const activeKey = profile?.activeTab || 'overview';
  tabs.querySelectorAll('.chemical-profile-tab').forEach((button) => {
    const active = button.dataset.tab === activeKey;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });

  const activeSection = sections.find((section) => section.key === activeKey) || sections[0];
  content.dataset.activeTab = activeKey;
  const fragment = document.createDocumentFragment();
  let renderedSections = [];
  try {
    renderedSections = (activeSection.render() || []).filter(Boolean);
    renderedSections.forEach((element) => fragment.append(element));
    if (activeKey !== 'sources') {
      const sourceSummary = createChemicalProfileSourceSummary(profile, activeKey === 'overview');
      if (sourceSummary) fragment.append(sourceSummary);
    }
  } catch (error) {
    console.error('Chemical profile section rendering failed.', error);
  }
  if (!renderedSections.length) fragment.append(createChemicalProfileEmptyState());
  content.replaceChildren(fragment);
  if (typeof content.scrollTo === 'function') content.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  else {
    content.scrollTop = 0;
    content.scrollLeft = 0;
  }

  try {
    renderNfpa704Placard(profile?.header?.nfpa704, nameEl.textContent);
  } catch (error) {
    console.error('NFPA 704 placard rendering failed.', error);
  }
  try {
    renderChemicalHazardOverview(profile);
  } catch (error) {
    console.error('Chemical hazard overview rendering failed.', error);
  }
  const summaryParts = [
    hasMeaningfulChemicalProfileData(profile?.header?.cas) ? `CAS: ${profile.header.cas}` : '',
    profile?.header?.hazard,
  ].filter(hasMeaningfulChemicalProfileData);
  summaryEl.textContent = summaryParts.join(' · ');
  summaryEl.hidden = summaryParts.length === 0;
  meta.innerHTML = '';
  const metaItems = [
    ['UN/NA', profile?.header?.un || noCurrentDataText],
    ['ERG Guide', profile?.header?.ergGuide || noCurrentDataText],
    ['Hazard Class', formatHazardClassLines(profile?.header?.hazardClass || profile?.header?.hazard).join('\n') || noCurrentDataText],
  ];
  metaItems.forEach(([label, value]) => {
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
  const statusEl = document.getElementById('chemical-profile-status');
  let profileSources = [];
  try {
    profileSources = chemicalProfileSources(profile);
  } catch (error) {
    console.error('Chemical profile source rendering failed.', error);
  }
  if (statusEl) {
    const hasSources = profileSources.length > 0;
    statusEl.textContent = hasSources ? 'Verified' : 'Requires Review';
    statusEl.dataset.state = hasSources ? 'verified' : 'review';
  }
  setText('chemical-profile-footer-sources', profileSources.length ? profileSources.join(' · ') : noCurrentDataText);
  setText('chemical-profile-footer-status', profileSources.length ? 'Verified' : 'Requires Review');
  setText('chemical-profile-footer-confidence', profileSources.length ? 'High' : 'Requires Review');

}

function updateChemicalCard(record) {
  if (!record) return;
  const linkedSourceBadge = (sourceName) => {
    const normalized = String(sourceName || '').replace(/^Linked\s+/i, '').trim();
    if (/^CAMEO(?: Chemicals)?$/i.test(normalized)) return 'Linked CAMEO';
    if (/^ALOHA$/i.test(normalized)) return 'Linked ALOHA';
    if (/^ERG$/i.test(normalized)) return 'Linked ERG';
    return normalized;
  };
  const linkedSources = profileArray(record.profile?.sourceLinks)
    .map((link) => link?.sourceName && linkedSourceBadge(link.sourceName))
    .filter(Boolean);
  const profile = normalizeChemicalProfileForUi({
    ...(record.profile || record),
    header: {
      ...(record.profile?.header || {}),
      name: record.profile?.header?.name || record.name || record.ChemicalName || 'Select a chemical',
      cas: record.profile?.header?.cas || record.cas || record.CasNumber || '',
      un: record.profile?.header?.un || record.un || record.UnnaNumber || '',
      hazardClass: hasMeaningfulChemicalProfileData(record.profile?.header?.hazardClass)
        ? record.profile.header.hazardClass
        : (hasMeaningfulChemicalProfileData(record.dotClass) ? record.dotClass : undefined),
      packingGroup: hasMeaningfulChemicalProfileData(record.profile?.header?.packingGroup)
        ? record.profile.header.packingGroup
        : (hasMeaningfulChemicalProfileData(record.packingGroup) ? record.packingGroup : undefined),
    },
    sourceLabels: [...new Set([
      'Chemical Companion Master',
      ...profileArray(record.summarySources || record.profile?.sourceLabels).map(linkedSourceBadge),
      ...linkedSources,
    ])],
  }, record);
  renderChemicalProfile(profile);
}

function guidedDisplayValue(value, missingText = noCurrentDataText) {
  const values = Array.isArray(value) ? value.flatMap((item) => {
    const displayed = guidedDisplayValue(item, '');
    return displayed ? [displayed] : [];
  }) : null;
  if (values) {
    const guidance = responderText.formatResponderGuidance(values);
    return guidance.length ? guidance.join(' · ') : missingText;
  }
  const text = responderText.normalizeResponderText(value);
  return !text || /^(?:n\/?a|not available|null|undefined)$/i.test(text) ? missingText : text;
}

function guidedValueIsMissing(value) {
  return !value || value === noCurrentDataText || /^Data unavailable from current source$/i.test(value);
}

function guidedSourceBadge(sourceName) {
  const source = String(sourceName || '').replace(/^Linked\s+/i, '').trim();
  if (/^Chemical Companion(?: Master)?$/i.test(source)) return 'Chemical Companion';
  if (/^ERG(?: 2024)?$/i.test(source) || /PHMSA ERG/i.test(source)) return 'ERG';
  if (/^NIOSH(?: NPG)?$/i.test(source) || /NIOSH Pocket Guide/i.test(source)) return 'NIOSH';
  if (/^CAMEO(?: Chemicals)?$/i.test(source)) return 'CAMEO';
  return '';
}

function guidedProfileSources(profile) {
  const recordSources = (profile?.safetyCritical?.records || []).map((record) => record.sourceName);
  return [...new Set([
    'Chemical Companion Master',
    ...(activeChemicalRecord?.summarySources || []),
    ...(profile?.sourceLinks || []).map((link) => link?.sourceName),
    ...recordSources,
  ].map(guidedSourceBadge).filter(Boolean))];
}

function guidedBadgeFor(profile, field, displayedValue, fallbackSource = 'Chemical Companion') {
  if (guidedValueIsMissing(displayedValue)) return noCurrentDataText;
  if (/^(?:Not listed by current source|Data unavailable from current source)$/i.test(displayedValue)) return displayedValue;
  const record = (profile?.safetyCritical?.records || []).find((item) => item.field === field
    && guidedDisplayValue(item.value) !== noCurrentDataText);
  return guidedSourceBadge(record?.sourceName || fallbackSource) || 'Needs Verification';
}

function createGuidedResponseCard(title, rows, { action, sources = [] } = {}) {
  const card = document.createElement('article');
  card.className = 'panel-card guided-response-card';
  const heading = document.createElement('h3');
  heading.textContent = responderText.normalizeSectionHeading(title);
  const sourceLine = document.createElement('p');
  sourceLine.className = 'guided-section-sources';
  sourceLine.textContent = `Sources: ${sources.length ? sources.join(', ') : noCurrentDataText}`;
  const list = document.createElement('dl');
  list.className = 'guided-response-list';
  rows.forEach(({ label, value, badge }) => {
    const row = document.createElement('div');
    row.className = 'guided-response-row';
    row.dataset.field = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const term = document.createElement('dt');
    term.textContent = responderText.normalizeSectionHeading(label);
    const detail = document.createElement('dd');
    const text = document.createElement('span');
    text.textContent = guidedDisplayValue(value);
    detail.append(text);
    if (badge) {
      const marker = document.createElement('small');
      marker.className = 'guided-source-badge';
      marker.textContent = badge;
      detail.append(marker);
    }
    row.append(term, detail);
    list.append(row);
  });
  card.append(heading, sourceLine, list);
  if (action) card.append(action);
  return card;
}

function guidedHasValue(value) {
  const displayed = guidedDisplayValue(value);
  return !guidedValueIsMissing(displayed)
    && !/^(?:Not listed by current source|Data unavailable from current source)$/i.test(displayed);
}

function guidedMissingBadge(value) {
  const displayed = guidedDisplayValue(value);
  return guidedHasValue(displayed) ? '' : displayed;
}

function guidedSourceText(profile, fields) {
  const fieldSet = new Set(fields);
  const sources = (profile?.safetyCritical?.records || [])
    .filter((record) => fieldSet.has(record.field) && guidedHasValue(record.value))
    .map((record) => guidedSourceBadge(record.sourceName))
    .filter(Boolean);
  return [...new Set(sources.length ? sources : ['Chemical Companion Master'])];
}

function createGuidedManufacturerPanel({ scbaMandated, levelCRelevant, levelD }) {
  if (levelD) return null;
  const section = document.createElement('section');
  section.className = 'guided-manufacturer-section';
  const heading = document.createElement('h3');
  heading.textContent = 'Manufacturer Platform Summary';
  const sourceLine = document.createElement('p');
  sourceLine.className = 'guided-section-sources';
  sourceLine.textContent = `Manufacturer data: ${noCurrentDataText}`;
  const grid = document.createElement('div');
  grid.className = 'guided-manufacturer-grid';
  ['3M', 'MSA', 'North'].forEach((manufacturer) => {
    const box = document.createElement('section');
    box.className = 'guided-manufacturer-box';
    const title = document.createElement('h4');
    title.textContent = manufacturer;
    const message = document.createElement('p');
    message.textContent = scbaMandated
      ? 'Manufacturer-specific SCBA options not verified from current source.'
      : levelCRelevant
        ? 'Cartridge selection requires verification.'
        : 'Manufacturer-specific respiratory options not verified from current source.';
    const note = document.createElement('small');
    note.textContent = scbaMandated
      ? 'SCBA platform status only; APR, PAPR, and cartridge lists are hidden.'
      : levelCRelevant
        ? 'Verify approved cartridge/canister data and locally authorized equipment before selection.'
        : 'Verify locally authorized equipment and chemical compatibility before selection.';
    box.append(title, message, note);
    grid.append(box);
  });
  section.append(heading, sourceLine, grid);
  return section;
}

function guidedSourceItems(value) {
  return (Array.isArray(value) ? value.flat() : [value])
    .map((item) => String(item ?? '').trim())
    .filter((item) => guidedHasValue(item));
}

function guidedExplicitProtectionLevels(values) {
  const levels = new Set();
  values.forEach((value) => {
    const text = String(value);
    if (/\blevel\s*a\b/i.test(text)) levels.add('Level A Vapor Protective Suit + SCBA');
    if (/\blevel\s*b\b/i.test(text)) levels.add('Level B Chemical Protective Suit + SCBA');
    if (/\blevel\s*c\b/i.test(text)) levels.add('Level C Chemical Protective Suit + APR/PAPR verification required');
    if (/\blevel\s*d\b/i.test(text)) levels.add('Level D / No chemical protective ensemble required');
  });
  return [...levels];
}

function createTacticalFlowBox(title, status, rows, sources, icApprovalRequired = false) {
  const box = document.createElement('details');
  box.className = 'guided-flow-box';
  box.open = title === 'Life Safety';
  const summary = document.createElement('summary');
  summary.className = 'guided-flow-summary';
  const heading = document.createElement('h4');
  heading.textContent = responderText.normalizeSectionHeading(title);
  const statusBox = document.createElement('strong');
  statusBox.className = 'guided-flow-status';
  statusBox.textContent = status;
  summary.append(heading, statusBox);
  const list = document.createElement('dl');
  rows.forEach(({ label, value }) => {
    const row = document.createElement('div');
    row.dataset.field = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const term = document.createElement('dt');
    term.textContent = responderText.normalizeSectionHeading(label);
    const detail = document.createElement('dd');
    detail.textContent = guidedDisplayValue(value);
    row.append(term, detail);
    list.append(row);
  });
  const sourceLine = document.createElement('p');
  sourceLine.className = 'guided-flow-sources';
  sourceLine.textContent = `Sources reviewed: ${sources.length ? sources.join(', ') : noCurrentDataText}`;
  box.append(summary, list, sourceLine);
  if (icApprovalRequired) {
    const approval = document.createElement('p');
    approval.className = 'guided-flow-approval';
    approval.textContent = 'Execution Note: Incident Command approval required before operational action.';
    box.append(approval);
  }
  return box;
}

function createTacticalFlowArrow() {
  const arrow = document.createElement('div');
  arrow.className = 'guided-flow-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↓';
  return arrow;
}

function createMitigationDecisionSupport(record) {
  const section = document.createElement('details');
  section.className = 'panel-card guided-mitigation-support';
  const heading = document.createElement('summary');
  heading.className = 'guided-tactical-section-heading';
  const title = document.createElement('h3');
  title.textContent = 'Mitigation Decision Support';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Compact source-backed decision support; final strategy requires Incident Command approval.';
  heading.append(title, subtitle);
  const grid = document.createElement('div');
  grid.className = 'guided-mitigation-grid';
  const sourceText = record.tacticalDecisionFlow.mitigation.sourceSummary.length
    ? record.tacticalDecisionFlow.mitigation.sourceSummary.join(', ')
    : noCurrentDataText;
  const cards = [
    ['Tactical Posture', record.mitigationDecisionSupport.tacticalPosture, 'Incomplete or changing conditions prevent an automatic posture.', 'Select posture with field monitoring and Incident Command.'],
    ['Entry / Non-entry Decision', record.mitigationDecisionSupport.entryDecision, 'Entry conditions and responder protection require verification.', 'Do not enter until protection, monitoring, task, and IC approval are established.'],
    ['Spill / Release Control', record.mitigationDecisionSupport.spillReleaseControl, 'Display is limited to directly available source guidance.', 'Contain or control only when source guidance, conditions, PPE, and IC authorization support the action.'],
    ['Neutralization', record.mitigationDecisionSupport.neutralization, 'Neutralization is blocked unless specifically source-backed.', 'Do not neutralize without verified source guidance and IC approval.'],
    ['Vapor / Fire Control', record.mitigationDecisionSupport.vaporFireControl, 'No tactic is inferred when direct guidance is missing.', 'Verify source guidance, runoff impact, and current conditions before action.'],
    ['Environmental / Runoff Control', record.mitigationDecisionSupport.environmentalRunoff, 'Environmental controls must match current source guidance and site conditions.', 'Confirm runoff containment and environmental protection actions.'],
    ['Required Verification Before Action', record.mitigationDecisionSupport.requiredVerification, 'Missing or unverified data remains No Current Data Exists.', 'Resolve listed verification needs and obtain Incident Command approval.'],
  ];
  cards.forEach(([label, value, limitation, actionPrompt]) => {
    const card = document.createElement('article');
    card.className = 'guided-mitigation-card';
    const cardTitle = document.createElement('h4');
    cardTitle.textContent = label;
    const cardStatus = document.createElement('strong');
    cardStatus.textContent = guidedDisplayValue(value);
    const cardSource = document.createElement('small');
    cardSource.textContent = `Sources reviewed: ${sourceText}`;
    const cardLimitation = document.createElement('p');
    cardLimitation.textContent = `Limitation: ${limitation}`;
    const cardAction = document.createElement('p');
    cardAction.textContent = `Action prompt: ${actionPrompt}`;
    card.append(cardTitle, cardStatus, cardSource, cardLimitation, cardAction);
    grid.append(card);
  });
  section.append(heading, grid);
  return section;
}

function guidedRouteFirstAid(values, route) {
  const rows = Array.isArray(values) ? values : [];
  const pattern = new RegExp(`^(?:${route})\\s*:`, 'i');
  const matches = rows.filter((value) => pattern.test(String(value || '').trim()));
  return matches.length ? matches : [noCurrentDataText];
}

function renderGuidedResponse() {
  const container = document.getElementById('guided-response-content');
  const status = document.getElementById('guided-response-action-status');
  const saveRecordButton = document.getElementById('guided-save-record-btn');
  const saveIncidentButton = document.getElementById('guided-save-incident-btn');
  const modeStatus = document.getElementById('guided-response-mode-status');
  if (!container) return;
  container.replaceChildren();
  window.HazMatIQ.guidedResponseDecisionRecord = null;
  if (status) status.textContent = '';
  if (saveRecordButton) saveRecordButton.disabled = true;
  const activeIncident = getActiveIncident();
  if (modeStatus) {
    modeStatus.textContent = activeIncident
      ? 'Active Incident Mode — tactical decision record saved to this incident.'
      : 'Planning Mode — tactical decision record saved locally, not attached to an incident.';
  }
  if (saveIncidentButton) {
    saveIncidentButton.disabled = true;
    saveIncidentButton.title = activeIncident ? '' : 'Start or select an active incident to save this guided response.';
  }

  const profile = activeChemicalRecord?.profile;
  if (!activeChemical || !profile) {
    const empty = document.createElement('article');
    empty.className = 'panel-card guided-response-empty';
    empty.textContent = 'No chemical selected. Return to HAZARD ID and select a Chemical Companion master record.';
    container.append(empty);
    return;
  }

  const unresolved = isUnreviewedTransportationRecord(activeChemicalRecord) || !activeChemical.selectedChemicalId;
  if (unresolved) {
    const blocked = document.createElement('article');
    blocked.className = 'panel-card guided-response-empty guided-response-blocked';
    blocked.textContent = 'Chemical-specific response guidance requires a verified Chemical Companion master link.';
    container.append(blocked);
    return;
  }

  if (saveRecordButton) saveRecordButton.disabled = false;
  if (saveIncidentButton) saveIncidentButton.disabled = !activeIncident;

  const missingPlumeInputs = getMissingPlumeRequiredInputs();
  const savedPlumeWorkflow = activeIncident?.plumeModelResults || readPlanningState().plumeModelResults || null;
  const savedPlumeResult = savedPlumeWorkflow?.plumeResult || savedPlumeWorkflow;
  const identityStatus = 'Verified Chemical Companion Master Record';
  const buildDecisions = window.HazMatIQGuidedResponse?.buildGuidedResponseDecisions;
  if (!buildDecisions) {
    const unavailable = document.createElement('article');
    unavailable.className = 'panel-card guided-response-empty guided-response-blocked';
    unavailable.textContent = 'Guided Response decision logic did not load. No tactical guidance is displayed.';
    container.append(unavailable);
    return;
  }
  const decisions = buildDecisions({
    masterLinked: true,
    masterChemicalId: activeChemical.selectedChemicalId,
    chemicalName: profile.header?.name,
    transportationIdentifier: profile.header?.un,
  }, {
    profile,
    approvedSources: [...guidedProfileSources(profile), ...(activeChemicalRecord.summarySources || [])],
    responderGuide: activeChemicalRecord.responderGuide,
    ppeReference: activeChemicalRecord.ppeReference,
    ppeComponents: activeChemicalRecord.ppeComponents,
  }, {
    missingInputs: missingPlumeInputs,
    status: savedPlumeResult?.model?.confidenceStatus || (missingPlumeInputs.length ? 'Requires Verification' : 'Existing plume inputs complete'),
    confidenceLevel: savedPlumeResult?.model?.confidenceLevel || savedPlumeResult?.confidenceLevel || savedPlumeResult?.model?.confidenceStatus || 'Insufficient Data',
    endpointSelected: savedPlumeResult?.endpoint?.endpointSource
      ? `${savedPlumeResult.endpoint.endpointSource} ${savedPlumeResult.endpoint.selectedDuration}-minute`
      : '',
    zoneMeaning: savedPlumeResult?.endpoint?.endpointSource
      ? 'Red AEGL-3 · Orange AEGL-2 · Yellow AEGL-1'
      : '',
  }, {
    status: savedPlumeResult?.weather?.sourceStatus || 'Requires Verification',
  });

  const now = new Date().toISOString();
  const decisionRecord = {
    id: `guided-response-${activeChemical.selectedChemicalId}`,
    mode: activeIncident ? 'active-incident' : 'planning',
    incidentId: activeIncident?.incidentId || null,
    createdAt: now,
    updatedAt: now,
    selectedChemicalSummary: {
      chemicalId: activeChemical.selectedChemicalId,
      chemicalName: guidedDisplayValue(profile.header?.name),
      transportationIdentifier: guidedDisplayValue(profile.header?.un),
      majorHazardClass: guidedDisplayValue(profile.header?.hazard),
      masterRecordStatus: identityStatus,
    },
    ppeRecommendation: profile.ppeRecommendation,
    tacticalDecisionFlow: {
      identifyAnalyze: decisions.identifyAnalyze,
      verifyIsolate: decisions.verifyIsolate,
      lifeSafety: decisions.lifeSafety,
      mitigation: decisions.mitigation,
    },
    mitigationDecisionSupport: decisions.mitigationDecisionSupport,
    evidenceObjects: decisions.evidenceObjects,
    missingDataWarnings: decisions.missingDataWarnings,
    sourceSummaries: decisions.sourceSummaries,
    executionNotes: decisions.executionNotes,
    disclaimers: [
      'Guided Response provides decision-support planning only.',
      'Missing, outdated, unsupported, or unverified values must be treated as No Current Data Exists.',
      'Final mitigation strategy must be approved by Incident Command.',
    ],
    readyForIncidentExport: true,
  };
  window.HazMatIQ.guidedResponseDecisionRecord = decisionRecord;

  const chemicalData = selectedChemicalOperationalData();
  const chemicalStrip = document.createElement('section');
  chemicalStrip.className = 'guided-chemical-strip';
  [
    ['Chemical', chemicalData.chemicalName],
    ['UN/NA', chemicalData.unNumber],
    ['Hazard Class', chemicalData.hazardClass],
    ['IDLH', chemicalData.idlh],
  ].forEach(([label, value]) => {
    const item = document.createElement('div');
    const term = document.createElement('span');
    const detail = document.createElement('strong');
    term.textContent = label;
    detail.textContent = incidentCommandValue(value);
    item.append(term, detail);
    chemicalStrip.append(item);
  });

  const flow = document.createElement('section');
  flow.className = 'panel-card guided-tactical-flow';
  const flowHeading = document.createElement('div');
  flowHeading.className = 'guided-tactical-section-heading';
  const flowTitle = document.createElement('h3');
  flowTitle.textContent = 'Tactical Decision Flow';
  const flowSubtitle = document.createElement('p');
  flowSubtitle.textContent = 'Source-backed response planning using Chemical Companion, ERG, NIOSH, and CAMEO.';
  flowHeading.append(flowTitle, flowSubtitle);
  const identifyDecision = decisionRecord.tacticalDecisionFlow.identifyAnalyze;
  const verifyDecision = decisionRecord.tacticalDecisionFlow.verifyIsolate;
  const lifeDecision = decisionRecord.tacticalDecisionFlow.lifeSafety;
  const mitigationDecision = decisionRecord.tacticalDecisionFlow.mitigation;
  const missingText = (decision) => decision.missingData.length
    ? decision.missingData.map((field) => `${field}: ${noCurrentDataText}`).join(' · ')
    : 'No missing values identified in this decision.';
  const actionText = (decision) => decision.tacticalActions.length
    ? decision.tacticalActions.join(' · ')
    : noCurrentDataText;
  const identifyFlow = createTacticalFlowBox('Identify / Analyze', identifyDecision.status, [
    { label: 'Primary Decision', value: identifyDecision.primaryDecision },
    { label: 'Direct Guidance', value: identifyDecision.directGuidance },
    { label: 'Selected Chemical', value: identifyDecision.specificValues.chemicalName },
    { label: 'Master Record', value: identifyDecision.specificValues.masterChemicalId },
    { label: 'Transportation ID', value: identifyDecision.specificValues.transportationIdentifier },
    { label: 'Major Hazard', value: identifyDecision.specificValues.majorHazardClass },
    { label: 'Missing Data', value: missingText(identifyDecision) },
    { label: 'Confidence', value: identifyDecision.confidence },
    { label: 'Tactical Actions', value: actionText(identifyDecision) },
  ], identifyDecision.sourceSummary);
  const verifyFlow = createTacticalFlowBox('Verify and Isolate', verifyDecision.status, [
    { label: 'Primary Tactical Question', value: 'What isolation, protective action, and perimeter controls are supported by verified data?' },
    { label: 'Primary Decision', value: verifyDecision.primaryDecision },
    { label: 'Direct Guidance', value: verifyDecision.directGuidance },
    { label: 'ERG Guide', value: verifyDecision.specificValues.ergGuide },
    { label: 'Initial Isolation', value: verifyDecision.specificValues.initialIsolation },
    { label: 'Large Spill Isolation', value: verifyDecision.specificValues.largeSpillIsolation },
    { label: 'Protective Action', value: verifyDecision.specificValues.protectiveAction },
    { label: 'Day / Night Protective Action', value: verifyDecision.specificValues.dayNightProtectiveAction },
    { label: 'Evacuate / Shelter', value: verifyDecision.specificValues.evacuationShelter },
    { label: 'Wind / Weather Verification', value: verifyDecision.specificValues.weatherStatus },
    { label: 'Plume Estimate', value: verifyDecision.specificValues.plumeStatus },
    { label: 'AEGL / LOC Endpoint', value: verifyDecision.specificValues.endpointSelected },
    { label: 'Zone Meaning', value: verifyDecision.specificValues.zoneMeaning },
    { label: 'Field Monitoring', value: verifyDecision.specificValues.fieldMonitoringRequirement },
    { label: 'Missing Data', value: missingText(verifyDecision) },
    { label: 'Tactical Actions', value: actionText(verifyDecision) },
  ], verifyDecision.sourceSummary, true);
  const lifeFlow = createTacticalFlowBox('Life Safety', lifeDecision.status, [
    { label: 'Is SCBA Mandated?', value: lifeDecision.specificValues.scbaDecision },
    { label: 'Recommended Protection Level', value: lifeDecision.specificValues.recommendedProtectionLevel },
    { label: 'Why This Level', value: lifeDecision.specificValues.whySelected },
    { label: 'Verify Before Entry', value: lifeDecision.specificValues.requiredVerification },
    { label: 'Level C Status', value: lifeDecision.specificValues.levelCAllowed ? 'Allowed only while all verified conditions remain satisfied.' : `Blocked — ${lifeDecision.specificValues.levelCBlockedReason}` },
    { label: 'Direct Guidance', value: lifeDecision.directGuidance },
    { label: 'Cartridge Status', value: lifeDecision.specificValues.cartridgeStatus },
    { label: 'Plume Planning Impact', value: lifeDecision.specificValues.plumePlanningImpact },
    { label: 'Source-backed Limitations', value: lifeDecision.limitations },
    { label: 'Missing Data', value: missingText(lifeDecision) },
    { label: 'Tactical Actions', value: actionText(lifeDecision) },
  ], lifeDecision.sourceSummary, true);
  const mitigationFlow = createTacticalFlowBox('Mitigation', decisionRecord.tacticalDecisionFlow.mitigation.status, [
    { label: 'Primary Decision', value: mitigationDecision.primaryDecision },
    { label: 'Direct Guidance', value: mitigationDecision.directGuidance },
    { label: 'Tactical Posture', value: mitigationDecision.specificValues.tacticalPosture },
    { label: 'Entry / Non-entry', value: mitigationDecision.specificValues.entryDecision },
    { label: 'Contain / Control', value: mitigationDecision.specificValues.spillReleaseControl },
    { label: 'Non-intervention', value: mitigationDecision.specificValues.nonInterventionConsiderations },
    { label: 'Neutralization', value: mitigationDecision.specificValues.neutralization },
    { label: 'Vapor / fire control', value: decisionRecord.mitigationDecisionSupport.vaporFireControl },
    { label: 'Runoff / environment', value: decisionRecord.mitigationDecisionSupport.environmentalRunoff },
    { label: 'Missing Data', value: missingText(mitigationDecision) },
    { label: 'Tactical Actions', value: actionText(mitigationDecision) },
  ], decisionRecord.tacticalDecisionFlow.mitigation.sourceSummary, true);
  flow.append(flowHeading, identifyFlow, createTacticalFlowArrow(), verifyFlow, createTacticalFlowArrow(), lifeFlow, createTacticalFlowArrow(), mitigationFlow);
  container.append(chemicalStrip, flow, createMitigationDecisionSupport(decisionRecord));
}

const chemicalSearchForm = document.getElementById('chemical-search-form');
const chemicalSearchInput = document.getElementById('chemical-search');
const chemicalSearchSuggestions = document.getElementById('chemical-search-suggestions');
const chemicalSearchStatus = document.getElementById('chemical-search-status');
const chemicalIdResults = document.getElementById('chemical-id-results');
const facilityInventory = document.getElementById('facility-inventory');
const hazardProfileResults = document.getElementById('hazard-profile-results');
const hazardEmptyProfile = document.getElementById('hazard-id-empty-profile');

const hazardLaneUi = Object.freeze({
  CHEMICAL: {
    label: 'Chemical',
    modeLabel: 'Chemical Intelligence',
    title: 'Chemical Identification',
    description: 'Search chemical name, CAS, UN/NA, ERG, synonym, or facility.',
    placeholder: 'Search Chemical Name, CAS, UN, ERG...',
    examples: ['Chlorine', 'Ammonia', 'Diesel Fuel', 'Sodium Hydroxide', 'UN1017'],
  },
  CBRNE_CWA: {
    label: 'CBRNE & CWA',
    modeLabel: 'CBRNE / CWA Intelligence',
    title: 'Warfare Agents Identification',
    description: 'Search nerve, blister, blood, choking, biological, or CBRNE agent records.',
    placeholder: 'Search Sarin, VX, Mustard, Ricin...',
    examples: ['Sarin', 'VX', 'Mustard', 'Ricin'],
    emblem: 'CB',
    tabs: [
      ['Overview', ['overviewFacts', 'hazardFacts']], ['Health / Exposure', ['hazardFacts', 'medicalFacts']],
      ['PPE / Respiratory', ['ppeFacts']], ['Detection', ['detectionFacts']],
      ['Sampling / Analysis', ['samplingFacts', 'analysisFacts']], ['Decon', ['deconFacts']],
      ['Medical', ['medicalFacts']], ['Protective Actions', ['isolationStandoffFacts', 'protectiveActionFacts']],
      ['Command / Coordination', ['technicalOperationsFacts']], ['Sources', ['sourceFacts']],
    ],
  },
  RADIOLOGICAL: {
    label: 'Radiological',
    modeLabel: 'Radiological Intelligence',
    title: 'Radiological Identification',
    description: 'Search isotope, radioactive material, package type, RDD, or radiological type.',
    placeholder: 'Search Cesium-137, Cobalt-60, Iridium-192...',
    examples: ['Cesium-137', 'Cobalt-60', 'Iridium-192', 'RDD'],
    emblem: 'RAD',
    tabs: [
      ['Overview', ['overviewFacts', 'hazardFacts']], ['Health / Exposure', ['hazardFacts', 'medicalFacts']],
      ['Physics', ['physicsFacts']], ['Radiation Operations', ['radOperationsFacts']],
      ['PPE / Contamination', ['ppeFacts']], ['Detection / Survey', ['detectionFacts']],
      ['Sampling / Analysis', ['samplingFacts', 'analysisFacts']], ['Decon', ['deconFacts']],
      ['Medical', ['medicalFacts']], ['Protective Actions', ['isolationStandoffFacts', 'protectiveActionFacts']],
      ['Command / Coordination', ['technicalOperationsFacts']], ['Sources', ['sourceFacts']],
    ],
  },
});

let activeHazardSearchLane = 'CHEMICAL';
let activeStarterHazardProfile = null;

function renderHazardSearchMode(lane) {
  const config = hazardLaneUi[lane];
  if (!config) return;
  activeHazardSearchLane = lane;
  document.querySelectorAll('[data-hazard-search-tab]').forEach((tab) => {
    const active = tab.dataset.hazardSearchTab === lane;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  setText('hazard-search-mode-label', config.modeLabel);
  setText('hazard-search-mode-title', config.title);
  setText('hazard-search-mode-description', config.description);
  const label = document.getElementById('hazard-search-label');
  if (label) label.textContent = config.placeholder.replace(/\.\.\.$/, '');
  if (chemicalSearchInput) {
    chemicalSearchInput.value = '';
    chemicalSearchInput.placeholder = config.placeholder;
  }
  const examples = document.getElementById('hazard-search-examples');
  if (examples) {
    const labelNode = document.createElement('span');
    labelNode.textContent = 'Examples:';
    const buttons = config.examples.map((example) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.hazardUnifiedExample = example;
      button.textContent = example;
      return button;
    });
    examples.replaceChildren(labelNode, ...buttons);
  }
  clearChemicalSuggestions();
  setChemicalSearchStatus('');
}

function setHazardProfileMode(mode) {
  const lookup = document.getElementById('lookup');
  const searchHero = document.getElementById('hazard-id-search-hero');
  const searchWorkspace = document.getElementById('hazard-id-search-workspace');
  const searchState = mode === 'empty';
  if (lookup) lookup.dataset.hazardPageState = mode === 'chemical'
    ? 'chemical-profile'
    : mode === 'starter' ? 'hazard-profile' : 'search';
  if (searchHero) searchHero.hidden = !searchState;
  if (searchWorkspace) searchWorkspace.hidden = !searchState;
  if (!searchState && facilityInventory) facilityInventory.hidden = true;
  if (chemicalIdResults) chemicalIdResults.hidden = mode !== 'chemical';
  if (hazardProfileResults) hazardProfileResults.hidden = mode !== 'starter';
  if (hazardEmptyProfile) hazardEmptyProfile.hidden = mode !== 'empty';
}

function hazardProfileDisplayValue(fact) {
  if (fact?.value === null || fact?.value === undefined || fact?.value === '') return noCurrentDataText;
  const value = profileArray(fact.value)
    .map((item) => item && typeof item === 'object' ? item.fieldName || item.label || JSON.stringify(item) : String(item))
    .filter(Boolean)
    .join(' · ');
  return fact.units ? `${value} ${fact.units}` : value;
}

function renderStarterHazardTab(profile, fieldNames) {
  const content = document.getElementById('hazard-profile-content');
  if (!content) return;
  const requestedFields = profileArray(fieldNames);
  const facts = requestedFields.flatMap((fieldName) => profileFacts(profile?.[fieldName]));
  const fragment = document.createDocumentFragment();
  (facts.length ? facts : [{ fieldName: 'Data status', value: null, verificationStatus: 'No Current Data Exists' }]).forEach((fact) => {
    const card = document.createElement('section');
    card.className = 'hazard-source-fact-card';
    card.dataset.state = fact.value === null || fact.value === undefined || fact.value === '' ? 'empty' : 'populated';
    const heading = document.createElement('h3');
    heading.textContent = fact.fieldName || 'Hazard information';
    const value = document.createElement('strong');
    value.textContent = hazardProfileDisplayValue(fact);
    const status = document.createElement('span');
    status.className = 'hazard-fact-status';
    status.textContent = fact.verificationStatus || 'Requires Review';
    const notes = document.createElement('p');
    notes.textContent = fact.notes || 'Requires Review';
    const source = document.createElement('small');
    const sourceLabel = [fact.sourceName || 'No linked source', fact.sourceDocumentTitle].filter(Boolean).join(' — ');
    if (fact.sourceUrl) {
      const link = document.createElement('a');
      link.href = fact.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `Source: ${sourceLabel}`;
      source.append(link);
    } else source.textContent = `Source: ${sourceLabel}`;
    if (fact.sourcePage) source.append(document.createTextNode(` · Location: ${fact.sourcePage}`));
    const provenance = document.createElement('details');
    const provenanceSummary = document.createElement('summary');
    provenanceSummary.textContent = 'Why this recommendation?';
    const provenanceText = document.createElement('p');
    provenanceText.textContent = [
      fact.sourceArtifactId ? `Artifact: ${fact.sourceArtifactId}` : 'Artifact: not linked',
      `Locator: ${fact.sourceLocator || fact.sourcePage || 'not available'}`,
      `Review: ${fact.detailedReviewStatus || fact.verificationStatus || 'Requires Review'}`,
      ...profileArray(fact.limitations),
    ].join(' · ');
    provenance.append(provenanceSummary, provenanceText);
    card.append(heading, value, status, notes, source, provenance);
    fragment.append(card);
  });
  if (requestedFields.includes('technicalOperationsFacts') && profileArray(profile.limitations).length) {
    const safetyCard = document.createElement('section');
    safetyCard.className = 'hazard-source-fact-card hazard-guided-safety-card';
    const heading = document.createElement('h3');
    heading.textContent = 'Guided Response Safety Gates';
    const list = document.createElement('ul');
    profileArray(profile.limitations).forEach((limitation) => {
      const item = document.createElement('li');
      item.textContent = limitation;
      list.append(item);
    });
    safetyCard.append(heading, list);
    fragment.append(safetyCard);
  }
  content.replaceChildren(fragment);
}

function renderStarterHazardProfile(profile) {
  profile = normalizeHazardProfileForUi(profile);
  const config = hazardLaneUi[profile?.lane];
  if (!config) return;
  activeStarterHazardProfile = profile;
  setHazardProfileMode('starter');
  setText('hazard-profile-toolbar-title', profile.lane === 'CBRNE_CWA' ? 'CBRNE Hazard Profile' : 'Radiological Hazard Profile');
  const category = String(profile.category || '').replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toLocaleUpperCase());
  setText('hazard-profile-lane', `${config.label} — ${category}`);
  setText('hazard-profile-name', profile.displayName);
  setText('hazard-profile-category', [profile.scientificName, category].filter(Boolean).join(' · '));
  setText('hazard-profile-emblem', config.emblem);
  const status = document.getElementById('hazard-profile-status');
  if (status) {
    const badges = profile.dataStatusBadges?.length ? profile.dataStatusBadges : [profile.verificationStatus || 'Requires SME Review'];
    status.replaceChildren(...badges.map((label) => {
      const badge = document.createElement('span');
      badge.className = 'chemical-profile-status-chip';
      badge.dataset.state = label === 'Source Imported' ? 'source-imported' : label === 'No Current Data Exists' ? 'empty' : 'review';
      badge.textContent = label;
      return badge;
    }));
  }
  const sourceStatus = profileObject(profile.sourceStatus);
  const sourceNames = profileArray(sourceStatus.sourceNames);
  const sourceWarnings = profileArray(sourceStatus.warnings);
  setText('hazard-profile-source-summary', sourceNames.length ? sourceNames.join(' · ') : noCurrentDataText);
  setText('hazard-profile-source-pack-count', String(sourceStatus.sourcePacksLoaded || 0));
  setText('hazard-profile-source-fact-count', String(sourceStatus.sourceFactCount || 0));
  setText('hazard-profile-source-names', sourceNames.join(' · ') || 'None');
  setText('hazard-profile-review-count', String(sourceStatus.requiresSmeReviewCount || 0));
  setText('hazard-profile-conflict-count', String(sourceStatus.conflictingSourcesCount || 0));
  setText('hazard-profile-missing-count', String(sourceStatus.missingFieldCount || 0));
  setText('hazard-profile-last-import', sourceStatus.lastImportUpdate || 'Not imported');
  setText('hazard-profile-import-warnings', sourceWarnings.join(' · ') || 'No warnings');
  const dataStatus = sourceStatus.conflictingSourcesCount
    ? 'Conflicting Sources'
    : profile.verificationStatus || (sourceStatus.sourceFactCount ? 'Source Imported' : noCurrentDataText);
  const confidenceLevel = sourceStatus.conflictingSourcesCount
    ? 'Requires Review'
    : dataStatus === 'Verified'
      ? 'High'
      : sourceStatus.sourceFactCount
        ? 'Requires Review'
        : noCurrentDataText;
  setText('hazard-profile-data-summary', dataStatus);
  setText('hazard-profile-confidence-level', confidenceLevel);
  const identifiers = document.getElementById('hazard-profile-identifiers');
  if (identifiers) {
    identifiers.replaceChildren();
    const identifierEntries = [
      ['UN/NA', profile.identifiers?.unNaNumbers],
      ['ERG Guide', profile.identifiers?.ergGuide],
      ['Hazard Class', category || noCurrentDataText],
    ];
    identifierEntries.forEach(([label, rawValue]) => {
      const values = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
      const item = document.createElement('span');
      const itemLabel = document.createElement('small');
      itemLabel.textContent = label;
      const itemValue = document.createElement('strong');
      itemValue.textContent = values.length ? values.join(' · ') : noCurrentDataText;
      item.append(itemLabel, itemValue);
      identifiers.append(item);
    });
  }
  const overviewList = document.getElementById('hazard-profile-overview-list');
  if (overviewList) {
    const overviewFacts = [...profileFacts(profile.hazardFacts), ...profileFacts(profile.overviewFacts)]
      .filter((fact) => fact?.fieldName && fact.value !== null && fact.value !== undefined && fact.value !== '')
      .slice(0, 4);
    const items = overviewFacts.map((fact) => {
      const item = document.createElement('li');
      const marker = document.createElement('span');
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = '◆';
      const text = document.createElement('span');
      text.textContent = `${fact.fieldName}: ${hazardProfileDisplayValue(fact)}`;
      item.append(marker, text);
      return item;
    });
    if (!items.length) {
      const item = document.createElement('li');
      item.textContent = noCurrentDataText;
      items.push(item);
    }
    overviewList.replaceChildren(...items);
  }
  const actionGrid = document.getElementById('hazard-profile-action-cards');
  if (actionGrid) {
    actionGrid.replaceChildren(...profileArray(profile.actionCards).map((action) => {
      const card = document.createElement('article');
      const heading = document.createElement('h3');
      heading.textContent = action.title;
      const badge = document.createElement('span');
      badge.textContent = action.status;
      badge.dataset.status = action.status;
      const summary = document.createElement('p');
      summary.textContent = action.summary;
      card.append(heading, badge, summary);
      return card;
    }));
  }
  const limitations = document.getElementById('hazard-profile-limitations');
  if (limitations) {
    limitations.replaceChildren();
    if (profileArray(profile.limitations).length) {
      const heading = document.createElement('h3');
      heading.textContent = 'Safety Gates';
      const list = document.createElement('ul');
      profileArray(profile.limitations).forEach((limitation) => {
        const item = document.createElement('li');
        item.textContent = limitation;
        list.append(item);
      });
      limitations.append(heading, list);
    }
  }
  const tabs = document.getElementById('hazard-profile-tabs');
  if (tabs) {
    tabs.replaceChildren();
    config.tabs.forEach(([label, fieldNames], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chemical-profile-tab${index === 0 ? ' active' : ''}`;
      button.textContent = label;
      button.setAttribute('aria-selected', String(index === 0));
      button.addEventListener('click', () => {
        tabs.querySelectorAll('button').forEach((tab) => {
          const active = tab === button;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-selected', String(active));
        });
        renderStarterHazardTab(profile, fieldNames);
      });
      tabs.append(button);
    });
  }
  const plumeButton = document.getElementById('hazard-profile-plume-btn');
  if (plumeButton) {
    plumeButton.disabled = true;
    plumeButton.title = profile.lane === 'RADIOLOGICAL'
      ? 'Radiological plume/standoff requires radiological model support.'
      : 'Plume requires verified endpoint/source data.';
  }
  renderStarterHazardTab(profile, ['overviewFacts', 'hazardFacts']);
}

async function openStarterHazard(result) {
  const profile = await fetchJson(`/api/hazards/${encodeURIComponent(result.lane)}/${encodeURIComponent(result.id)}/profile`);
  if (!profile || profile.error) return;
  renderStarterHazardProfile(profile);
  hazardProfileResults?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderHazardLaneResults(lane, results) {
  const config = hazardLaneUi[lane];
  const container = chemicalSearchSuggestions;
  if (!container) return;
  container.replaceChildren();
  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'hazard-lane-empty';
    empty.textContent = 'No matching starter identity record. No Current Data Exists.';
    container.append(empty);
    container.hidden = false;
    chemicalSearchInput?.setAttribute('aria-expanded', 'true');
    setChemicalSearchStatus('No matching hazard records found.', 'error');
    return;
  }
  results.forEach((result) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hazard-search-result-card';
    const aliases = [...(result.aliases || []), ...(result.agentCodes || [])].filter((value, index, values) => values.indexOf(value) === index);
    const resultName = [result.displayName, result.scientificName].filter(Boolean).join(' / ');
    button.innerHTML = `<strong>${resultName}</strong><span>${config.label} — ${result.category}</span><small>${aliases.length ? `Aliases: ${aliases.join(' · ')} · ` : ''}Status: ${result.verificationStatus}</small>`;
    button.addEventListener('click', () => {
      if (chemicalSearchInput) chemicalSearchInput.value = result.displayName;
      clearChemicalSuggestions();
      void openStarterHazard(result);
    });
    container.append(button);
  });
  container.hidden = false;
  chemicalSearchInput?.setAttribute('aria-expanded', 'true');
  setChemicalSearchStatus(`${results.length} matching hazard record${results.length === 1 ? '' : 's'}.`);
}

async function searchHazardLane(lane, query, { submit = false } = {}) {
  const normalized = String(query || '').trim();
  const config = hazardLaneUi[lane];
  if (!config || !normalized) {
    renderHazardLaneResults(lane, []);
    return;
  }
  const response = await fetchJson(`/api/hazards/search?lane=${encodeURIComponent(lane)}&q=${encodeURIComponent(normalized)}`);
  const results = response?.results || [];
  renderHazardLaneResults(lane, results);
  if (submit && results[0]) await openStarterHazard(results[0]);
}

document.querySelectorAll('[data-hazard-search-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    renderHazardSearchMode(tab.dataset.hazardSearchTab);
    chemicalSearchInput?.focus();
  });
});

document.getElementById('hazard-search-examples')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-hazard-unified-example]');
  if (!button) return;
  const query = button.dataset.hazardUnifiedExample || '';
  if (chemicalSearchInput) chemicalSearchInput.value = query;
  if (activeHazardSearchLane === 'CHEMICAL') void searchChemicalId(query, { submit: true });
  else void searchHazardLane(activeHazardSearchLane, query, { submit: true });
});

document.getElementById('hazard-profile-back-btn')?.addEventListener('click', () => setHazardProfileMode('empty'));
document.getElementById('hazard-profile-export-btn')?.addEventListener('click', () => {
  if (!activeStarterHazardProfile) return;
  const blob = new Blob([JSON.stringify(activeStarterHazardProfile, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${String(activeStarterHazardProfile.displayName || 'hazard-profile').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
document.getElementById('hazard-profile-save-btn')?.addEventListener('click', (event) => {
  if (!activeStarterHazardProfile) return;
  try {
    const storageKey = 'hazmatiq.savedHazards';
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    const next = saved.filter((item) => !(item.id === activeStarterHazardProfile.id && item.lane === activeStarterHazardProfile.lane));
    next.push({ id: activeStarterHazardProfile.id, lane: activeStarterHazardProfile.lane, displayName: activeStarterHazardProfile.displayName, savedAt: new Date().toISOString() });
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    event.currentTarget.textContent = 'Saved to My Hazards';
  } catch {
    event.currentTarget.textContent = 'Save Unavailable';
  }
});
let chemicalSearchTimer = null;
let latestChemicalSearch = 0;
let latestChemicalProfileRequest = 0;
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
  const rows = responderText.formatResponderGuidance((items || []).filter(Boolean));
  list.replaceChildren(...(rows.length ? rows : [emptyMessage]).map((textValue) => {
    const item = document.createElement('li');
    item.textContent = textValue;
    if (/\bIDLH\b/i.test(textValue)) item.dataset.field = 'idlh';
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

function ppeItems(value) {
  return (Array.isArray(value) ? value : [value]).filter(hasAvailableProfileData);
}

function buildPpeStartingReference(record) {
  if (!record) return null;
  const profilePpe = record.profile?.ppeRespiratory || {};
  const bestMatch = String(profilePpe.bestMatch || '').trim();
  const hazMatchBest = hasAvailableProfileData(bestMatch)
    && !/no chemical-specific suit record/i.test(bestMatch)
    ? bestMatch
    : '';
  const chemicalItems = uniquePpeItems([
    ...(record.ppeReference || []),
    ...ppeItems(profilePpe.recommendedPpe),
    ...ppeItems(profilePpe.gloveSuitMaterial),
  ]);
  const niosh = record.ppeComponents?.niosh || {};
  const kappler = uniquePpeItems([
    ...(record.ppeComponents?.kappler || []),
    ...(hazMatchBest ? [hazMatchBest] : []),
  ]);
  const clothing = uniquePpeItems(chemicalItems.filter((item) => /level\s+[a-d]|suit|clothing|splash|encapsulat/i.test(item)));
  const nioshRespiratory = uniquePpeItems(niosh.respiratory || []);
  const chemicalRespiratory = uniquePpeItems(chemicalItems.filter((item) => /scba|respirat|papr|supplied[- ]air|cartridge/i.test(item)));
  const respiratory = uniquePpeItems([
    ...nioshRespiratory,
    ...chemicalRespiratory,
    ...ppeItems(profilePpe.respiratorRecommendations),
    ...ppeItems(profilePpe.aprPaprScba),
  ]);
  const nioshSkin = uniquePpeItems(niosh.skin || []);
  const chemicalSkin = uniquePpeItems(chemicalItems.filter((item) => /glove|boot|skin/i.test(item)));
  const skin = uniquePpeItems([...nioshSkin, ...chemicalSkin]);
  const nioshEye = uniquePpeItems(niosh.eye || []);
  const chemicalEye = uniquePpeItems(chemicalItems.filter((item) => /goggle|face\s*shield|eye/i.test(item)));
  const eye = uniquePpeItems([...nioshEye, ...chemicalEye]);
  const hasNiosh = nioshRespiratory.length > 0 || nioshSkin.length > 0 || nioshEye.length > 0;
  const hasData = chemicalItems.length > 0 || respiratory.length > 0 || skin.length > 0 || eye.length > 0 || kappler.length > 0;
  if (!hasData) return null;

  return {
    title: hazMatchBest || 'PPE guidance requires review',
    status: readinessStatus.imported,
    suitStatus: kappler.length || clothing.length ? readinessStatus.imported : readinessStatus.missing,
    summary: hazMatchBest
      ? 'Kappler HazMatch Best Match for the identified chemical; verify the garment and ensemble against incident conditions.'
      : 'Imported PPE source text is available, but HazMatIQ does not infer an ensemble level from incomplete source coverage.',
    source: `${readinessStatus.imported}: ${hasNiosh ? 'NIOSH NPG' : 'Chemical Companion'}${kappler.length ? ', Kappler HazMatch' : ''}.`,
    details: [
      clothing.length ? `Protective clothing — ${clothing.join('; ')}` : 'Protective clothing level: not specified.',
      respiratory.length ? `Respiratory — ${respiratory.join('; ')}` : 'Respiratory protection: not specified.',
      skin.length ? `Gloves / boots / skin — ${skin.join('; ')}` : 'Gloves / boots / skin protection: not specified.',
      eye.length ? `Eye / face — ${eye.join('; ')}` : null,
      kappler.length ? `Kappler HazMatch garment match — ${kappler.join('; ')}` : null,
      kappler.length || clothing.length ? null : 'Suit compatibility not verified from current source.',
    ].filter(Boolean),
  };
}

function shortGuidance(value) {
  const text = String(value || '').trim();
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function buildIncidentPpeSummary(record) {
  const recommendation = record?.profile?.ppeRecommendation;
  if (!recommendation) return null;
  return {
    items: [
      `Selected chemical: ${recommendation.chemicalName || record.name || noCurrentDataText}`,
      `Recommended protection level: ${recommendation.displayLabel || noCurrentDataText}`,
      `Respiratory: ${recommendation.respiratoryProtection || noCurrentDataText}`,
      `Skin / suit: ${recommendation.skinProtection || noCurrentDataText}`,
      `Verification required: ${(recommendation.verificationRequirements || []).join('; ') || noCurrentDataText}`,
      `Recommendation status: ${recommendation.recommendationStatus || noCurrentDataText}`,
    ].filter(Boolean).map(shortGuidance),
    sources: recommendation.sourcesReviewed || [],
    status: recommendation.recommendationStatus || readinessStatus.verify,
    suitStatus: recommendation.skinProtection || noCurrentDataText,
    ppeRecommendation: recommendation,
    warning: ppeSuitWarning,
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
  return items.length ? {
    items: items.slice(0, 6).map(shortGuidance),
    sources: record.summarySources,
    status: readinessStatus.imported,
    warning: medicalProtectiveWarning,
  } : null;
}

function buildIncidentProtectiveActionSummary() {
  const guidance = buildProtectiveActionGuidance();
  const hasImportedGuidance = guidance.recommendation.length > 0 || guidance.niosh.length > 0;
  const hasPlanningEstimate = guidance.cameoAloha.length > 0;
  return {
    status: hasPlanningEstimate ? readinessStatus.planning : (hasImportedGuidance ? readinessStatus.imported : readinessStatus.missing),
    importedGuidance: guidance.recommendation,
    planningEstimates: guidance.cameoAloha,
    exposureLimits: guidance.niosh,
    warning: medicalProtectiveWarning,
  };
}

function saveIncidentGuidance(ppeSummary, medicalSummary, chemicalSources, protectiveActionSummary) {
  const activeId = window.localStorage.getItem(activeIncidentIdStorageKey);
  const incidents = readIncidents();
  const index = incidents.findIndex((incident) => incident.incidentId === activeId);
  if (index < 0) return;
  incidents[index] = { ...incidents[index], ppeSummary, medicalSummary, protectiveActionSummary, chemicalSources };
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
    responderText.formatResponderGuidance(summary.items).forEach((item) => {
      const row = document.createElement('li');
      row.textContent = normalizeDataSourceOutput(item);
      list.append(row);
    });
    body.append(list);
  } else {
    body.textContent = normalizeDataSourceOutput(fallback);
  }
  const sources = (summary?.sources || []).map(normalizeDataSourceOutput).filter(Boolean);
  source.textContent = sources.length
    ? `${summary?.status || readinessStatus.verify} · Sources: ${sources.join(' / ')}`
    : (summary?.status || readinessStatus.missing);
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
  const zoneSource = `HazMatIQ Planning Plume · ${readinessStatus.planning}`;
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
    isAvailableGuidance(record.idlh) && `IDLH — ${formatIdlh(record.idlh)}`,
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
  responderText.formatResponderGuidance(items.length ? items : [fallback]).forEach((text) => {
    const row = document.createElement('li');
    row.textContent = text;
    if (/\bIDLH\b/i.test(text)) row.dataset.field = 'idlh';
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
    appendGuidanceSection(list, 'Planning Plume Reference', guidance.cameoAloha, '');
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
    renderGuidanceBox('incident-ppe-guidance', 'incident-ppe-sources', null, noCurrentDataText);
    renderGuidanceBox('incident-medical-guidance', 'incident-medical-sources', null, noCurrentDataText);
    renderProtectiveActionGuidance('incident-protective-guidance');
    return;
  }
  const ppeSummary = buildIncidentPpeSummary(activeChemicalRecord);
  const medicalSummary = buildIncidentMedicalSummary(activeChemicalRecord);
  renderGuidanceBox('incident-ppe-guidance', 'incident-ppe-sources', ppeSummary, noCurrentDataText);
  renderGuidanceBox('incident-medical-guidance', 'incident-medical-sources', medicalSummary, noCurrentDataText);
  renderProtectiveActionGuidance('incident-protective-guidance');

  saveIncidentGuidance(
    ppeSummary,
    medicalSummary,
    activeChemicalRecord.summarySources,
    buildIncidentProtectiveActionSummary(),
  );
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
    const chemicalData = selectedChemicalOperationalData();
    setText('command-chemical-status', recordLoaded ? readinessStatus.imported : readinessStatus.verify);
    setText('command-chemical-name', activeChemical.name);
    setText('command-chemical-summary', recordLoaded
      ? `UN ${incidentCommandValue(chemicalData.unNumber)} · ERG ${incidentCommandValue(chemicalData.ergGuide)}`
      : 'Loading ERG, CAMEO, and NIOSH records…');
    replaceCommandList('command-chemical-details', recordLoaded ? [
      chemicalData.initialIsolation ? `Initial isolation: ${incidentCommandValue(chemicalData.initialIsolation)}` : 'Initial isolation: not available in the loaded backend record.',
      chemicalData.protectiveAction ? `Protective action: ${incidentCommandValue(chemicalData.protectiveAction)}` : 'Protective action: not available in the loaded backend record.',
      chemicalData.idlh ? `NIOSH IDLH: ${chemicalData.idlh}` : 'NIOSH IDLH: not available in the loaded backend record.',
      `DOT class: ${incidentCommandValue(chemicalData.hazardClass)}`,
    ] : [], 'Loading chemical data…');

    setText('command-plume-status', activePlumeCommand ? readinessStatus.planning : readinessStatus.missing);
    setText('command-plume-title', activePlumeCommand?.title || 'No active plume');
    setText('command-plume-summary', activePlumeCommand?.summary || 'Confirm the release and weather inputs before plotting.');
    replaceCommandList('command-plume-details', activePlumeCommand?.details || [], 'No plume model has been plotted.');
    setText('command-protective-status', activeChemicalRecord ? readinessStatus.imported : readinessStatus.missing);
    renderProtectiveActionGuidance('command-protective-guidance');

    const recommendation = activeChemicalRecord?.profile?.ppeRecommendation;
    setText('command-ppe-status', recommendation?.recommendationStatus || readinessStatus.missing);
    setText('command-ppe-title', recommendation?.displayLabel || noCurrentDataText);
    setText('command-ppe-summary', recommendation?.respiratoryProtection || 'No source-attributed PPE recommendation is available for this chemical.');
    replaceCommandList('command-ppe-details', recommendation ? [
      `Skin / suit: ${recommendation.skinProtection}`,
      `Cartridge: ${recommendation.cartridgeRequirement}`,
      `Verification required: ${(recommendation.verificationRequirements || []).join('; ') || noCurrentDataText}`,
      `Sources reviewed: ${(recommendation.sourcesReviewed || []).join(', ') || noCurrentDataText}`,
    ] : [], 'No source-attributed PPE recommendation loaded.');
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
  if (plotButton) plotButton.disabled = false;
  setText('plume-input-status', '');
  updatePlumeInputSummaries();
}

function setActiveChemical(chemical, { persist = true, clearOverlay = true } = {}) {
  const nextSelectedChemicalId = normalizeChemicalSelectionId(chemical?.selectedChemicalId ?? chemical?.ChemicalID ?? chemical?.id ?? null);
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
    clearErgIsolationOverlay();
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
    const incidentSelection = JSON.parse(window.localStorage.getItem(selectedChemicalStorageKey) || 'null');
    const incident = getActiveIncident();
    const saved = activeChemical || (incident?.selectedChemicalId
      ? { id: incident.selectedChemicalId, name: incident.chemicalName }
      : incident ? incidentSelection : readPlanningState().selectedChemical);
    const savedId = saved?.selectedChemicalId ?? saved?.id;
    const selectionAtStart = selectedChemicalId;
    if (savedId === null || savedId === undefined || savedId === '') {
      syncPlumeChemicalSelection();
      return;
    }
    const chemical = await fetchJson(`/api/chemicals/${encodeURIComponent(savedId)}`);
    if (selectedChemicalId !== selectionAtStart) return;
    if (chemical && !chemical.error) {
      setActiveChemical(chemical, { persist: false, clearOverlay: false });
      const recordPromise = buildFullChemicalRecord(chemical).catch(() => null);
      const profileRecord = await fetchPrimaryChemicalProfile(chemical);
      if (String(activeChemical?.id) !== String(savedId)) return;
      const record = profileRecord || await recordPromise;
      if (!record) {
        setIncidentStatus(`Database information for ${chemical.name || 'this chemical'} could not be loaded.`);
        syncPlumeChemicalSelection();
        return;
      }
      activeChemicalRecord = profileRecord || record;
      applyChemicalContainerProfile();
      restoreIncidentContainerData();
      updateActiveIncidentRecord();
      renderIncidentCommandSnapshot();
      syncPlumeChemicalSelection();
      if (profileRecord) {
        void recordPromise.then((enrichment) => {
          if (!enrichment || String(activeChemical?.id) !== String(savedId)) return;
          activeChemicalRecord = { ...enrichment, ...profileRecord };
          applyChemicalContainerProfile();
          updateActiveIncidentRecord();
          renderIncidentCommandSnapshot();
        });
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

function chemicalProfileRecord(chemical, profile) {
  const selectedId = normalizeChemicalSelectionId(
    chemical?.selectedChemicalId ?? chemical?.ChemicalID ?? chemical?.id,
  );
  const header = profile?.header || {};
  const idlh = header.idlh || profile?.exposures?.idlh || '';
  return {
    id: String(selectedId),
    selectedChemicalId: selectedId,
    name: header.name || chemical?.ChemicalName || chemical?.name || 'Select a chemical',
    cas: header.cas || chemical?.cas || chemical?.CasNumber || '',
    un: header.un || chemical?.un || chemical?.UnnaNumber || 'N/A',
    ergGuide: header.ergGuide || chemical?.ergGuide || chemical?.ErgNumber || 'N/A',
    dotClass: header.hazardClass || header.hazard || chemical?.dotClass || 'N/A',
    idlh: formatIdlh(idlh),
    nioshSourceId: profile?.niosh?.sourceRecordId || '',
    nioshIdentityStatus: profile?.niosh?.status || '',
    summarySources: chemicalProfileSources(profile),
    profile: { ...profile, activeTab: 'overview' },
  };
}

async function fetchPrimaryChemicalProfile(chemical) {
  const selectedId = normalizeChemicalSelectionId(
    chemical?.selectedChemicalId ?? chemical?.ChemicalID ?? chemical?.id,
  );
  if (selectedId === null || selectedId === undefined || selectedId === '') return null;
  const profile = await fetchJson(`/api/chemicals/${encodeURIComponent(selectedId)}/profile`);
  return profile && !profile.error ? chemicalProfileRecord(chemical, profile) : null;
}

function clearChemicalSuggestions() {
  if (!chemicalSearchSuggestions) return;
  chemicalSearchSuggestions.replaceChildren();
  chemicalSearchSuggestions.hidden = true;
  chemicalSearchInput?.setAttribute('aria-expanded', 'false');
}

renderHazardSearchMode('CHEMICAL');

async function openChemical(chemical, facilityName = '') {
  if (chemical.recordType === 'transportation-identifier' || chemical.guidanceEligible === false) {
    setChemicalSearchStatus(chemical.reviewWarning || 'This transport identifier has not been verified against a Chemical Companion master chemical record. Do not use it for IDLH, PPE, plume, decon, or medical guidance until reviewed.', 'error');
    return;
  }
  const chosenChemicalId = normalizeChemicalSelectionId(chemical.selectedChemicalId ?? chemical.ChemicalID ?? chemical.id);
  const chosenChemicalName = chemical.ChemicalName || chemical.name;
  const profileRequestId = ++latestChemicalProfileRequest;
  setActiveChemical({ ...chemical, selectedChemicalId: chosenChemicalId });
  console.info('[chemical-companion] selection', {
    selectedChemicalId: chosenChemicalId,
    ChemicalName: chosenChemicalName,
  });
  latestChemicalSearch += 1;
  window.clearTimeout(chemicalSearchTimer);
  setChemicalSearchStatus(`Loading ${chemical.name || 'chemical'}…`, 'loading');
  const profileUrl = `/api/chemicals/${encodeURIComponent(chosenChemicalId)}/profile`;
  // The Chemical Companion profile is the primary display contract. Start the
  // optional legacy enrichment in parallel, but never make the profile wait on
  // NPG, ERG, threshold, or guide-library requests.
  const recordPromise = buildFullChemicalRecord(chemical).catch((error) => {
      console.warn('[chemical-companion] optional profile enrichment failed', error);
      return null;
    });
  const isCurrentProfileRequest = () => profileRequestId === latestChemicalProfileRequest
    && String(selectedChemicalId) === String(chosenChemicalId);
  const showProfileLoadError = (message) => {
    if (profileRequestId !== latestChemicalProfileRequest) return false;
    setHazardProfileMode('empty');
    setChemicalSearchStatus(message, 'error');
    return true;
  };
  const renderEnrichmentFallback = (record) => {
    if (!record || !isCurrentProfileRequest()) return;
    try {
      activeChemicalRecord = record;
      applyChemicalContainerProfile();
      updateActiveIncidentRecord();
      renderIncidentCommandSnapshot();
      updateChemicalCard(record);
      setHazardProfileMode('chemical');
      setChemicalSearchStatus('The primary Chemical Profile was unavailable; showing available linked database data.', 'error');
    } catch (error) {
      console.error('[chemical-companion] fallback profile render failed', error);
      showProfileLoadError('Chemical information could not be displayed.');
    }
  };

  let profileResponse;
  try {
    profileResponse = await fetchJson(profileUrl);
  } catch (error) {
    console.error('[chemical-companion] profile request failed', error);
  }
  if (!isCurrentProfileRequest()) {
    showProfileLoadError(`Loading ${chosenChemicalName || 'the selected chemical'} was cancelled because the selection changed.`);
    return;
  }

  const profile = profileResponse && !profileResponse.error ? profileResponse : null;
  if (!profile) {
    showProfileLoadError(`Database information for ${chosenChemicalName || 'this chemical'} could not be loaded.`);
    void recordPromise.then(renderEnrichmentFallback);
    return;
  }

  let profileRecord;
  try {
    profileRecord = chemicalProfileRecord(chemical, profile);
    activeChemicalRecord = profileRecord;
    applyChemicalContainerProfile();
    updateActiveIncidentRecord();
    renderIncidentCommandSnapshot();
    updateChemicalCard(profileRecord);
    setHazardProfileMode('chemical');
    setChemicalSearchStatus('');
  } catch (error) {
    console.error('[chemical-companion] profile render failed', error);
    showProfileLoadError('The database profile loaded, but the display could not render it. Refresh and try again.');
    return;
  }

  void recordPromise.then((record) => {
    if (!record || !isCurrentProfileRequest()) return;
    try {
      activeChemicalRecord = { ...record, ...profileRecord };
      applyChemicalContainerProfile();
      updateActiveIncidentRecord();
      renderIncidentCommandSnapshot();
    } catch (error) {
      console.warn('[chemical-companion] optional profile enrichment render failed', error);
    }
  });
  if (window.matchMedia('(max-width: 1199px)').matches) {
    chemicalIdResults?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    document.getElementById('lookup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function companionChemicalForUi(row) {
  const selectedId = normalizeChemicalSelectionId(row?.ChemicalID);
  return {
    ...row,
    id: selectedId === null || selectedId === undefined ? `transport-${row?.sourceIdentifierId}` : String(selectedId),
    selectedChemicalId: selectedId,
    name: row?.ChemicalName,
    cas: JSON.stringify(row?.CasNumber && row.CasNumber !== 'Not available' ? [row.CasNumber] : []),
    un: JSON.stringify(row?.UnnaNumber && row.UnnaNumber !== 'Not available' ? [row.UnnaNumber] : []),
    ergGuide: row?.ErgNumber,
    hazardClass: JSON.stringify(row?.HazardClass && row.HazardClass !== 'Not available' ? [row.HazardClass] : []),
  };
}

function isUnreviewedTransportationRecord(chemical) {
  return chemical?.recordType === 'transportation-identifier'
    || chemical?.reviewStatus === 'requires_review'
    || chemical?.guidanceEligible === false;
}

function chemicalSearchDetail(chemical) {
  return [
    chemical.matchReason,
    `Source Status: ${chemical.sourceStatus || (isUnreviewedTransportationRecord(chemical) ? 'Requires Review' : 'Verified')}`,
  ].filter(Boolean).join(' · ') || 'No Current Data Exists';
}

function chemicalSearchIdentifiers(chemical) {
  if (Array.isArray(chemical.linkedIdentifiers) && chemical.linkedIdentifiers.length) return chemical.linkedIdentifiers;
  const un = parseJsonField(chemical.un, [])?.[0];
  const cas = parseJsonField(chemical.cas, [])?.[0];
  return [
    cas && { type: 'CAS', label: `CAS ${cas}` },
    un && { type: isUnreviewedTransportationRecord(chemical) ? 'Transport' : 'UN/NA', label: `UN ${un}` },
    chemical.ergGuide && { type: 'ERG', label: `ERG ${chemical.ergGuide}` },
  ].filter(Boolean);
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

function exportCurrentChemicalProfile() {
  if (!activeChemical || !activeChemicalRecord) {
    setChemicalSearchStatus('Select a verified Chemical Companion record before exporting.', 'error');
    return;
  }
  const exportedAt = new Date().toISOString();
  const payload = {
    exportedAt,
    selectedChemicalId: activeChemical.selectedChemicalId ?? activeChemical.id,
    chemical: activeChemicalRecord,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = String(activeChemicalRecord.name || 'chemical-profile')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  link.href = url;
  link.download = `${filename || 'chemical-profile'}-${exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setChemicalSearchStatus(`${activeChemicalRecord.name} profile exported.`, 'success');
}

function printCurrentChemicalProfile() {
  if (!activeChemical || !activeChemicalRecord) {
    setChemicalSearchStatus('Select a verified Chemical Companion record before printing.', 'error');
    return;
  }
  document.body.classList.add('printing-chemical-profile');
  window.print();
  window.setTimeout(() => document.body.classList.remove('printing-chemical-profile'), 0);
}

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-chemical-profile');
});

function renderSavedChemicals() {
  const list = document.getElementById('my-chemicals-list');
  if (!list) return;
  list.replaceChildren();
  const chemicals = readSavedChemicals().sort((a, b) =>
    String(a.chemicalName || '').localeCompare(String(b.chemicalName || '')));
  if (!chemicals.length) {
    list.textContent = 'No saved chemicals yet. Use HAZARD ID and click “Save to My Chemicals.”';
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
document.getElementById('profile-save-chemical-btn')?.addEventListener('click', saveCurrentChemical);
const profileExportMenu = document.querySelector('.chemical-profile-export-menu');
const profileExportButton = document.getElementById('profile-export-btn');
const profileExportOptions = document.getElementById('profile-export-options');

function setProfileExportMenuOpen(open) {
  if (!profileExportButton || !profileExportOptions) return;
  profileExportOptions.hidden = !open;
  profileExportButton.setAttribute('aria-expanded', String(open));
}

profileExportButton?.addEventListener('click', () => {
  setProfileExportMenuOpen(profileExportOptions?.hidden ?? true);
});
document.getElementById('profile-print-btn')?.addEventListener('click', () => {
  setProfileExportMenuOpen(false);
  printCurrentChemicalProfile();
});
document.getElementById('profile-download-btn')?.addEventListener('click', () => {
  setProfileExportMenuOpen(false);
  exportCurrentChemicalProfile();
});
document.addEventListener('click', (event) => {
  if (profileExportMenu && !profileExportMenu.contains(event.target)) setProfileExportMenuOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileExportButton?.getAttribute('aria-expanded') === 'true') {
    setProfileExportMenuOpen(false);
    profileExportButton.focus();
  }
});
document.getElementById('chemical-profile-back-btn')?.addEventListener('click', () => {
  setHazardProfileMode('empty');
  document.getElementById('hazard-id-search-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('chemical-search')?.focus({ preventScroll: true });
});

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
  setHazardProfileMode('empty');
  setChemicalSearchStatus(`${facility.chemicals.length} reported chemical${facility.chemicals.length === 1 ? '' : 's'} found for ${facility.name}.`, 'success');
  facilityInventory?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function createSuggestion(kind, title, detail, onSelect, { identifiers = [], warning = '' } = {}) {
  const option = document.createElement('div');
  const isFacilitySuggestion = kind === 'Facility';
  option.className = `chemical-suggestion${isFacilitySuggestion ? ' is-facility-suggestion' : ' is-chemical-suggestion'}`;
  option.setAttribute('role', 'option');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chemical-suggestion-select';

  const type = document.createElement('span');
  type.className = 'chemical-suggestion-type';
  type.textContent = kind;
  const text = document.createElement('span');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const subtext = document.createElement('small');
  const unIdentifier = identifiers.find((identifier) => /^(?:UN|NA|Transport)/i.test(String(identifier?.type || '')));
  subtext.textContent = unIdentifier?.label || (isFacilitySuggestion ? detail : '');
  text.append(heading, subtext);
  if (identifiers.length && isFacilitySuggestion) {
    const renderChips = (items) => {
      const chips = document.createElement('span');
      chips.className = 'chemical-identifier-chips';
      items.forEach((identifier) => {
        const chip = document.createElement('span');
        chip.className = 'chemical-identifier-chip';
        chip.dataset.identifierType = identifier.type;
        chip.textContent = identifier.label;
        chips.append(chip);
      });
      return chips;
    };
    if (identifiers.length > 5) {
      text.append(renderChips(identifiers.slice(0, 3)));
      const linkedDetails = document.createElement('details');
      linkedDetails.className = 'chemical-linked-identifiers';
      const linkedSummary = document.createElement('summary');
      linkedSummary.textContent = 'View linked identifiers';
      linkedDetails.append(linkedSummary, renderChips(identifiers.slice(3)));
      linkedDetails.addEventListener('click', (event) => event.stopPropagation());
      option.append(linkedDetails);
    } else text.append(renderChips(identifiers));
  }
  if (warning && isFacilitySuggestion) {
    const warningText = document.createElement('small');
    warningText.className = 'chemical-transport-warning';
    warningText.textContent = warning;
    text.append(warningText);
  }
  button.append(type, text);
  button.addEventListener('click', onSelect);
  option.prepend(button);
  return option;
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

  if (submit && chemicals.length && !isUnreviewedTransportationRecord(chemicals[0])) {
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
    chemicalSearchSuggestions.append(createSuggestion(
      chemical.resultType || (isUnreviewedTransportationRecord(chemical) ? 'Transportation Identifier — Requires Review' : 'Chemical Companion Master'),
      chemical.name,
      chemicalSearchDetail(chemical),
      () => {
        if (chemicalSearchInput) chemicalSearchInput.value = chemical.name;
        if (facilityInventory) facilityInventory.hidden = true;
        clearChemicalSuggestions();
        if (isUnreviewedTransportationRecord(chemical)) {
          setChemicalSearchStatus(chemical.reviewWarning || 'This transport identifier has not been verified against a Chemical Companion master chemical record. Do not use it for IDLH, PPE, plume, decon, or medical guidance until reviewed.', 'error');
          window.HazMatIQ?.openChemCompareWithBase?.(chemical);
        } else openChemical(chemical);
      },
      {
        identifiers: chemicalSearchIdentifiers(chemical),
        warning: isUnreviewedTransportationRecord(chemical) ? chemical.reviewWarning : '',
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
  chemicalSearchTimer = window.setTimeout(() => {
    if (activeHazardSearchLane === 'CHEMICAL') void searchChemicalId(query);
    else void searchHazardLane(activeHazardSearchLane, query);
  }, 200);
});

chemicalSearchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') clearChemicalSuggestions();
});

chemicalSearchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (activeHazardSearchLane === 'CHEMICAL') void searchChemicalId(chemicalSearchInput?.value, { submit: true });
  else void searchHazardLane(activeHazardSearchLane, chemicalSearchInput?.value, { submit: true });
});

document.querySelectorAll('[data-chemical-example]').forEach((button) => {
  button.addEventListener('click', () => {
    if (chemicalSearchInput) chemicalSearchInput.value = button.dataset.chemicalExample || '';
    searchChemicalId(button.dataset.chemicalExample, { submit: true });
  });
});

const incidentProductInput = document.getElementById('incident-product');
const incidentProductSuggestions = document.getElementById('incident-product-suggestions');
const plumeChemicalInput = document.getElementById('plume-chemical-input');
const plumeChemicalSuggestions = document.getElementById('plume-chemical-suggestions');
let incidentProductSearchTimer = null;
let latestIncidentProductSearch = 0;
let plumeChemicalSearchTimer = null;
let latestPlumeChemicalSearch = 0;

function clearIncidentProductSuggestions() {
  if (!incidentProductSuggestions) return;
  incidentProductSuggestions.replaceChildren();
  incidentProductSuggestions.hidden = true;
  incidentProductInput?.setAttribute('aria-expanded', 'false');
}

async function selectIncidentProduct(chemical) {
  latestIncidentProductSearch += 1;
  clearIncidentProductSuggestions();
  if (isUnreviewedTransportationRecord(chemical)) {
    setIncidentStatus('Transportation identifier requires review before chemical-specific guidance is used.');
    return;
  }
  setActiveChemical(chemical);
  setIncidentStatus(`Loading ${chemical.name}…`);
  const recordPromise = buildFullChemicalRecord(chemical).catch(() => null);
  const profileRecord = await fetchPrimaryChemicalProfile(chemical);
  if (String(activeChemical?.id) !== String(chemical.selectedChemicalId ?? chemical.id)) return;
  if (profileRecord) {
    activeChemicalRecord = profileRecord;
    applyChemicalContainerProfile();
    updateActiveIncidentRecord();
    renderIncidentCommandSnapshot();
    setIncidentStatus(`${chemical.name} selected for the active incident.`);
    void recordPromise.then((record) => {
      if (!record || String(activeChemical?.id) !== String(profileRecord.id)) return;
      activeChemicalRecord = { ...record, ...profileRecord };
      applyChemicalContainerProfile();
      updateActiveIncidentRecord();
      renderIncidentCommandSnapshot();
    });
    return;
  }
  const record = await recordPromise;
  if (!record || String(activeChemical?.id) !== String(chemical.selectedChemicalId ?? chemical.id)) {
    setIncidentStatus(`Database information for ${chemical.name || 'this chemical'} could not be loaded.`);
    return;
  }
  activeChemicalRecord = record;
  applyChemicalContainerProfile();
  updateActiveIncidentRecord();
  renderIncidentCommandSnapshot();
  setIncidentStatus('The primary Chemical Profile was unavailable; showing available linked database data.');
}

async function searchIncidentProducts(value) {
  const requestId = ++latestIncidentProductSearch;
  const data = await fetchJson(`/api/chemicals/search?q=${encodeURIComponent(normalizeChemicalQuery(value))}`);
  if (requestId !== latestIncidentProductSearch || !incidentProductSuggestions) return;
  incidentProductSuggestions.replaceChildren();
  (data?.chemicals || []).map(companionChemicalForUi).slice(0, 8).forEach((chemical) => {
    incidentProductSuggestions.append(createSuggestion(
      isUnreviewedTransportationRecord(chemical) ? 'Transportation Identifier' : 'Chemical Companion Master',
      chemical.name,
      chemicalSearchDetail(chemical),
      () => void selectIncidentProduct(chemical),
    ));
  });
  const hasSuggestions = incidentProductSuggestions.childElementCount > 0;
  incidentProductSuggestions.hidden = !hasSuggestions;
  incidentProductInput?.setAttribute('aria-expanded', String(hasSuggestions));
}

function clearPlumeChemicalSuggestions() {
  if (!plumeChemicalSuggestions) return;
  plumeChemicalSuggestions.replaceChildren();
  plumeChemicalSuggestions.hidden = true;
  plumeChemicalInput?.setAttribute('aria-expanded', 'false');
}

async function selectPlumeChemical(chemical) {
  latestPlumeChemicalSearch += 1;
  clearPlumeChemicalSuggestions();
  if (isUnreviewedTransportationRecord(chemical)) {
    setText('plume-input-status', 'Plume guidance blocked pending verified chemical link.');
    document.getElementById('plot-plume-btn')?.setAttribute('disabled', '');
    return;
  }
  setText('plume-input-status', `Loading ${chemical.name}…`);
  setActiveChemical(chemical);
  const chosenId = chemical.selectedChemicalId ?? chemical.id;
  const recordPromise = buildFullChemicalRecord(chemical).catch(() => null);
  const profileRecord = await fetchPrimaryChemicalProfile(chemical);
  if (String(activeChemical?.id) !== String(chosenId)) return;
  activeChemicalRecord = profileRecord || await recordPromise;
  if (!activeChemicalRecord) {
    setText('plume-input-status', `Database information for ${chemical.name || 'this chemical'} could not be loaded.`);
    return;
  }
  applyChemicalContainerProfile();
  restoreIncidentContainerData();
  updateActiveIncidentRecord();
  renderIncidentCommandSnapshot();
  syncPlumeChemicalSelection();
  const availability = await getPlumeModeAvailability();
  updateOperationalPlumeReadiness(availability.result, null, availability.summary);
  scheduleAutomaticPlanningPlume();
  if (profileRecord) {
    void recordPromise.then((record) => {
      if (!record || String(activeChemical?.id) !== String(chosenId)) return;
      activeChemicalRecord = { ...record, ...profileRecord };
      applyChemicalContainerProfile();
      updateActiveIncidentRecord();
      renderIncidentCommandSnapshot();
    });
  }
}

async function searchPlumeChemicals(value) {
  const requestId = ++latestPlumeChemicalSearch;
  const data = await fetchJson(`/api/chemicals/search?q=${encodeURIComponent(normalizeChemicalQuery(value))}`);
  if (requestId !== latestPlumeChemicalSearch || !plumeChemicalSuggestions) return;
  plumeChemicalSuggestions.replaceChildren();
  (data?.chemicals || []).map(companionChemicalForUi).slice(0, 8).forEach((chemical) => {
    plumeChemicalSuggestions.append(createSuggestion(
      isUnreviewedTransportationRecord(chemical) ? 'Transportation Identifier' : 'Chemical Companion Master',
      chemical.name,
      chemicalSearchDetail(chemical),
      () => void selectPlumeChemical(chemical),
    ));
  });
  const hasSuggestions = plumeChemicalSuggestions.childElementCount > 0;
  plumeChemicalSuggestions.hidden = !hasSuggestions;
  plumeChemicalInput?.setAttribute('aria-expanded', String(hasSuggestions));
  setText('plume-input-status', hasSuggestions ? 'Select a matching Chemical Companion record.' : 'No matching chemical found.');
}

plumeChemicalInput?.addEventListener('input', () => {
  window.clearTimeout(plumeChemicalSearchTimer);
  latestPlumeChemicalSearch += 1;
  clearPlumeChemicalSuggestions();
  document.getElementById('plot-plume-btn')?.setAttribute('disabled', '');
  const query = plumeChemicalInput.value.trim();
  if (!query) {
    setText('plume-input-status', 'Enter a chemical name, Chemical ID, UN, or CAS number.');
    return;
  }
  plumeChemicalSearchTimer = window.setTimeout(() => void searchPlumeChemicals(query), 200);
});

plumeChemicalInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') clearPlumeChemicalSuggestions();
  if (event.key === 'ArrowDown' && !plumeChemicalSuggestions?.hidden) {
    event.preventDefault();
    plumeChemicalSuggestions.querySelector('button')?.focus();
  }
  if (event.key === 'Enter' && !plumeChemicalSuggestions?.hidden) {
    event.preventDefault();
    plumeChemicalSuggestions.querySelector('button')?.click();
  }
});

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
  if (event.key === 'Enter') {
    event.preventDefault();
    window.clearTimeout(incidentProductSearchTimer);
    const suggestion = !incidentProductSuggestions?.hidden && incidentProductSuggestions?.querySelector('button');
    if (suggestion) suggestion.click();
    else if (incidentProductInput.value.trim().length >= 2) void searchIncidentProducts(incidentProductInput.value.trim());
  }
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
  if (!plumeChemicalSuggestions?.contains(event.target) && event.target !== plumeChemicalInput) {
    clearPlumeChemicalSuggestions();
  }
});

let plumeRefreshToken = 0;
let plumeMap = null;
let plumeMapReady = null;
let plumeSourceMarker = null;
let currentThreatZoneGeoJson = null;
let currentThreatZoneGuideGeoJson = null;
let currentErgIsolationGeoJson = null;
let ergIsolationVisible = false;
let currentPlumeHazardsGeoJson = null;
let currentPlumeHazardsSignature = '';
let plumeDistanceMarkers = [];
let plumeMeasurementPopup = null;
let plumeManualLocation = null;
const plumeHazardsCacheKey = 'hazmatiq_plume_hazards_cache';
const plumeLayerState = { centerline: true, distance: false, hazards: false };
const plumeLayerIds = {
  centerline: ['hazmat-threat-zone-centerline', 'hazmat-threat-zone-wind-arrow', 'hazmat-threat-zone-wind-label'],
  distance: ['hazmat-threat-zone-distance-line', 'hazmat-threat-zone-distance-ticks', 'hazmat-threat-zone-distance-points', 'hazmat-threat-zone-distance-labels'],
  hazards: ['hazmat-plume-hazards-points', 'hazmat-plume-hazards-labels'],
};
let threatZoneInteractionBound = false;
let demographicsRequestToken = 0;
let latestThreatZoneHouseholdEstimate = null;
let threatZoneImpactSummary = null;
let latestPlumeWeather = null;
let plumeAutoReplotTimer = null;
const plumeMapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty';
const plumeSatelliteSourceId = 'plume-satellite-basemap';
const plumeSatelliteLayerId = 'plume-satellite-basemap-layer';
const plumeMapViews = {
  street: { style: plumeMapStyleUrl, pitch: 0, bearing: 0 },
  satellite: { style: plumeMapStyleUrl, pitch: 0, bearing: 0 },
  tactical: { style: plumeMapStyleUrl, pitch: 28, bearing: 0 },
  terrain3d: { style: plumeMapStyleUrl, pitch: 60, bearing: -20, minZoom: 15 },
};
let activePlumeMapView = 'satellite';
let plumeMapViewToken = 0;
let configuredPlumeBuildingLayers = [];
let plumeBuildingsVisible = false;
const threatZoneColors = { 3: '#d71920', 2: '#f28c18', 1: '#ffd323' };
const threatZoneColorNames = { 3: 'red', 2: 'orange', 1: 'yellow' };

function updatePlumeMapViewButtons() {
  document.querySelectorAll('[data-plume-map-view]').forEach((button) => {
    const isActive = button.dataset.plumeMapView === activePlumeMapView;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updatePlumeCompass() {
  const control = document.getElementById('plume-compass-control');
  if (!control) return;
  const supported = Boolean(plumeMap?.getBearing && plumeMap?.getPitch && plumeMap?.easeTo);
  control.hidden = !supported;
  if (!supported) return;
  const bearing = plumeMap.getBearing();
  const arrow = document.getElementById('plume-compass-arrow');
  if (arrow) arrow.style.transform = `rotate(${-bearing}deg)`;
  setText('plume-bearing-output', `${Math.round((bearing + 360) % 360)}° · ${Math.round(plumeMap.getPitch())}° tilt`);
}

function rotatePlumeMap(delta) {
  if (!plumeMap?.getBearing || !plumeMap?.easeTo) return;
  plumeMap.easeTo({ bearing: plumeMap.getBearing() + delta, duration: 350 });
}

function resetPlumeMapNorth() {
  if (!plumeMap?.easeTo) return;
  plumeMap.easeTo({ bearing: 0, pitch: 0, duration: 450 });
}

function tiltPlumeMap(delta) {
  if (!plumeMap?.getPitch || !plumeMap?.easeTo) return;
  const pitch = Math.max(0, Math.min(70, plumeMap.getPitch() + delta));
  plumeMap.easeTo({ pitch, duration: 350 });
}

function setPlumeMapResultVisible(hasResult) {
  const accent = document.getElementById('plume-map-empty-accent');
  if (accent) accent.hidden = Boolean(hasResult);
}

function resetPlumeMapView() {
  if (!plumeMap?.easeTo) return;
  const view = plumeMapViews[activePlumeMapView] || plumeMapViews.satellite;
  plumeMap.easeTo({
    bearing: view.bearing,
    pitch: view.pitch,
    zoom: Math.max(view.minZoom || 13, 13),
    duration: 450,
  });
}

function updatePlumeTerrainStatus() {
  if (activePlumeMapView !== 'terrain3d') {
    const status = activePlumeMapView === 'satellite'
      ? 'Satellite View'
      : activePlumeMapView === 'tactical' ? 'Tactical View' : 'Street Map View';
    setText('plume-terrain-status', status);
    setText('plume-model-terrain-status', `${status} · Flat-ground planning baseline; no terrain correction is applied.`);
    return;
  }
  const terrainConfigured = Boolean(plumeMap?.getTerrain?.());
  const status = terrainConfigured
    ? '3D Terrain View · Visual context only — plume math remains flat-ground unless validated'
    : '3D Terrain source not configured. Using pitched satellite view only. Visual context — plume math remains flat-ground.';
  setText('plume-terrain-status', status);
  setText('plume-model-terrain-status', status);
}

function detectConfiguredPlumeBuildings() {
  const button = document.getElementById('plume-buildings-toggle');
  configuredPlumeBuildingLayers = (plumeMap?.getStyle()?.layers || [])
    .filter((layer) => layer.type === 'fill-extrusion')
    .map((layer) => layer.id);
  configuredPlumeBuildingLayers.forEach((id) => plumeMap.setLayoutProperty(id, 'visibility', plumeBuildingsVisible ? 'visible' : 'none'));
  if (!button) return;
  button.disabled = configuredPlumeBuildingLayers.length === 0;
  button.title = configuredPlumeBuildingLayers.length
    ? 'Toggle configured 3D building layers'
    : '3D building height data not configured.';
  if (!configuredPlumeBuildingLayers.length) {
    button.classList.remove('active');
    button.setAttribute('aria-pressed', 'false');
    setText('plume-layers-status', '3D building height data not configured.');
  }
}

function toggleConfiguredPlumeBuildings() {
  if (!plumeMap || !configuredPlumeBuildingLayers.length) {
    setText('plume-layers-status', '3D building height data not configured.');
    return;
  }
  plumeBuildingsVisible = !plumeBuildingsVisible;
  configuredPlumeBuildingLayers.forEach((id) => plumeMap.setLayoutProperty(id, 'visibility', plumeBuildingsVisible ? 'visible' : 'none'));
  const button = document.getElementById('plume-buildings-toggle');
  button?.classList.toggle('active', plumeBuildingsVisible);
  button?.setAttribute('aria-pressed', String(plumeBuildingsVisible));
}

function syncPlumeBasemapLayer() {
  if (!plumeMap?.getStyle()) return;
  if (!plumeMap.getSource(plumeSatelliteSourceId)) {
    plumeMap.addSource(plumeSatelliteSourceId, {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    });
  }
  if (!plumeMap.getLayer(plumeSatelliteLayerId)) {
    const firstSymbolLayer = plumeMap.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
    plumeMap.addLayer({
      id: plumeSatelliteLayerId,
      type: 'raster',
      source: plumeSatelliteSourceId,
      paint: { 'raster-opacity': 1 },
    }, firstSymbolLayer);
  }
  plumeMap.setLayoutProperty(
    plumeSatelliteLayerId,
    'visibility',
    activePlumeMapView === 'street' ? 'none' : 'visible',
  );
}

function restorePlumeMapOverlays() {
  // style.load means the style graph is ready for custom sources/layers even
  // while isStyleLoaded() remains false waiting on remote basemap tiles.
  if (!plumeMap?.getStyle()) return;
  if (currentThreatZoneGeoJson?.features?.length) addThreatZoneLayers();
  if (ergIsolationVisible && currentErgIsolationGeoJson?.features?.length) addErgIsolationLayer();
  if (plumeLayerState.hazards && currentPlumeHazardsGeoJson) addPlumeHazardsLayers(currentPlumeHazardsGeoJson);
  Object.entries(plumeLayerState).forEach(([layerName, visible]) => setPlumeLayerVisibility(layerName, visible));
}

function addErgIsolationLayer() {
  if (!plumeMap?.getStyle() || !currentErgIsolationGeoJson?.features?.length) return;
  const sourceId = 'hazmat-erg-isolation';
  const fillId = 'hazmat-erg-isolation-fill';
  const lineId = 'hazmat-erg-isolation-line';
  const source = plumeMap.getSource(sourceId);
  if (source) source.setData(currentErgIsolationGeoJson);
  else plumeMap.addSource(sourceId, { type: 'geojson', data: currentErgIsolationGeoJson });
  if (!plumeMap.getLayer(fillId)) {
    plumeMap.addLayer({
      id: fillId,
      type: 'fill',
      source: sourceId,
      paint: { 'fill-color': '#ff7a00', 'fill-opacity': 0.24 },
    });
  }
  if (!plumeMap.getLayer(lineId)) {
    plumeMap.addLayer({
      id: lineId,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': '#ff7a00', 'line-width': 4, 'line-opacity': 0.96 },
    });
  }
}

function clearErgIsolationOverlay(message = '') {
  currentErgIsolationGeoJson = null;
  ergIsolationVisible = false;
  const source = plumeMap?.getSource('hazmat-erg-isolation');
  if (source) source.setData({ type: 'FeatureCollection', features: [] });
  if (message) setText('plume-layers-status', message);
}

async function toggleErgIsolationOverlay() {
  if (ergIsolationVisible) {
    clearErgIsolationOverlay('ERG Initial Isolation Distance hidden.');
    return;
  }
  const button = document.getElementById('toggle-erg-isolation-btn');
  button?.setAttribute('disabled', '');
  setText('plume-layers-status', 'Loading ERG Initial Isolation Distance…');
  try {
    if (!activeChemical) throw new Error('Select a verified chemical before displaying an ERG isolation distance.');
    const query = new URLSearchParams({
      chemicalId: String(activeChemical.selectedChemicalId ?? activeChemical.id),
      endpointDurationMinutes: document.getElementById('plume-endpoint-duration')?.value || '60',
      ergSpillSize: document.getElementById('plume-erg-spill-size')?.value || 'large',
      ergPeriod: document.getElementById('plume-erg-period')?.value || 'night',
      ergOnly: 'true',
    });
    const response = await fetch(`/api/plume/availability?${query}`);
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.mode !== 'erg-protective-action' || !result.ergOverlay) {
      throw new Error(result?.error || 'No Current ERG Isolation Distance Exists.');
    }
    const location = await getIncidentCoordinates({ requestGps: true, allowPlumeManual: true });
    if (!location) throw new Error('Enter an incident location before displaying the ERG isolation distance.');
    await ensurePlumeMap(location);
    const allErgFeatures = ergOverlayToGeoJson({ ...result, inputs: { windDirDeg: 0 } }, location);
    currentErgIsolationGeoJson = {
      type: 'FeatureCollection',
      features: allErgFeatures.features.filter((feature) => feature.properties?.zoneId === 'erg-initial-isolation'),
    };
    if (!currentErgIsolationGeoJson.features.length) throw new Error('The ERG record has no Initial Isolation Distance for this selection.');
    ergIsolationVisible = true;
    addErgIsolationLayer();
    button?.classList.add('active');
    button?.setAttribute('aria-pressed', 'true');
    setText('plume-layers-status', `ERG Initial Isolation Distance shown: ${Number(result.ergOverlay.initialIsolationFt).toLocaleString()} ft (${result.ergOverlay.spillSize} spill, ${result.ergOverlay.period}).`);
  } catch (error) {
    clearErgIsolationOverlay(error instanceof Error ? error.message : 'ERG isolation distance could not be displayed.');
  } finally {
    button?.removeAttribute('disabled');
  }
}

function updateIncidentLocationFromMap(lng, lat, action) {
  const input = document.getElementById('incident-coordinates-input');
  if (input) input.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  setIncidentStatus(`${action}: ${lat.toFixed(6)}, ${lng.toFixed(6)}. Updating plume…`);
  if (hasActiveIncident()) saveIncidentBrief({ quiet: true });
  plumeSourceMarker?.setLngLat([lng, lat]);
  const location = { lat, lon: lng, source: 'Map release pin' };
  if (activePlumeCommand) {
    setText('plume-gps-summary', `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    setText('plume-location-source', location.source);
    window.clearTimeout(plumeAutoReplotTimer);
    plumeAutoReplotTimer = window.setTimeout(() => {
      void plotPlumeFromControls(location);
    }, 150);
    return;
  }
  void refreshPlumeWorkspace({ requestGps: false });
}

function ensurePlumeMap(location = null) {
  if (!window.maplibregl) throw new Error('The local GIS map library did not load.');
  if (!plumeMap) {
    const view = plumeMapViews[activePlumeMapView];
    plumeMap = new window.maplibregl.Map({
      container: 'plume-gis-map',
      center: location ? [location.lon, location.lat] : [-98.5, 39.5],
      zoom: location ? 13 : 3,
      style: view.style,
      pitch: view.pitch,
      bearing: view.bearing,
      preserveDrawingBuffer: true,
      attributionControl: false,
    });
    plumeMap.addControl(new window.maplibregl.NavigationControl(), 'bottom-right');
    plumeMap.scrollZoom.enable();
    // `load` waits for remote basemap resources and can leave plume modeling
    // blocked indefinitely when a tile host is slow. The style graph is enough
    // to add the locally generated GeoJSON plume layers.
    plumeMapReady = new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        try {
          syncPlumeBasemapLayer();
        } catch {
          // A timeout may resolve before the remote style graph is writable.
        }
        resolve();
      };
      const timeoutId = window.setTimeout(finish, 8000);
    plumeMap.once('style.load', finish);
    plumeMap.on('style.load', () => {
      detectConfiguredPlumeBuildings();
      updatePlumeTerrainStatus();
    });
    plumeMap.on('rotate', updatePlumeCompass);
    plumeMap.on('pitch', updatePlumeCompass);
    });
    plumeMap.getCanvas().style.cursor = 'crosshair';
    plumeMap.on('click', (event) => {
      if (plumeLayerState.distance) {
        showPlumePointMeasurement(event.lngLat);
        return;
      }
      const renderedZones = plumeMap.getLayer('hazmat-threat-zones-fill')
        ? plumeMap.queryRenderedFeatures(event.point, { layers: ['hazmat-threat-zones-fill'] })
        : [];
      if (renderedZones.length) {
        const selected = [...renderedZones].sort((a, b) => {
          const rankDifference = Number(b.properties?.threatRank || 0) - Number(a.properties?.threatRank || 0);
          if (rankDifference) return rankDifference;
          return (threatZoneAreaSquareMeters(a) || Infinity) - (threatZoneAreaSquareMeters(b) || Infinity);
        })[0];
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
  updatePlumeCompass();
  // A regional preview is not an incident location: do not place a release pin yet.
  if (!location) return plumeMapReady;
  plumeMap.easeTo({ center: [location.lon, location.lat], zoom: Math.max(13, plumeMap.getZoom()), duration: 400 });
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
  const originLon = Number(origin.lon ?? origin.lng);
  const lat = origin.lat + (northM / earthRadiusM) * (180 / Math.PI);
  const lon = originLon + (eastM / (earthRadiusM * Math.cos(origin.lat * Math.PI / 180))) * (180 / Math.PI);
  return [lon, lat];
}

function distanceMetersBetween(start, end) {
  const radiusM = 6371008.8;
  const radians = (degrees) => degrees * Math.PI / 180;
  const lat1 = radians(start.lat);
  const lat2 = radians(end.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians((end.lng ?? end.lon) - (start.lng ?? start.lon));
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return radiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showPlumePointMeasurement(selectedPoint) {
  if (!plumeMap || !plumeSourceMarker) return;
  const releasePoint = plumeSourceMarker.getLngLat();
  const meters = distanceMetersBetween(releasePoint, selectedPoint);
  const feet = meters * 3.28084;
  const miles = meters / 1609.344;
  const measurement = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [[releasePoint.lng, releasePoint.lat], [selectedPoint.lng, selectedPoint.lat]],
      },
    }],
  };
  const source = plumeMap.getSource('hazmat-point-measurement');
  if (source) source.setData(measurement);
  else {
    plumeMap.addSource('hazmat-point-measurement', { type: 'geojson', data: measurement });
    plumeMap.addLayer({
      id: 'hazmat-point-measurement-line',
      type: 'line',
      source: 'hazmat-point-measurement',
      paint: { 'line-color': '#071f36', 'line-width': 3, 'line-dasharray': [2, 2] },
    });
  }
  plumeMeasurementPopup?.remove();
  plumeMeasurementPopup = new window.maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 10 })
    .setLngLat(selectedPoint)
    .setHTML(`<strong>Distance from release</strong><br>${miles.toFixed(2)} mi<br>${Math.round(feet).toLocaleString()} ft<br>${Math.round(meters).toLocaleString()} m`)
    .addTo(plumeMap);
}

function clearPlumePointMeasurement() {
  plumeMeasurementPopup?.remove();
  plumeMeasurementPopup = null;
  if (plumeMap?.getSource('hazmat-point-measurement')) {
    plumeMap.getSource('hazmat-point-measurement').setData({ type: 'FeatureCollection', features: [] });
  }
}

function plumeResultToGeoJson(result, origin) {
  const validZones = (result?.isopleths || []).filter((zone) =>
    zone.thresholdKind === 'AEGL' && zone.polygon?.length >= 2 && Number(zone.thresholdLevel) >= 1);
  const uniqueZones = [...validZones.reduce((zonesByLevel, zone) => {
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
          source: `EPA AEGL ${result.endpoint?.selectedDurationMinutes || result.inputs?.endpointDurationMinutes || 60}-minute endpoint · HazMatIQ Planning Estimate`,
          thresholdKind: zone.thresholdKind,
          thresholdLevel: zone.thresholdLevel,
          threatRank,
          colorName: threatZoneColorNames[threatRank],
          color: threatZoneColors[threatRank],
          maxDownwindM: zone.maxDownwindM,
          rangeTruncated: zone.rangeTruncated === true,
          modelMode: result.modelMode || 'HAZMATIQ_PLANNING_ESTIMATE',
          overlayMode: 'modeled-concentration-contour',
          windFromDeg: result.inputs.windDirDeg,
        },
        geometry: { type: 'Polygon', coordinates: [coordinates] },
      };
    }),
  };
}

function ergOverlayToGeoJson(result, origin) {
  const erg = result?.ergOverlay;
  if (!erg) return { type: 'FeatureCollection', features: [] };
  const isolationM = Number(erg.initialIsolationFt) * 0.3048;
  const protectiveM = Number(erg.protectiveActionMi) * 1609.344;
  const windFromDeg = Number(result.inputs?.windDirDeg);
  const source = `${erg.source} · UN ${erg.un} · Guide ${erg.guide} · ${erg.spillSize} spill · ${erg.period}`;
  const features = [];

  if (protectiveM > 0 && Number.isFinite(windFromDeg)) {
    const halfWidthM = protectiveM / 2;
    const localRing = [
      [0, -halfWidthM],
      [protectiveM, -halfWidthM],
      [protectiveM, halfWidthM],
      [0, halfWidthM],
      [0, -halfWidthM],
    ];
    features.push({
      type: 'Feature',
      properties: {
        label: `ERG Protective Action Zone — ${erg.protectiveActionMi} mi`,
        zoneId: 'erg-protective-action',
        source,
        overlayMode: 'erg-protective-action',
        overlayType: 'ERG Protective Action Zone',
        threatRank: 2,
        colorName: 'orange',
        color: '#ff7a00',
        fillOpacity: 0.3,
        maxDownwindM: protectiveM,
        windFromDeg,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [localRing.map((point) => localMetersToLngLat(point, origin, windFromDeg))],
      },
    });
  }

  if (isolationM > 0) {
    const circle = Array.from({ length: 65 }, (_, index) => {
      const angle = (index / 64) * Math.PI * 2;
      return localMetersToLngLat(
        [Math.cos(angle) * isolationM, Math.sin(angle) * isolationM],
        origin,
        Number.isFinite(windFromDeg) ? windFromDeg : 0,
      );
    });
    features.push({
      type: 'Feature',
      properties: {
        label: `ERG Initial Isolation Zone — ${Number(erg.initialIsolationFt).toLocaleString()} ft`,
        zoneId: 'erg-initial-isolation',
        source,
        overlayMode: 'erg-protective-action',
        overlayType: 'ERG Initial Isolation Zone',
        threatRank: 2,
        colorName: 'orange',
        color: '#ff9d00',
        fillOpacity: 0.42,
        maxDownwindM: isolationM,
      },
      geometry: { type: 'Polygon', coordinates: [circle] },
    });
  }

  return { type: 'FeatureCollection', features };
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

function threatZoneAreaSquareMeters(feature) {
  const ring = getThreatZoneRing(feature);
  if (ring.length < 4) return null;
  const earthRadiusM = 6371008.8;
  const latitudeOrigin = ring.reduce((total, point) => total + Number(point[1] || 0), 0) / ring.length * Math.PI / 180;
  const projected = ring.map(([longitude, latitude]) => [
    Number(longitude) * Math.PI / 180 * earthRadiusM * Math.cos(latitudeOrigin),
    Number(latitude) * Math.PI / 180 * earthRadiusM,
  ]);
  const area = Math.abs(projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
  return Number.isFinite(area) && area > 0 ? area : null;
}

function formatThreatZoneArea(squareMeters) {
  if (!Number.isFinite(squareMeters)) return noCurrentDataText;
  const acres = squareMeters / 4046.8564224;
  const squareMiles = squareMeters / 2589988.110336;
  return squareMiles >= 0.1
    ? `${squareMiles.toFixed(2)} sq mi (${Math.round(acres).toLocaleString()} acres)`
    : `${acres.toFixed(acres < 10 ? 1 : 0)} acres`;
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
  const residentialBuildings = new Set(['house', 'residential', 'apartments', 'detached', 'semidetached_house', 'terrace', 'dormitory']);
  const educationAmenities = new Set(['school', 'kindergarten', 'childcare', 'college', 'university']);
  const healthcareAmenities = new Set(['hospital', 'clinic', 'doctors']);
  const nursingAmenities = new Set(['nursing_home', 'social_facility']);
  const criticalAmenities = new Set(['fire_station', 'police', 'shelter']);
  const highOccupancyAmenities = new Set(['community_centre', 'place_of_worship', 'prison']);

  const commercial = elements.filter((element) => commercialBuildings.has(element.tags?.building)
    || commercialBuildings.has(element.tags?.['building:use']) || element.tags?.shop || element.tags?.office);
  const residentialStructures = elements.filter((element) => residentialBuildings.has(element.tags?.building)
    || element.tags?.['building:use'] === 'residential');
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
  const featureLabels = (rows) => rows.map((row) => getMappedFeatureName(row) || `${row.type}/${row.id}`);
  return {
    residentialStructures: residentialStructures.length,
    businesses: commercial.length,
    education: education.length,
    healthcare: healthcare.length,
    nursing: nursing.length,
    critical: critical.length,
    educationFeatures: featureLabels(education),
    healthcareFeatures: featureLabels([...healthcare, ...nursing]),
    infrastructureFeatures: featureLabels(critical),
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

function setThreatZoneMetric(metric, value, method, confidence, available) {
  const card = document.querySelector(`[data-threat-metric="${metric}"]`);
  if (!card) return;
  card.hidden = false;
  const valueElement = card.querySelector('strong');
  const note = card.querySelector('small');
  if (valueElement) valueElement.textContent = available
    ? (Number.isFinite(Number(value)) ? Number(value).toLocaleString() : String(value))
    : noCurrentDataText;
  if (note) note.textContent = available ? [method, confidence].filter(Boolean).join(' · ') : '';
}

function setThreatZoneDetail(detail, value, available) {
  const row = document.querySelector(`[data-threat-detail="${detail}"]`);
  if (!row) return;
  row.hidden = !available;
  if (available) row.querySelector('dd').textContent = value;
}

function resetDemographics(message = 'Select a plume zone or protective-action area to view affected-area estimates.') {
  demographicsRequestToken += 1;
  latestThreatZoneHouseholdEstimate = null;
  threatZoneImpactSummary = {
    selectedArea: null,
    primaryMetrics: {},
    estimateDetails: {},
    disclaimer: 'Threat Zone impact values are planning estimates based on the selected plume or protective-action area.',
    readyForIncidentExport: false,
  };
  window.HazMatIQ ||= {};
  window.HazMatIQ.threatZoneImpactSummary = threatZoneImpactSummary;
  const badge = document.getElementById('demographics-zone-badge');
  if (badge) {
    badge.textContent = 'No zone';
    delete badge.dataset.zoneColor;
  }
  setText('demographics-zone-summary', message);
  setText('threat-zone-selected-area', 'No zone selected');
  setText('threat-zone-basis', noCurrentDataText);
  setText('threat-zone-area', noCurrentDataText);
  setText('threat-zone-method', noCurrentDataText);
  setText('threat-zone-confidence', noCurrentDataText);
  setText('threat-zone-generated', noCurrentDataText);
  document.querySelectorAll('[data-threat-metric]').forEach((element) => {
    element.hidden = false;
    const value = element.querySelector('strong');
    const note = element.querySelector('small');
    if (value) value.textContent = noCurrentDataText;
    if (note) note.textContent = '';
  });
  document.querySelectorAll('[data-threat-detail]').forEach((element) => { element.hidden = true; });
  const details = document.querySelector('.threat-zone-estimate-details');
  if (details) {
    details.open = false;
    details.hidden = true;
  }
  setText('demographics-source-status', 'Select an affected area to load available selected-zone data.');
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
  const isErgIsolation = properties.zoneId === 'erg-initial-isolation';
  const isErgProtective = properties.zoneId === 'erg-protective-action';
  const selectedAreaLabel = isErgIsolation
    ? 'ERG Initial Isolation'
    : isErgProtective
      ? 'ERG Protective Action'
      : `${colorName.charAt(0).toUpperCase()}${colorName.slice(1)} Zone`;
  const basis = isErgIsolation
    ? 'ERG isolation'
    : isErgProtective
      ? 'ERG protective action'
      : properties.thresholdKind === 'AEGL' ? 'AEGL plume' : 'Planning estimate';
  const generatedAt = new Date().toISOString();
  const areaSquareMeters = threatZoneAreaSquareMeters(feature);
  const areaDisplay = formatThreatZoneArea(areaSquareMeters);
  setText('demographics-zone-summary', [properties.label || selectedAreaLabel, formatZoneDistance(properties.maxDownwindM)].filter(Boolean).join(' · '));
  setText('threat-zone-selected-area', selectedAreaLabel);
  setText('threat-zone-basis', basis);
  setText('threat-zone-area', areaDisplay);
  setText('threat-zone-method', 'Loading selected-area data…');
  setText('threat-zone-confidence', 'Needs Verification');
  setText('threat-zone-generated', new Date(generatedAt).toLocaleString());
  document.querySelectorAll('[data-threat-detail]').forEach((element) => { element.hidden = true; });
  setText('demographics-source-status', 'Loading U.S. Census and OpenStreetMap planning data…');
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
  const residentialStructures = occupancy?.residentialStructures ?? null;
  const nearbyCensusHouseholds = census?.housing ?? null;
  const householdEstimateMethod = residentialStructures !== null
    ? householdEstimateLabels.building
    : nearbyCensusHouseholds !== null
      ? 'Nearby Census geography context only'
      : noCurrentDataText;
  const householdEstimateStatus = residentialStructures !== null
    ? 'Needs Verification'
    : nearbyCensusHouseholds !== null ? 'Context Only'
    : readinessStatus.missing;
  const householdLimitations = residentialStructures !== null
    ? 'Mapped residential footprints are not household units; apartments, unmapped buildings, and mixed uses are not inferred.'
    : nearbyCensusHouseholds !== null
      ? 'Intersecting Census geography totals extend beyond the plume and are not impacted-household counts.'
      : noCurrentDataText;
  latestThreatZoneHouseholdEstimate = {
    householdEstimate: null,
    householdEstimateMethod,
    householdEstimateStatus,
    visibleFootprintStructures: residentialStructures,
    nearbyCensusGeographyHouseholds: nearbyCensusHouseholds,
    source: [census ? '2020 Census blocks' : null, occupancy ? 'OpenStreetMap mapped footprints' : null].filter(Boolean).join(' · ') || noCurrentDataText,
    limitations: householdLimitations,
  };
  const healthcareFacilities = occupancy ? occupancy.healthcare + occupancy.nursing : null;
  setThreatZoneMetric('residentialHomes', residentialStructures, 'Building-footprint estimate', 'Needs Verification', residentialStructures !== null);
  // Intersecting Census block totals are context only; they are not displayed as selected-area population.
  setThreatZoneMetric('currentPopulation', null, '', '', false);
  setThreatZoneMetric('criticalInfrastructure', occupancy?.critical, 'Local GIS count', 'Needs Verification', Boolean(occupancy));
  setThreatZoneMetric('healthcareFacilities', healthcareFacilities, 'Local GIS count', 'Needs Verification', Boolean(occupancy));
  setThreatZoneMetric('schools', occupancy?.education, 'Local GIS count', 'Needs Verification', Boolean(occupancy));

  setThreatZoneDetail('censusPopulation', census ? `${census.population.toLocaleString()} nearby geography total — context only` : '', Boolean(census));
  setThreatZoneDetail('censusHouseholds', census ? `${census.housing.toLocaleString()} nearby geography total — context only` : '', Boolean(census));
  setThreatZoneDetail('buildingFootprints', residentialStructures?.toLocaleString() || '0', residentialStructures !== null);
  setThreatZoneDetail('nursing', occupancy?.nursing.toLocaleString() || '0', Boolean(occupancy));
  setThreatZoneDetail('businesses', occupancy?.businesses.toLocaleString() || '0', Boolean(occupancy));
  setThreatZoneDetail('criticalReceptors', occupancy
    ? (occupancy.education + healthcareFacilities + occupancy.critical).toLocaleString() : '', Boolean(occupancy));
  const protectiveAction = activeChemicalRecord?.commandFacts?.protectiveAction;
  setThreatZoneDetail('protectiveAction', protectiveAction || '', Boolean(protectiveAction && protectiveAction !== noCurrentDataText));
  setThreatZoneDetail('householdMethod', householdEstimateMethod, householdEstimateMethod !== noCurrentDataText);
  setThreatZoneDetail('householdStatus', householdEstimateStatus, householdEstimateStatus !== readinessStatus.missing);
  setThreatZoneDetail('householdLimitations', householdLimitations, householdLimitations !== noCurrentDataText);
  setThreatZoneDetail('legacyHousing', '', false);
  const estimateDetails = document.querySelector('.threat-zone-estimate-details');
  if (estimateDetails) estimateDetails.hidden = !estimateDetails.querySelector('[data-threat-detail]:not([hidden])');

  const primaryMethod = occupancy ? 'Selected-zone OpenStreetMap intersection' : census ? 'Nearby Census geography context only' : noCurrentDataText;
  const confidence = occupancy ? 'Planning Estimate' : census ? 'Context Only' : 'No Current Data Exists';
  setText('threat-zone-method', primaryMethod);
  setText('threat-zone-confidence', confidence);

  const metric = (value, method, sourceStatus, metricConfidence, limitations) => ({
    value,
    method,
    sourceStatus,
    confidence: metricConfidence,
    limitations,
  });
  threatZoneImpactSummary = {
    selectedArea: {
      id: String(properties.zoneId || feature.id || 'unknown'),
      label: selectedAreaLabel,
      basis,
      geometryStatus: areaSquareMeters ? 'Selected-area polygon available' : noCurrentDataText,
      area: areaSquareMeters ? { squareMeters: areaSquareMeters, display: areaDisplay } : null,
      generatedAt,
    },
    primaryMetrics: {
      residentialHomes: metric(residentialStructures, residentialStructures !== null ? 'Building-footprint estimate' : noCurrentDataText, occupancy ? 'OpenStreetMap selected-zone features' : noCurrentDataText, residentialStructures !== null ? 'Needs Verification' : noCurrentDataText, householdLimitations),
      currentPopulation: metric(null, census ? 'Nearby Census geography context only' : noCurrentDataText, census ? '2020 Census blocks' : noCurrentDataText, census ? 'Context Only' : noCurrentDataText, 'Census block totals are not clipped to the selected zone and are not shown as current population.'),
      criticalInfrastructure: metric(occupancy?.critical ?? null, occupancy ? 'Local GIS count' : noCurrentDataText, occupancy ? 'OpenStreetMap selected-zone features' : noCurrentDataText, occupancy ? 'Needs Verification' : noCurrentDataText, 'Mapped feature coverage may be incomplete.'),
      healthcareFacilities: metric(healthcareFacilities, occupancy ? 'Local GIS count' : noCurrentDataText, occupancy ? 'OpenStreetMap selected-zone features' : noCurrentDataText, occupancy ? 'Needs Verification' : noCurrentDataText, 'Mapped feature coverage may be incomplete.'),
      schools: metric(occupancy?.education ?? null, occupancy ? 'Local GIS count' : noCurrentDataText, occupancy ? 'OpenStreetMap selected-zone features' : noCurrentDataText, occupancy ? 'Needs Verification' : noCurrentDataText, 'Mapped feature coverage may be incomplete.'),
    },
    estimateDetails: {
      censusGeographies: census ? [`${census.blocks} intersecting 2020 Census block${census.blocks === 1 ? '' : 's'}`] : [],
      censusPopulationTotal: census?.population ?? null,
      censusHouseholdTotal: census?.housing ?? null,
      overlapPercentage: null,
      buildingFootprintsCounted: residentialStructures,
      residentialParcelsCounted: null,
      infrastructureFeatures: occupancy?.infrastructureFeatures || [],
      healthcareFeatures: occupancy?.healthcareFeatures || [],
      schoolFeatures: occupancy?.educationFeatures || [],
      receptorSourceStatus: occupancy ? 'OpenStreetMap selected-zone intersection; verify completeness' : noCurrentDataText,
      dataVersion: census ? '2020 Census blocks' : noCurrentDataText,
      notes: [householdLimitations, 'Nearby Census totals are context only and are not selected-zone counts.'],
    },
    disclaimer: 'Threat Zone impact values are planning estimates based on the selected plume or protective-action area. Census geographies and facility datasets may be incomplete or extend beyond the selected area. Verify residential homes, population, critical infrastructure, healthcare facilities, and schools with local GIS, field reconnaissance, field monitoring, and Incident Command.',
    readyForIncidentExport: true,
  };
  window.HazMatIQ ||= {};
  window.HazMatIQ.threatZoneImpactSummary = threatZoneImpactSummary;

  const sources = [
    census ? `2020 Census: ${census.blocks} intersecting block${census.blocks === 1 ? '' : 's'}; geography totals are not clipped to the plume` : 'Census unavailable',
    occupancy ? 'OpenStreetMap mapped footprints/features; coverage may be incomplete' : 'OpenStreetMap occupancy lookup unavailable',
  ];
  setText('demographics-source-status', `${sources.join(' · ')}. Only available selected-zone feature counts are shown above; nearby Census totals remain context only.`);
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
  setText('plume-overlay-status', label);
  return true;
}

function buildThreatZoneGuides() {
  const zones = currentThreatZoneGeoJson?.features || [];
  const aeglZones = zones
    .filter((zone) => zone.properties?.thresholdKind === 'AEGL' && Number.isFinite(Number(zone.properties?.maxDownwindM)))
    .sort((a, b) => Number(a.properties?.thresholdLevel) - Number(b.properties?.thresholdLevel));
  const longest = [...aeglZones].sort((a, b) => Number(b.properties.maxDownwindM) - Number(a.properties.maxDownwindM))[0];
  const maxDistance = Number(longest?.properties?.maxDownwindM);
  const windFromDeg = Number(longest?.properties?.windFromDeg);
  const origin = plumeSourceMarker?.getLngLat();
  if (!origin || !Number.isFinite(maxDistance) || !Number.isFinite(windFromDeg)) {
    return { type: 'FeatureCollection', features: [] };
  }

  const start = [origin.lng, origin.lat];
  const features = aeglZones.map((zone) => {
    const distanceM = Number(zone.properties.maxDownwindM);
    return {
      type: 'Feature',
      properties: {
        guideType: 'zoneDistance',
        label: `AEGL-${zone.properties.thresholdLevel}: ${(distanceM / 1609.344).toFixed(2)} mi`,
        color: threatZoneColors[Number(zone.properties.threatRank)] || '#17202a',
      },
      geometry: { type: 'LineString', coordinates: [start, localMetersToLngLat([distanceM, 0], origin, windFromDeg)] },
    };
  });
  features.push({
    type: 'Feature', properties: { guideType: 'centerline' },
    geometry: { type: 'LineString', coordinates: [start, localMetersToLngLat([maxDistance, 0], origin, windFromDeg)] },
  });
  const quarterMileCount = Math.floor(maxDistance / (0.25 * 1609.344));
  Array.from({ length: quarterMileCount }, (_, index) => (index + 1) * 0.25).forEach((miles) => {
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
      properties: { guideType: 'distance', label: `${miles.toFixed(2)} mi` },
      geometry: { type: 'Point', coordinates: localMetersToLngLat([distance, 0], origin, windFromDeg) },
    });
  });
  features.push({
    type: 'Feature',
    properties: {
      guideType: 'wind',
      rotation: (windFromDeg + 180) % 360,
      label: `Downwind ${Math.round((windFromDeg + 180) % 360)}°`,
    },
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
  }
  if (!plumeMap.getLayer('hazmat-threat-zones-fill')) {
    plumeMap.addLayer({
      id: 'hazmat-threat-zones-fill',
      type: 'fill',
      source: 'hazmat-threat-zones',
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], '#d71920'],
        'fill-opacity': ['coalesce', ['get', 'fillOpacity'], 0.2],
      },
    });
  }
  if (!plumeMap.getLayer('hazmat-threat-zones-selection')) {
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
  }
  if (!plumeMap.getLayer('hazmat-threat-zones-border')) {
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
  }
  if (!plumeMap.getLayer('hazmat-threat-zones-outline')) {
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
    filter: ['==', ['get', 'guideType'], 'zoneDistance'],
    layout: { visibility: plumeLayerState.distance ? 'visible' : 'none' },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#fff'],
      'line-width': 3,
      'line-opacity': 0.95,
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
  addOptionalPlumeGuideLayer({
    id: 'hazmat-threat-zone-wind-label',
    type: 'symbol',
    source: 'hazmat-threat-zone-guides',
    filter: ['==', ['get', 'guideType'], 'wind'],
    layout: {
      visibility: plumeLayerState.centerline ? 'visible' : 'none',
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-offset': [0, 2],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#071f36',
      'text-halo-color': '#fff',
      'text-halo-width': 2,
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
  const switchToken = ++plumeMapViewToken;
  const activeZones = currentThreatZoneGeoJson;
  activePlumeMapView = viewName;
  updatePlumeMapViewButtons();
  updatePlumeTerrainStatus();
  if (!plumeMap) return;
  if (plumeMapReady) await plumeMapReady;
  if (switchToken !== plumeMapViewToken || activePlumeMapView !== viewName) return;
  currentThreatZoneGeoJson = activeZones;
  syncPlumeBasemapLayer();
  restorePlumeMapOverlays();

  const camera = { pitch: view.pitch, bearing: view.bearing, duration: 500 };
  if (view.minZoom) camera.zoom = Math.max(plumeMap.getZoom(), view.minZoom);
  if (activeZones?.features?.length) {
    const bounds = new window.maplibregl.LngLatBounds();
    forEachCoordinate(activeZones, (coordinate) => bounds.extend(coordinate));
    if (!bounds.isEmpty()) plumeMap.fitBounds(bounds, { padding: 70, maxZoom: 15, pitch: view.pitch, bearing: view.bearing, duration: 400 });
  } else {
    plumeMap.easeTo(camera);
  }
  updatePlumeTerrainStatus();
  updatePlumeCompass();
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
  setPlumeMapResultVisible(false);
  syncDistanceDomMarkers();
  activePlumeCommand = null;
  renderIncidentCommandSnapshot();
  resetDemographics('No plume zone is currently displayed.');
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

async function getIncidentCoordinates({ requestGps = true, allowPlumeManual = false } = {}) {
  if (allowPlumeManual && plumeManualLocation) return plumeManualLocation;
  const input = document.getElementById('incident-coordinates-input');
  const entered = parseGpsCoordinate(input?.value);
  if (entered) return { ...entered, source: 'Incident Dashboard' };
  const incident = getActiveIncident();
  const address = getIncidentAddressValue();
  const savedAddress = [incident?.address, incident?.city, incident?.state].filter(Boolean).join(', ');
  const saved = incident?.latitude !== '' && incident?.longitude !== ''
    && incident?.latitude != null && incident?.longitude != null
    ? parseGpsCoordinate(`${incident.latitude}, ${incident.longitude}`) : null;
  if (saved && (!address || address === savedAddress)) {
    if (input) input.value = `${saved.lat.toFixed(6)}, ${saved.lon.toFixed(6)}`;
    return { ...saved, source: 'Saved incident location' };
  }
  if (address) {
    const match = await geocodePlumeAddress(address);
    if (match) {
      if (input) input.value = `${match.lat.toFixed(6)}, ${match.lon.toFixed(6)}`;
      return { ...match, source: 'Incident Brief address' };
    }
  }
  if (!requestGps) return null;
  const gps = await getCurrentGps();
  if (input) input.value = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
  return { ...gps, source: 'Current device GPS' };
}

async function geocodePlumeAddress(address) {
  const query = new URLSearchParams({
    f: 'json',
    SingleLine: address,
    countryCode: 'USA',
    maxLocations: '1',
    forStorage: 'false',
  });
  const result = await fetchJson(`${arcgisGeocoderUrl}/findAddressCandidates?${query}`);
  const candidate = result?.candidates?.[0];
  const lat = candidate?.location?.y;
  const lon = candidate?.location?.x;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, address: candidate.address || address };
}

async function useManualPlumeAddress() {
  const input = document.getElementById('plume-map-address-input');
  const button = document.querySelector('#plume-map-address-form button[type="submit"]');
  const address = input?.value.trim();
  if (!address) {
    setText('plume-map-address-status', 'Enter an address for plume plotting.');
    input?.focus();
    return;
  }
  if (button) button.disabled = true;
  setText('plume-map-address-status', 'Locating address…');
  try {
    const coordinates = parseGpsCoordinate(address);
    const location = coordinates || await geocodePlumeAddress(address);
    if (!location) {
      setText('plume-map-address-status', 'Location not found. Enter a more specific address or latitude, longitude.');
      return;
    }
    plumeManualLocation = { ...location, source: coordinates ? 'Manual plume coordinates' : 'Manual plume address' };
    if (input) input.value = location.address || `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
    setText('plume-map-address-status', `Plume map centered on ${location.address || `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`}.`);
    if (activePlumeCommand) await plotPlumeFromControls(plumeManualLocation);
    else await refreshPlumeWorkspace({ requestGps: false });
  } finally {
    if (button) button.disabled = false;
  }
}

async function useIncidentPlumeLocation() {
  const button = document.getElementById('use-plume-incident-location-btn');
  const input = document.getElementById('plume-map-address-input');
  button?.setAttribute('disabled', '');
  plumeManualLocation = null;
  setText('plume-map-address-status', 'Loading incident location…');
  try {
    const location = await getIncidentCoordinates({ requestGps: false });
    if (!location) {
      setText('plume-map-address-status', 'No incident location is available. Enter an address or coordinates.');
      return;
    }
    if (input) input.value = location.address || `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
    setText('plume-map-address-status', `Using incident location: ${location.address || `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`}.`);
    await ensurePlumeMap(location);
    if (activePlumeCommand) await plotPlumeFromControls(location);
    else await refreshPlumeWorkspace({ requestGps: false });
  } finally {
    button?.removeAttribute('disabled');
  }
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
    timeformat: 'unixtime',
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
      && typeof values?.relativeHumidity?.value === 'number' && Number.isFinite(values.relativeHumidity.value)
      && typeof values?.windSpeed?.value === 'number' && Number.isFinite(values.windSpeed.value)
      && typeof values?.windDirection?.value === 'number' && Number.isFinite(values.windDirection.value);
    if (complete) {
      return { office: points.properties.gridId, station, observation: values };
    }
  }
  return null;
}

async function fetchWeatherSources(lat, lon) {
  const proxyQuery = new URLSearchParams({ lat: String(lat), lon: String(lon), refresh: String(Date.now()) });
  const proxy = await fetchJson(`/api/weather/current?${proxyQuery}`, { timeoutMs: 10000 });
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
  renderNotificationWeather(openMeteo, nws);
}

function hasCompleteHeaderWeather(weather) {
  return weather && [weather.temperatureF, weather.rh, weather.windSpeedMph, weather.windDirDeg]
    .every((value) => Number.isFinite(Number(value)));
}

function renderNotificationWeather(openMeteo, nws) {
  const liveWeather = hasCompleteHeaderWeather(nws)
    ? { ...nws, headerSource: `Closest available station · ${nws.displayStation}` }
    : hasCompleteHeaderWeather(openMeteo)
      ? { ...openMeteo, headerSource: 'Open-Meteo current conditions' }
      : null;
  if (!liveWeather) {
    updateNotificationCenter({ weather: 'Live weather unavailable for the selected location' });
    if (notificationWeatherSource) notificationWeatherSource.textContent = 'No complete live weather report available';
    return;
  }
  const temperature = Number(liveWeather.temperatureF).toFixed(1);
  const humidity = Math.round(Number(liveWeather.rh));
  const windSpeed = Number(liveWeather.windSpeedMph).toFixed(1);
  const windDirection = degreesToCompass(Number(liveWeather.windDirDeg));
  updateNotificationCenter({
    weather: `TEMP ${temperature}\u00b0F  \u00b7  RH ${humidity}%  \u00b7  WIND ${windSpeed} MPH ${windDirection}`,
  });
  if (notificationWeatherSource) notificationWeatherSource.textContent = liveWeather.headerSource;
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
    observedAt: Number.isFinite(Number(current.time))
      ? new Date(Number(current.time) * 1000).toISOString()
      : current.time,
  };
}

function convertWindSpeedToMph(value, unit = 'mph') {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return null;
  const normalizedUnit = String(unit || 'mph').trim().toLowerCase().replace(/\s+/g, '');
  if (/^(?:km\/?h|kmh|kph|wmounit:km_h-?1)$/.test(normalizedUnit)) return speed * 0.621371;
  if (/^(?:m\/?s|mps|ms-?1|wmounit:m_s-?1)$/.test(normalizedUnit)) return speed * 2.23694;
  if (/^(?:kt|kts|knot|knots)$/.test(normalizedUnit)) return speed * 1.15078;
  return speed;
}

function formatNws(data) {
  if (!data?.observation) return null;
  const observation = data.observation;
  const tempC = observation.temperature?.value;
  const nwsWindMph = (measurement) => {
    const unit = String(measurement?.unitCode || 'm/s').replace(/^wmoUnit:/i, 'wmoUnit:');
    return convertWindSpeedToMph(measurement?.value, unit);
  };
  const windSpeedMph = nwsWindMph(observation.windSpeed);
  const gustMph = nwsWindMph(observation.windGust);
  const temperatureF = Number.isFinite(tempC) ? (tempC * 9) / 5 + 32 : null;
  const heatIndexC = observation.heatIndex?.value;
  const windChillC = observation.windChill?.value;
  const apparentC = Number.isFinite(heatIndexC) ? heatIndexC : windChillC;
  const feelsLikeF = Number.isFinite(apparentC) ? (apparentC * 9) / 5 + 32 : null;
  const rh = Number(observation.relativeHumidity?.value);
  const pressurePa = Number(observation.barometricPressure?.value);
  const elevationM = Number(data.station?.elevation?.value);
  const tempF = Number.isFinite(tempC) ? `${((tempC * 9) / 5 + 32).toFixed(1)}°F` : 'temperature unavailable';
  const feelsLike = Number.isFinite(feelsLikeF) ? ` · Feels Like ${feelsLikeF.toFixed(1)}°F` : '';
  const wind = Number.isFinite(windSpeedMph) ? `${windSpeedMph.toFixed(1)} mph` : 'wind unavailable';
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
    rh: Number.isFinite(rh) ? rh : null,
    pressureInHg: Number.isFinite(pressurePa) ? pressurePa * 0.000295299830714 : null,
    elevationFt: Number.isFinite(elevationM) ? elevationM * 3.28084 : null,
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

  notificationWeatherLocation = { lat: location.lat, lon: location.lon };
  const { openMeteo, nws } = await fetchWeatherSources(location.lat, location.lon);
  if (token !== commandWeatherRequestToken) return;
  latestPlumeWeather = selectPlumeWeather(openMeteo, nws);
  updateCommandWeatherState(openMeteo, nws, location);
  setText('open-meteo-location', openMeteo?.location || 'Open-Meteo unavailable');
  setText('open-meteo-conditions', openMeteo?.conditions || 'Open-Meteo unavailable');
  setText('nws-station-summary', nws?.station || 'NWS observation station unavailable');
  setText('nws-weather-summary', nws?.conditions || 'NWS live observation unavailable');
  setText('nws-observation-summary', nws?.observedAt || 'Observation time unavailable');
  renderNotificationWeather(openMeteo, nws);
}

function setPlumeInputValue(id, value) {
  const input = document.getElementById(id);
  if (input && Number.isFinite(Number(value))) input.value = String(value);
}

function applyLiveWeatherToPlumeInputs(weather) {
  if (!weather) return false;
  setPlumeInputValue('plume-wind-speed', Number(weather.windSpeedMph).toFixed(1));
  setPlumeInputValue('plume-wind-direction', Number(weather.windDirDeg).toFixed(1));
  setPlumeInputValue('plume-temperature', Number(weather.temperatureF).toFixed(1));
  return true;
}

// Columbia imports are normalized here so a live station can use the same shape later.
function normalizeColumbiaWeatherData(data = {}, sourceMode = 'csv') {
  const value = (name) => data[name] === undefined || data[name] === null ? '' : String(data[name]).trim();
  const sourceWindSpeedUnit = value('windSpeedUnit') || 'mph';
  const sourceWindGustUnit = value('windGustUnit') || sourceWindSpeedUnit;
  const windSpeedMph = convertWindSpeedToMph(value('windSpeed'), sourceWindSpeedUnit);
  const windGustMph = convertWindSpeedToMph(value('windGust'), sourceWindGustUnit);
  return {
    source: 'Columbia Weather Station',
    sourceMode,
    stationName: value('stationName'),
    stationId: value('stationId'),
    observationTime: value('observationTime'),
    windSpeed: windSpeedMph === null ? '' : Number(windSpeedMph.toFixed(1)),
    windSpeedMph: windSpeedMph === null ? null : windSpeedMph,
    windSpeedUnit: 'mph',
    sourceWindSpeedUnit,
    windDirection: value('windDirection'),
    windDirectionUnit: value('windDirectionUnit') || 'degrees',
    windGust: windGustMph === null ? '' : Number(windGustMph.toFixed(1)),
    gustMph: windGustMph,
    temperature: value('temperature'),
    temperatureUnit: value('temperatureUnit') || '°F',
    humidity: value('humidity'),
    pressure: value('pressure'),
    pressureUnit: value('pressureUnit') || 'inHg',
    elevation: value('elevation'),
    elevationUnit: value('elevationUnit') || 'ft',
    raw: data,
  };
}

function getWeatherFreshness(observationTime) {
  if (!observationTime || !Number.isFinite(Date.parse(observationTime))) {
    return { status: 'Time Unknown', ageMinutes: null };
  }
  const ageMinutes = Math.max(0, (Date.now() - Date.parse(observationTime)) / 60000);
  if (ageMinutes <= 10) return { status: 'Current', ageMinutes };
  if (ageMinutes <= 30) return { status: 'Recent / verify', ageMinutes };
  if (ageMinutes <= 60) return { status: 'Stale', ageMinutes };
  return { status: 'Expired', ageMinutes };
}

function getWeatherFreshnessStatus(observationTime) {
  return getWeatherFreshness(observationTime).status;
}

function updatePlumeWeatherSourceStatus(source, observationTime = '', message = '') {
  const freshness = getWeatherFreshness(observationTime);
  setText('plume-weather-source-name', source || 'Not available');
  setText('plume-weather-source-state', message || freshness.status);
  setText('plume-weather-observation-time', observationTime || 'Not available');
  setText('plume-weather-age', freshness.ageMinutes === null ? 'Unknown' : `${Math.round(freshness.ageMinutes)} minutes`);
  updatePlumeInputSummaries();
}

function applyColumbiaWeatherToPlumeInputs(weather) {
  ['plume-wind-speed', 'plume-temperature', 'plume-elevation'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.value = '';
      input.placeholder = 'Not available';
    }
  });
  const direction = document.getElementById('plume-wind-direction');
  if (direction) direction.value = '';
  setPlumeInputValue('plume-wind-speed', weather.windSpeed);
  setPlumeInputValue('plume-temperature', weather.temperature);
  setPlumeInputValue('plume-elevation', weather.elevation);
  if (direction && Number.isFinite(Number(weather.windDirection))) direction.value = weather.windDirection;
  const importedValue = (value, unit = '') => value ? `${value}${unit ? ` ${unit}` : ''}` : 'Not available';
  setText('columbia-station-name', importedValue(weather.stationName));
  setText('columbia-wind-gust', importedValue(weather.windGust, weather.windSpeedUnit));
  setText('columbia-humidity', importedValue(weather.humidity, '%'));
  setText('columbia-pressure', importedValue(weather.pressure, weather.pressureUnit));
  const conversionNote = weather.sourceWindSpeedUnit.toLowerCase() === 'mph'
    ? ''
    : `Wind converted from ${weather.sourceWindSpeedUnit} to mph.`;
  updatePlumeWeatherSourceStatus(weather.stationName || weather.source, weather.observationTime, conversionNote);
}

function parseColumbiaWeatherCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return normalizeColumbiaWeatherData({}, 'csv');
  const headers = lines[0].split(',').map((header) => header.trim());
  const values = lines[1].split(',').map((entry) => entry.trim());
  const knownColumns = ['windSpeed', 'windSpeedUnit', 'windDirection', 'windGust', 'windGustUnit', 'temperature', 'humidity', 'pressure', 'observationTime', 'stationName'];
  const row = {};
  knownColumns.forEach((column) => {
    const index = headers.indexOf(column);
    row[column] = index >= 0 ? values[index] || '' : '';
  });
  return normalizeColumbiaWeatherData(row, 'csv');
}

function selectPlumeWeather(openMeteo, nws, cws = null) {
  const isReading = (value) => value !== null && value !== '' && Number.isFinite(Number(value));
  const isComplete = (weather) => weather
    && isReading(weather.temperatureF)
    && isReading(weather.windSpeedMph) && Number(weather.windSpeedMph) > 0
    && isReading(weather.windDirDeg);
  const candidate = [
    isComplete(cws) ? { ...cws, source: cws.stationName || 'Columbia Weather Station', sourcePriority: 1 } : null,
    isComplete(nws) ? { ...nws, source: nws.station || 'National Weather Service', sourcePriority: 2 } : null,
    isComplete(openMeteo) ? { ...openMeteo, source: 'Open-Meteo current conditions', displayStation: 'Open-Meteo', sourcePriority: 3 } : null,
  ].filter(Boolean).map((weather) => ({ ...weather, ...getWeatherFreshness(weather.observedAt) }))
    .filter((weather) => weather.status !== 'Expired' && weather.status !== 'Time Unknown')
    .sort((left, right) => {
      const freshnessPriority = { Current: 0, 'Recent / verify': 1, Stale: 2 };
      return freshnessPriority[left.status] - freshnessPriority[right.status]
        || left.sourcePriority - right.sourcePriority;
    })[0];
  if (candidate) return candidate;
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
  const fillLevel = document.getElementById('container-fill-level')?.value;
  setText('container-fill-summary', fillLevel ? `${fillLevel}% planning value` : 'Unknown / verify');
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
  setInput('container-fill-level', '');
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
  const puffDurationField = document.getElementById('plume-puff-duration-field');
  if (puffDurationField) puffDurationField.hidden = releaseKind !== 'puff';
  const releaseDurationField = document.getElementById('plume-release-duration-field');
  if (releaseDurationField) releaseDurationField.hidden = releaseKind === 'puff';
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
  const releaseHeightFtValue = document.getElementById('plume-release-height')?.value;
  const releaseHeightFt = releaseHeightFtValue === '' ? 0 : Number(releaseHeightFtValue);

  if (!['plume', 'puff'].includes(releaseKind)) throw new Error('Select a valid release type.');
  if (!Number.isFinite(releaseQuantity) || releaseQuantity <= 0) throw new Error('Enter a release quantity greater than zero.');
  if (!Number.isFinite(windSpeedMph) || windSpeedMph <= 0) throw new Error('Enter a wind speed greater than zero.');
  if (!Number.isFinite(windDirDeg) || windDirDeg < 0 || windDirDeg > 360) throw new Error('Enter the direction the wind is coming from, between 0 and 360 degrees.');
  if (!Number.isFinite(temperatureF)) throw new Error('Enter the current air temperature.');
  if (!Number.isFinite(releaseHeightFt) || releaseHeightFt < 0) throw new Error('Release height must be zero or greater when entered.');

  const releaseQuantityKg = releaseKind === 'puff'
    ? releaseQuantity * 0.45359237
    : releaseQuantity * ({ 'lb-min': 0.45359237 / 60, 'lb-sec': 0.45359237 }[releaseUnit] ?? 0.45359237 / 60);

  return {
    chemicalId: activeChemical.id,
    releaseKind,
    ...(releaseKind === 'puff' ? {
      totalMassKg: releaseQuantityKg,
      durationSec: Number(document.getElementById('plume-puff-duration')?.value),
    } : { releaseRateKgPerSec: releaseQuantityKg }),
    windSpeedMps: windSpeedMph * 0.44704,
    windDirDeg,
    stabilityClass,
    surfaceRoughness,
    releaseHeightM: releaseHeightFt * 0.3048,
    tempC: (temperatureF - 32) * (5 / 9),
    lat: location.lat,
    lng: location.lon,
    endpointDurationMinutes: Number(document.getElementById('plume-endpoint-duration')?.value),
    releaseDurationSec: releaseKind === 'puff'
      ? Number(document.getElementById('plume-puff-duration')?.value)
      : (Number(document.getElementById('plume-release-duration')?.value) * 60) || null,
    sourceType: controlValue('container-model-source', { selectedLabel: true }),
    containerType: controlValue('plume-container-type', { selectedLabel: true }),
    containerCapacity: controlValue('container-capacity', { selectedLabel: true }),
    releasePhase: controlValue('container-release-phase', { selectedLabel: true }),
    pressureCondition: controlValue('container-pressure-condition', { selectedLabel: true }),
    weatherSourceMode: document.getElementById('plume-weather-source')?.value || '',
    weatherSource: document.getElementById('plume-weather-source-name')?.textContent?.trim() || '',
    weatherObservationTime: document.getElementById('plume-weather-observation-time')?.textContent?.trim() || '',
    terrainElevationM: Number(String(document.getElementById('plume-elevation')?.value || '').replace(/,/g, '')) * 0.3048 || null,
    ergSpillSize: document.getElementById('plume-erg-spill-size')?.value || 'large',
    ergPeriod: document.getElementById('plume-erg-period')?.value || 'night',
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
    if (result?.mode === 'erg-protective-action' && result.ergOverlay) {
      const erg = result.ergOverlay;
      return {
        summary: `Bundled ERG 2024 protective-action guide — isolate ${Number(erg.initialIsolationFt).toLocaleString()} ft; protect ${erg.protectiveActionMi} mi downwind (${erg.spillSize} spill, ${erg.period}). Verify against the current PHMSA ERG.`,
        result,
      };
    }
    if (!result?.isopleths?.some((item) => item.polygon?.length >= 2)) {
      return { summary: 'No supported exposure thresholds were returned for this chemical.', result: null };
    }
    const maxDownwindM = Math.max(0, ...(result.isopleths || []).map((item) => item.maxDownwindM));
    const rangeTruncated = (result.isopleths || []).some((item) => item.rangeTruncated);
    return {
      summary: `Planning Plume — ${rangeTruncated ? 'at least ' : ''}${Math.round(maxDownwindM * 3.28084).toLocaleString()} ft ${rangeTruncated ? 'to computational boundary' : 'maximum modeled downwind extent'}`,
      result,
    };
  } catch {
    return { summary: 'The plume model service could not be reached. Verify connectivity and try again.', result: null };
  }
}

async function getPlumeModeAvailability() {
  if (!activeChemical) return { summary: 'Identify a chemical before selecting plume guidance.', result: null };
  const query = new URLSearchParams({
    chemicalId: String(activeChemical.selectedChemicalId ?? activeChemical.id),
    endpointDurationMinutes: document.getElementById('plume-endpoint-duration')?.value || '60',
    ergSpillSize: document.getElementById('plume-erg-spill-size')?.value || 'large',
    ergPeriod: document.getElementById('plume-erg-period')?.value || 'night',
  });
  try {
    const response = await fetch(`/api/plume/availability?${query}`);
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      return { summary: result?.error || 'Plume guidance availability could not be verified.', result: null };
    }
    if (result?.mode === 'erg-protective-action' && result.ergOverlay) {
      const erg = result.ergOverlay;
      return {
        summary: `ERG 2024 protective-action guide — isolate ${Number(erg.initialIsolationFt).toLocaleString()} ft; protect ${erg.protectiveActionMi} mi downwind (${erg.spillSize} spill, ${erg.period})`,
        result,
      };
    }
    if (result?.mode === 'no-distance-data') {
      return { summary: result.error, result: null };
    }
    return { summary: result?.display || 'AEGL / LOC Plume Model', result };
  } catch {
    return { summary: 'The plume guidance service could not be reached. Verify connectivity and try again.', result: null };
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

function controlValue(id, { selectedLabel = false } = {}) {
  const control = document.getElementById(id);
  if (!control) return noCurrentDataText;
  const value = selectedLabel ? control.selectedOptions?.[0]?.textContent?.trim() : control.value?.trim();
  return value || noCurrentDataText;
}

function plumeSummaryValue(value) {
  const text = String(value ?? '').trim();
  return text && !/^(?:not available|unavailable|unknown|unknown \/ verify|unknown \/ custom|select)$/i.test(text)
    ? text
    : noCurrentDataText;
}

function setPlumeStatusBadge(id, text, state) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.textContent = text;
  badge.dataset.state = state;
}

function updateRequiredPlumeFieldStyles() {
  const releaseType = document.getElementById('plume-release-type')?.value;
  const value = (id) => document.getElementById(id)?.value ?? '';
  const finite = (id) => value(id) !== '' && Number.isFinite(Number(value(id)));
  const complete = {
    'plume-chemical-input': Boolean(activeChemical && /^\d+$/.test(String(activeChemical.selectedChemicalId ?? activeChemical.id ?? ''))),
    'plume-release-type': ['plume', 'puff'].includes(releaseType),
    'plume-release-quantity': Number(value('plume-release-quantity')) > 0,
    'plume-puff-duration': releaseType !== 'puff' || Number(value('plume-puff-duration')) > 0,
    'plume-release-duration': releaseType !== 'plume' || Number(value('plume-release-duration')) > 0,
    'plume-wind-speed': Number(value('plume-wind-speed')) > 0,
    'plume-wind-direction': finite('plume-wind-direction')
      && Number(value('plume-wind-direction')) >= 0
      && Number(value('plume-wind-direction')) <= 360,
    'plume-temperature': finite('plume-temperature'),
  };
  Object.entries(complete).forEach(([id, isComplete]) => {
    document.getElementById(id)?.closest('.plume-required-field')?.classList.toggle('is-complete', isComplete);
  });
}

function updatePlumeEvidenceStatus(result = null) {
  if (!result) {
    setText('plume-model-mode-badge', 'Cannot Plot — Missing Required Data');
    setText('plume-confidence-badge', 'Insufficient Data');
    return;
  }
  setText('plume-model-mode-badge', result.modelModeLabel || result.display || 'HazMatIQ Planning Estimate');
  setText('plume-confidence-badge', result.confidenceLevel || result.plumeStatus || 'Requires Review');
  setText('plume-source-strength-badge', result.sourceStrength?.status || (result.mode === 'erg-protective-action' ? 'Not Applicable — ERG Overlay' : 'Requires Review'));
  setText('plume-source-strength-detail', result.sourceStrength
    ? `${result.sourceStrength.sourceStrengthMethod}. Missing: ${result.sourceStrength.missingInputs?.join(', ') || 'none'}.`
    : 'No dispersion source-strength calculation is used for an ERG overlay.');
  setText('plume-weather-quality-badge', result.weather?.freshness || (result.mode === 'erg-protective-action' ? 'Verify Wind Direction' : 'Time Unknown'));
  setText('plume-weather-quality-detail', result.weather
    ? `${result.weather.status}. ${result.weather.limitations?.join(' ') || 'Source and time recorded.'}`
    : 'Verify wind direction and current field conditions.');
  setText('plume-endpoint-badge', result.endpoint?.endpointSource || (result.mode === 'erg-protective-action' ? 'PHMSA ERG 2024' : 'No Current Data Exists'));
  setText('plume-endpoint-detail', result.endpoint
    ? `${result.endpoint.selectedDurationMinutes}-minute AEGL endpoint linked to CAS ${result.endpoint.casNumber}.`
    : (result.endpointStatus || 'No verified endpoint is available.'));
  setText('plume-text-summary', result.textSummary || result.endpointStatus || 'No Current Data Exists');
  updateOperationalPlumeReadiness(latestPlumeAvailability, result, result.textSummary || result.endpointStatus);
}

let latestPlumeAvailability = null;

function updateOperationalPlumeReadiness(availability = latestPlumeAvailability, result = null, reason = '') {
  if (availability) latestPlumeAvailability = availability;
  const masterId = availability?.masterChemicalId || result?.masterChemicalId || activeChemical?.selectedChemicalId || activeChemical?.id;
  const cas = availability?.chemicalIdentity?.casNumber || result?.chemicalIdentity?.casNumber
    || activeChemicalRecord?.profile?.header?.cas || '';
  const missing = getMissingPlumeRequiredInputs();
  const releaseLabels = new Set(['Release Type', 'Release Quantity', 'Puff Evaluation Time', 'Release Duration', 'Valid Release Height']);
  const weatherLabels = new Set(['Wind Speed', 'Wind Direction', 'Temperature', 'Current Weather Observation', 'Configured Live Weather Source']);
  const missingRelease = missing.filter((item) => releaseLabels.has(item));
  const missingWeather = missing.filter((item) => weatherLabels.has(item));
  const weatherMode = document.getElementById('plume-weather-source')?.value;
  const endpointFound = result?.endpoint || availability?.mode === 'aegl-plume';
  const endpoint = result?.endpoint || availability?.endpoint;
  const profileHeader = activeChemicalRecord?.profile?.header || {};
  const un = availability?.ergAvailability?.un || result?.ergOverlay?.un || profileHeader.un || '';
  const ergGuide = availability?.ergAvailability?.guide || result?.ergOverlay?.guide || profileHeader.ergGuide || '';

  setText('plume-readiness-master', masterId && /^\d+$/.test(String(masterId)) ? 'Verified' : 'Requires Review');
  setText('plume-header-chemical', activeChemical?.name || availability?.chemicalIdentity?.chemicalName || 'Select a verified chemical for operational plume planning.');
  setText('plume-header-identifiers', [cas ? `CAS ${cas}` : null, un ? `UN ${un}` : null, ergGuide ? `ERG ${ergGuide}` : null].filter(Boolean).join(' · ') || 'CAS / UN / ERG pending');
  setText('plume-readiness-cas', cas || 'No Current Data Exists');
  setText('plume-endpoint-badge', endpointFound ? 'Found' : 'Missing');
  setText('plume-header-endpoint-chip', endpointFound ? 'AEGL' : 'Missing');
  setText('plume-endpoint-detail', endpointFound
    ? `${result?.endpoint?.endpointSource || availability?.endpoint?.endpointSource || 'EPA AEGL'} · exact CAS/source link`
    : (availability?.endpointStatus || 'No verified AEGL / LOC link found.'));
  const endpointLevels = document.getElementById('plume-endpoint-levels');
  if (endpointLevels) {
    endpointLevels.replaceChildren();
    if (endpoint) {
      endpointLevels.append(document.createTextNode(`${endpoint.selectedDurationMinutes}-minute · `));
      [['AEGL-1', endpoint.aegl1, '#ffd323'], ['AEGL-2', endpoint.aegl2, '#f28c18'], ['AEGL-3', endpoint.aegl3, '#d71920']]
        .forEach(([label, value, color], index, entries) => {
          const level = document.createElement('span');
          level.textContent = `${label} ${value} ${endpoint.units}`;
          level.style.color = color;
          level.style.fontWeight = '900';
          endpointLevels.append(level);
          if (index < entries.length - 1) endpointLevels.append(document.createTextNode(' · '));
        });
    } else {
      endpointLevels.textContent = 'No Current Data Exists';
    }
  }
  setText('plume-readiness-release', missingRelease.length ? 'Missing' : 'Complete');
  setText('plume-readiness-release-detail', missingRelease.length ? missingRelease.join(', ') : 'Required release inputs are present.');
  if (!result?.sourceStrength) {
    setText('plume-source-strength-badge', missingRelease.length ? 'Cannot Calculate' : 'Planning Estimate');
    setText('plume-source-strength-detail', missingRelease.length
      ? `Missing: ${missingRelease.join(', ')}.`
      : 'Release inputs support a planning source-strength estimate; verify assumptions and field conditions.');
  }
  setText('plume-weather-quality-badge', missingWeather.length
    ? 'Missing'
    : weatherMode === 'manual' ? 'Manual Entry' : 'Current');
  setText('plume-model-weather-quality', missingWeather.length
    ? `Missing: ${missingWeather.join(', ')}`
    : weatherMode === 'manual' ? 'Manual Entry — verify field conditions.' : 'Current live weather');
  setText('plume-weather-quality-detail', missingWeather.length
    ? missingWeather.join(', ')
    : weatherMode === 'manual' ? 'Manual Entry — verify field conditions.' : 'Live weather available.');

  const selectedMode = endpointFound && !missing.length ? 'Planning Plume' : 'Blocked';
  setText('plume-model-mode-badge', selectedMode);
  setText('plume-header-mode-chip', selectedMode === 'Planning Plume' ? 'Planning Estimate' : selectedMode);
  const readinessReason = reason || (endpointFound
    ? missing.length ? `AEGL / LOC found. Missing: ${missing.join(', ')}.` : 'AEGL / LOC and required plume inputs are available.'
    : 'No verified AEGL / LOC endpoint is available for this plume estimate.');
  setText('plume-readiness-reason', readinessReason);
}

function updatePlumeInputSummaries() {
  updateRequiredPlumeFieldStyles();
  const releaseQuantity = controlValue('plume-release-quantity');
  const releaseUnit = controlValue('plume-release-unit', { selectedLabel: true });
  const capacity = plumeSummaryValue(controlValue('container-capacity', { selectedLabel: true }));
  setText('plume-review-chemical', activeChemical?.name || noCurrentDataText);
  setText('plume-review-release', controlValue('plume-release-type', { selectedLabel: true }));
  setText('plume-review-container', plumeSummaryValue(controlValue('plume-container-type', { selectedLabel: true })));
  setText('plume-review-quantity', [capacity, releaseQuantity === noCurrentDataText ? '' : `${releaseQuantity} ${releaseUnit}`]
    .filter((value) => value && value !== noCurrentDataText).join(' · ') || noCurrentDataText);
  setText('plume-review-pressure', plumeSummaryValue(controlValue('container-pressure-condition', { selectedLabel: true })));
  setText('plume-review-phase', plumeSummaryValue(controlValue('container-release-phase', { selectedLabel: true })));
  const modelSource = controlValue('container-model-source', { selectedLabel: true });
  setText('plume-review-model-source', modelSource === 'Auto-select'
    ? 'Auto-select · Planning Default — verify before operational use'
    : plumeSummaryValue(modelSource));

  const sourceMode = document.getElementById('plume-weather-source')?.value;
  const source = document.getElementById('plume-weather-source-name')?.textContent?.trim()
    || controlValue('plume-weather-source', { selectedLabel: true });
  const observationTime = plumeSummaryValue(document.getElementById('plume-weather-observation-time')?.textContent);
  const sourceStatus = plumeSummaryValue(document.getElementById('plume-weather-source-state')?.textContent);
  const windSpeed = controlValue('plume-wind-speed');
  const windDirection = controlValue('plume-wind-direction');
  const wind = windSpeed === noCurrentDataText || windDirection === noCurrentDataText
    ? noCurrentDataText
    : `${windSpeed} mph from ${windDirection}`;
  const windFromDegrees = Number(windDirection);
  setText('plume-wind-direction-status', Number.isFinite(windFromDegrees)
    ? `Wind from ${Math.round(windFromDegrees)}° · Downwind ${Math.round((windFromDegrees + 180) % 360)}°`
    : 'Missing Wind Direction');
  const weatherDetail = (liveKey, domId, unit = '') => {
    const liveValue = ['auto-live', 'open-meteo'].includes(sourceMode) ? latestPlumeWeather?.[liveKey] : null;
    if (liveValue !== null && liveValue !== undefined && liveValue !== '') return `${liveValue}${unit}`;
    const element = document.getElementById(domId);
    return plumeSummaryValue(element?.value ?? element?.textContent);
  };
  setText('plume-review-weather-source', plumeSummaryValue(source));
  setText('plume-review-observation-time', observationTime);
  setText('plume-review-source-status', sourceStatus);
  setText('plume-review-wind', wind);
  setText('plume-review-gusts', weatherDetail('gustMph', 'columbia-wind-gust', ' mph'));
  const temperature = controlValue('plume-temperature');
  setText('plume-review-temperature', temperature === noCurrentDataText ? noCurrentDataText : `${temperature}°F`);
  setText('plume-review-humidity', weatherDetail('rh', 'columbia-humidity', '%'));
  setText('plume-review-elevation', weatherDetail('elevationFt', 'plume-elevation', ' ft'));

  const weatherMissing = [windSpeed, windDirection, temperature].some((value) => value === noCurrentDataText);
  if (weatherMissing) setPlumeStatusBadge('plume-weather-badge', 'Weather Missing', 'missing');
  else if (sourceMode === 'manual') setPlumeStatusBadge('plume-weather-badge', 'Manual Weather', 'verify');
  else if (/stale/i.test(sourceStatus)) setPlumeStatusBadge('plume-weather-badge', 'Stale Weather', 'warning');
  else if (/live|current/i.test(sourceStatus)) setPlumeStatusBadge('plume-weather-badge', 'Verified Source', 'verified');
  else setPlumeStatusBadge('plume-weather-badge', 'Verify Weather', 'verify');
}

function getMissingPlumeRequiredInputs() {
  const missing = [];
  if (!activeChemical || !/^\d+$/.test(String(activeChemical.selectedChemicalId ?? activeChemical.id ?? ''))) missing.push('Verified Chemical Link');
  const releaseType = document.getElementById('plume-release-type')?.value;
  if (!['plume', 'puff'].includes(releaseType)) missing.push('Release Type');
  if (!(Number(document.getElementById('plume-release-quantity')?.value) > 0)) missing.push('Release Quantity');
  if (releaseType === 'puff' && !(Number(document.getElementById('plume-puff-duration')?.value) > 0)) missing.push('Puff Evaluation Time');
  if (releaseType === 'plume' && !(Number(document.getElementById('plume-release-duration')?.value) > 0)) missing.push('Release Duration');
  const releaseHeight = document.getElementById('plume-release-height')?.value;
  if (releaseHeight !== '' && (!Number.isFinite(Number(releaseHeight)) || Number(releaseHeight) < 0)) missing.push('Valid Release Height');
  if (!(Number(document.getElementById('plume-wind-speed')?.value) > 0)) missing.push('Wind Speed');
  const windDirection = document.getElementById('plume-wind-direction')?.value;
  if (windDirection === '' || !Number.isFinite(Number(windDirection))) missing.push('Wind Direction');
  if (!Number.isFinite(Number(document.getElementById('plume-temperature')?.value))
    || document.getElementById('plume-temperature')?.value === '') missing.push('Temperature');
  const sourceMode = document.getElementById('plume-weather-source')?.value;
  const observationTime = document.getElementById('plume-weather-observation-time')?.textContent?.trim();
  const freshness = getWeatherFreshness(observationTime);
  if (sourceMode === 'columbia-live') missing.push('Configured Live Weather Source');
  if (sourceMode !== 'manual' && ['Expired', 'Time Unknown'].includes(freshness.status)) missing.push('Current Weather Observation');
  return missing;
}

function getMissingErgOverlayInputs() {
  const missing = [];
  if (!activeChemical || !/^\d+$/.test(String(activeChemical.selectedChemicalId ?? activeChemical.id ?? ''))) missing.push('Verified Chemical Link');
  const windDirection = document.getElementById('plume-wind-direction')?.value;
  if (windDirection === '' || !Number.isFinite(Number(windDirection))) missing.push('Wind Direction');
  return missing;
}

function showPlumeWorkflowMessage(message) {
  const status = document.getElementById('plume-input-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = 'error';
}

function buildPlumeWorkflowRecord({ location, inputs, modeled, command }) {
  const profileHeader = activeChemicalRecord?.profile?.header || {};
  const maxDownwindM = Math.max(0, ...(modeled.result.isopleths || []).map((zone) => Number(zone.maxDownwindM) || 0));
  const rangeTruncated = (modeled.result.isopleths || []).some((zone) => zone.rangeTruncated);
  const metric = (id) => {
    const value = document.getElementById(id)?.textContent?.trim();
    return value && !['—', '…', 'Unavailable'].includes(value) ? value : noCurrentDataText;
  };
  const activeIncident = getActiveIncident();
  const createdAt = modeled.result.computedAt || new Date().toISOString();
  const weatherSourceMode = document.getElementById('plume-weather-source')?.value;
  const weatherValue = (property, fallbackId = '') => {
    const value = ['auto-live', 'open-meteo'].includes(weatherSourceMode) ? latestPlumeWeather?.[property] : null;
    if (value !== null && value !== undefined && value !== '') return value;
    return fallbackId ? controlValue(fallbackId) : noCurrentDataText;
  };
  const planningDefault = document.getElementById('container-pressure-confidence-summary')?.textContent?.trim() || 'Planning default';
  const weatherObservationTime = document.getElementById('plume-weather-observation-time')?.textContent?.trim() || '';
  const weatherFreshness = getWeatherFreshness(weatherObservationTime);
  const outputStatus = modeled.result.confidenceLevel
    || (weatherSourceMode === 'manual' || weatherFreshness.status !== 'Current'
      ? 'Needs Verification'
      : (modeled.result.plumeStatus || 'Planning Estimate'));
  const endpoint = modeled.result.endpoint || {};
  const threatZones = (currentThreatZoneGeoJson?.features || []).map((feature) => feature.properties || {});
  const plumeResult = {
    id: `plume-workflow-${Date.now()}`,
    generatedAt: createdAt,
    mode: activeIncident ? 'active-incident' : 'planning',
    chemical: {
      masterChemicalId: modeled.result.masterChemicalId || (activeChemical?.selectedChemicalId ?? activeChemical?.id ?? noCurrentDataText),
      chemicalName: activeChemical?.name || noCurrentDataText,
      casNumber: profileHeader.cas || activeChemicalRecord?.cas || noCurrentDataText,
      unNumber: profileHeader.un || activeChemicalRecord?.un || noCurrentDataText,
      sourceStatus: modeled.result.chemicalIdentity?.sourceStatus || 'Verified Chemical Companion Master Record',
    },
    endpoint: {
      endpointType: 'AEGL',
      endpointSource: endpoint.endpointSource || noCurrentDataText,
      selectedLevel: 'AEGL-1 / AEGL-2 / AEGL-3 zones',
      selectedDuration: endpoint.selectedDurationMinutes || inputs.endpointDurationMinutes,
      value: { aegl1: endpoint.aegl1, aegl2: endpoint.aegl2, aegl3: endpoint.aegl3 },
      units: endpoint.units || 'ppm',
      endpointStatus: endpoint.endpointStatus || noCurrentDataText,
    },
    release: {
      releaseType: controlValue('plume-release-type', { selectedLabel: true }),
      quantity: controlValue('plume-release-quantity'),
      containerType: controlValue('plume-container-type', { selectedLabel: true }),
      releasePhase: controlValue('container-release-phase', { selectedLabel: true }),
      pressureCondition: controlValue('container-pressure-condition', { selectedLabel: true }),
      releaseRate: inputs.releaseRateKgPerSec ?? null,
      duration: inputs.durationSec ?? null,
      sourceStatus: `${planningDefault} — operator-entered release inputs require verification.`,
    },
    weather: {
      source: document.getElementById('plume-weather-source-name')?.textContent?.trim() || controlValue('plume-weather-source', { selectedLabel: true }),
      observationTime: weatherObservationTime || noCurrentDataText,
      ageMinutes: weatherFreshness.ageMinutes === null ? null : Number(weatherFreshness.ageMinutes.toFixed(1)),
      sourceStatus: document.getElementById('plume-weather-source-state')?.textContent?.trim() || noCurrentDataText,
      windSpeed: controlValue('plume-wind-speed'),
      windDirection: inputs.windDirDeg,
      windGusts: weatherValue('gustMph', 'columbia-wind-gust'),
      temperature: controlValue('plume-temperature'),
      humidity: weatherValue('rh', 'columbia-humidity'),
      pressure: weatherValue('pressureInHg', 'columbia-pressure'),
      stabilityClass: inputs.stabilityClass || noCurrentDataText,
      elevation: weatherValue('elevationFt', 'plume-elevation'),
      elevationSource: Number.isFinite(Number(latestPlumeWeather?.elevationFt))
        ? latestPlumeWeather.source
        : (document.getElementById('plume-elevation')?.value ? 'Open-Meteo location elevation' : noCurrentDataText),
      limitations: weatherSourceMode === 'manual'
        ? ['Manual Weather Entry — verify before operational use.']
        : weatherFreshness.status === 'Current' ? [] : [`Weather ${weatherFreshness.status} — verify before operational use.`],
    },
    model: {
      modelMode: modeled.result.modelMode || 'HAZMATIQ_PLANNING_ESTIMATE',
      modelModeLabel: modeled.result.modelModeLabel || 'HazMatIQ Planning Estimate',
      modelFamily: modeled.result.modelFamily || 'Gaussian neutral gas',
      modelName: modeled.result.modelName || modeled.result.modelMetadata?.modelName || noCurrentDataText,
      formulaName: 'Gaussian plume / puff screening equations',
      formulaVersion: modeled.result.modelVersion,
      validationStatus: modeled.result.validationStatus || 'Not independently validated',
      validated: false,
      limitations: modeled.result.limitations || modeled.result.modelMetadata?.limitations || [],
      confidenceStatus: outputStatus,
      confidenceLevel: modeled.result.confidenceLevel || outputStatus,
    },
    output: {
      resultSummary: modeled.summary,
      maxDistance: { meters: maxDownwindM, feet: Math.round(maxDownwindM * 3.28084), rangeTruncated, qualifier: rangeTruncated ? 'at least; computational boundary reached' : 'modeled sampled endpoint' },
      redZone: threatZones.find((zone) => Number(zone.threatRank) === 3) || null,
      orangeZone: threatZones.find((zone) => Number(zone.threatRank) === 2) || null,
      yellowZone: threatZones.find((zone) => Number(zone.threatRank) === 1) || null,
      threatZones,
      geometry: currentThreatZoneGeoJson,
      mapCenter: [location.lon, location.lat],
    },
    sourceStrength: modeled.result.sourceStrength || null,
    terrain: modeled.result.terrain || null,
    assumptions: modeled.result.assumptions || [],
    fieldVerificationRequirements: modeled.result.fieldVerificationRequirements || [],
    textSummary: modeled.result.textSummary || modeled.summary,
    tacticalDecisionFlow: {
      verifyIsolateImpact: 'Use the ERG initial-isolation guide only after checking the current PHMSA ERG; AEGL zones are planning support and require field monitoring and Incident Command verification.',
      lifeSafetyImpact: 'Plume output does not select or downgrade PPE; use approved PPE source logic.',
      mitigationImpact: 'Plume output alone does not justify offensive mitigation; uncertainty favors verification and defensive posture.',
    },
    disclaimers: {
      plumeEstimate: 'Plume results are planning estimates unless validation results are shown for this chemical, release scenario, and endpoint.',
      weatherVerification: 'Weather data source and observation time must be verified. Stale or manually entered weather can significantly affect plume output.',
      validationStatus: 'Plume output does not replace field monitoring, official modeling, agency SOPs, or Incident Command.',
    },
  };
  return {
    ...plumeResult,
    plumeResult,
    incidentId: activeIncident?.incidentId || null,
    incidentName: activeIncident?.incidentName || 'Planning Mode',
    createdAt,
    updatedAt: createdAt,
    exportReady: true,
    reportReady: true,
    includeInIncidentReport: true,
    location: { latitude: location.lat, longitude: location.lon, source: location.source || noCurrentDataText, address: location.address || getIncidentAddressValue() || noCurrentDataText },
    plumeOutput: {
      ...plumeResult.output,
      modelStatus: plumeResult.model.confidenceStatus,
      validationStatus: plumeResult.model.validationStatus,
      endpoint: plumeResult.endpoint,
      limitations: plumeResult.model.limitations,
      generatedAt: createdAt,
    },
    threatZone: {
      status: readinessStatus.planning,
      summary: document.getElementById('demographics-zone-summary')?.textContent?.trim() || noCurrentDataText,
      estimatedPopulation: metric('demographics-population'),
      estimatedHouseholds: metric('demographics-housing'),
      visibleFootprintStructures: metric('demographics-structures'),
      nearbyCensusGeographyHouseholds: metric('demographics-census-households'),
      householdEstimateMethod: latestThreatZoneHouseholdEstimate?.householdEstimateMethod || noCurrentDataText,
      householdEstimateStatus: latestThreatZoneHouseholdEstimate?.householdEstimateStatus || readinessStatus.missing,
      householdEstimateSource: latestThreatZoneHouseholdEstimate?.source || noCurrentDataText,
      householdEstimateLimitations: latestThreatZoneHouseholdEstimate?.limitations || noCurrentDataText,
      schoolsAndDaycares: metric('demographics-schools'),
      healthcareFacilities: metric('demographics-healthcare'),
      nursingAndAssistedLiving: metric('demographics-nursing'),
      criticalInfrastructure: metric('demographics-critical'),
      businessesAndIndustrialSites: metric('demographics-businesses'),
      criticalReceptors: {
        schoolsAndDaycares: metric('demographics-schools'),
        healthcareFacilities: metric('demographics-healthcare'),
        nursingAndAssistedLiving: metric('demographics-nursing'),
        criticalInfrastructure: metric('demographics-critical'),
      },
      protectiveActionSummary: activeChemicalRecord?.commandFacts?.protectiveAction || noCurrentDataText,
      sourceLabels: document.getElementById('demographics-source-status')?.textContent?.trim() || noCurrentDataText,
    },
    commandSummary: command,
    disclaimers: {
      decisionSupport: plumePlanningNotices[0],
      plumeEstimate: plumePlanningNotices[1],
      dataVerification: plumePlanningNotices[2],
      weatherVerification: plumePlanningNotices[3],
      validationStatus: plumeResult.disclaimers.validationStatus,
    },
  };
}

function buildErgOverlayWorkflowRecord({ location, modeled, command }) {
  const createdAt = new Date().toISOString();
  const erg = modeled.result.ergOverlay;
  const record = {
    id: `erg-overlay-${Date.now()}`,
    generatedAt: createdAt,
    mode: 'erg-protective-action',
    chemical: {
      masterChemicalId: modeled.result.masterChemicalId,
      chemicalName: activeChemical?.name || noCurrentDataText,
      casNumber: modeled.result.chemicalIdentity?.casNumber || noCurrentDataText,
      unNumber: erg.un,
    },
    endpoint: {
      endpointType: 'ERG 2024 protective-action distance',
      endpointSource: erg.source,
      selectedLevel: `${erg.spillSize} spill · ${erg.period}`,
      endpointStatus: modeled.result.endpointStatus,
    },
    model: {
      modelMode: modeled.result.modelMode || 'ERG_ISOLATION_PROTECTIVE_ACTION_OVERLAY',
      modelModeLabel: modeled.result.modelModeLabel || 'ERG Isolation / Protective Action Overlay — Not a Plume Model',
      modelName: 'No dispersion model — ERG source-distance overlay',
      validationStatus: 'Not a modeled plume or toxic concentration contour',
      confidenceStatus: 'ERG Protective Action Guide',
      limitations: erg.limitations,
    },
    output: {
      resultSummary: modeled.summary,
      initialIsolationFt: erg.initialIsolationFt,
      protectiveActionMi: erg.protectiveActionMi,
      geometry: currentThreatZoneGeoJson,
      mapCenter: [location.lon, location.lat],
    },
    confidenceLevel: modeled.result.confidenceLevel || 'ERG Protective Action Guide',
    assumptions: modeled.result.assumptions || [],
    fieldVerificationRequirements: modeled.result.fieldVerificationRequirements || [],
    textSummary: modeled.result.textSummary || modeled.summary,
    commandSummary: command,
    disclaimers: {
      decisionSupport: plumePlanningNotices[0],
      sourceBoundary: erg.limitations.join(' '),
    },
  };
  return {
    ...record,
    plumeResult: record,
    createdAt,
    updatedAt: createdAt,
    exportReady: true,
    reportReady: true,
    includeInIncidentReport: true,
    location: {
      latitude: location.lat,
      longitude: location.lon,
      source: location.source || noCurrentDataText,
      address: location.address || getIncidentAddressValue() || noCurrentDataText,
    },
  };
}

// Planning results stay separate from official incident documentation.
function savePlumeResult(command, workflowRecord, mapImage = '') {
  const savedAt = new Date().toISOString();
  const activeIncident = getActiveIncident();
  if (!activeIncident) {
    savePlanningState({
      selectedChemical: activeChemical,
      plumeSummary: command,
      plumeModelResults: workflowRecord,
      ...(mapImage ? { plumeMapImage: mapImage } : {}),
      savedAt,
    });
    return 'planning';
  }
  const incidents = readIncidents();
  const index = incidents.findIndex((incident) => incident.incidentId === activeIncident.incidentId);
  if (index < 0) return 'planning';
  incidents[index] = {
    ...incidents[index],
    plumeSummary: command,
    plumeModelResults: workflowRecord,
    plumeUpdatedAt: savedAt,
    ...(mapImage ? { plumeMapImage: mapImage } : {}),
  };
  try {
    writeIncidents(incidents);
  } catch {
    delete incidents[index].plumeMapImage;
    writeIncidents(incidents);
  }
  return 'active-incident';
}

function saveLatestPlumeOverlay({ location, releaseType, windSpeed, windDirection, stabilityClass, notes }) {
  const timestamp = new Date().toISOString();
  const overlay = {
    id: `plume-${Date.now()}`,
    incidentId: window.localStorage.getItem(activeIncidentIdStorageKey) || null,
    chemicalName: activeChemical?.name || '',
    releaseType,
    timestamp,
    mapCenter: [location.lon, location.lat],
    windSpeed,
    windDirection,
    stabilityClass,
    plumeGeometry: currentThreatZoneGeoJson,
    threatZones: (currentThreatZoneGeoJson?.features || []).map((feature) => feature.properties || {}),
    source: currentThreatZoneGeoJson?.features?.some((feature) => feature.properties?.overlayMode === 'erg-protective-action')
      ? 'PHMSA ERG 2024 Protective Action Guide'
      : 'Plume Model',
    overlayMode: currentThreatZoneGeoJson?.features?.some((feature) => feature.properties?.overlayMode === 'erg-protective-action')
      ? 'erg-protective-action'
      : 'aegl-plume',
    notes,
  };
  window.HazMatIQ.latestPlumeOverlay = overlay;
  try {
    window.localStorage.setItem(latestPlumeOverlayStorageKey, JSON.stringify(overlay));
  } catch {
    // The shared in-memory overlay remains available to Live Map this session.
  }
  window.dispatchEvent(new CustomEvent('hazmatiq:plume-updated', { detail: overlay }));
}

async function plotPlumeFromControls(locationOverride = null) {
  const plotButton = document.getElementById('plot-plume-btn');
  const resultsSection = document.getElementById('plume-results-section');
  if (resultsSection) resultsSection.hidden = true;
  if (plotButton) plotButton.disabled = true;
  setText('plume-input-status', 'Checking source-backed plume and ERG guidance…');
  document.getElementById('plume-input-status')?.setAttribute('data-state', 'working');
  setText('plume-overlay-status', 'Calculating plume zones…');
  try {
    const availability = await getPlumeModeAvailability();
    latestPlumeAvailability = availability.result;
    updateOperationalPlumeReadiness(availability.result, null, availability.summary);
    if (!availability.result) {
      updatePlumeEvidenceStatus(null);
      setText('backend-model-summary', availability.summary);
      await clearThreatZones(availability.summary);
      if (/No Current Data Exists/i.test(availability.summary)) {
        setText('plume-endpoint-status', 'No approved AEGL / LOC or ERG isolation/protective-action distance is available.');
        setText('plume-model-status-summary', 'No Model / No Distance Available');
        setText('plume-zone-meaning-summary', 'No Current Data Exists');
        showPlumeWorkflowMessage(availability.summary);
      } else {
        showPlumeWorkflowMessage(`Cannot select plume guidance yet. ${availability.summary}`);
      }
      return;
    }
    let location = locationOverride;
    if (!location) {
      try {
        location = await getIncidentCoordinates({ requestGps: true, allowPlumeManual: true });
      } catch {
        throw new Error('Cannot plot plume yet. Missing: Incident Location. Enter an incident address or coordinates, place the planning pin, or allow Current GPS.');
      }
    }
    if (!location) throw new Error('Cannot plot plume yet. Missing: Incident Location.');
    const mapReady = ensurePlumeMap(location);
    let inputs = null;
    let modeled = availability;
    if (availability.result?.mode === 'aegl-plume') {
      const missingInputs = getMissingPlumeRequiredInputs();
      if (missingInputs.length) throw new Error(`Cannot plot plume yet. Missing: ${missingInputs.join(', ')}.`);
      inputs = readPlumeModelInputs(location);
      modeled = await runBackendPlume(inputs);
    } else if (availability.result?.mode === 'erg-protective-action') {
      const missingInputs = getMissingErgOverlayInputs();
      if (missingInputs.length) throw new Error(`Cannot display ERG protective-action guidance yet. Missing: ${missingInputs.join(', ')}.`);
      inputs = {
        chemicalId: activeChemical.id,
        windDirDeg: Number(document.getElementById('plume-wind-direction')?.value),
        lat: location.lat,
        lng: location.lon,
      };
      modeled.result.inputs = inputs;
    }
    if (hasActiveIncident()) saveIncidentBrief({ quiet: true });
    setText('backend-model-summary', modeled.summary);
    if (!modeled.result) {
      updatePlumeEvidenceStatus(null);
      await clearThreatZones(modeled.summary);
      if (/No Current Data Exists/i.test(modeled.summary)) {
        setText('plume-endpoint-status', 'No approved AEGL / LOC or ERG isolation/protective-action distance is available.');
        setText('plume-model-status-summary', 'No Model / No Distance Available');
        setText('plume-zone-meaning-summary', 'No Current Data Exists');
        showPlumeWorkflowMessage(modeled.summary);
      } else {
        showPlumeWorkflowMessage(`Cannot plot plume yet. ${modeled.summary}`);
      }
      return;
    }

    updatePlumeEvidenceStatus(modeled.result);

    await mapReady;
    if (modeled.result.mode === 'erg-protective-action') {
      const erg = modeled.result.ergOverlay;
      const geojson = ergOverlayToGeoJson(modeled.result, location);
      const rendered = await renderThreatZones(
        geojson,
        'ERG Initial Isolation / Protective Action Overlay — not a modeled plume.',
      );
      if (!rendered) throw new Error('The ERG record did not return a displayable isolation or protective-action distance.');
      const releaseType = document.getElementById('plume-release-type')?.selectedOptions?.[0]?.textContent;
      const windSpeed = document.getElementById('plume-wind-speed')?.value;
      const windDirection = document.getElementById('plume-wind-direction')?.value;
      const stability = document.getElementById('plume-stability-class')?.value;
      activePlumeCommand = {
        title: `${activeChemical.name} ERG protective-action overlay`,
        summary: modeled.summary,
        source: `${erg.source} · UN ${erg.un} · Guide ${erg.guide}`,
        details: [
          `ERG selection: ${erg.spillSize} spill · ${erg.period}`,
          `Initial isolation: ${Number(erg.initialIsolationFt).toLocaleString()} ft`,
          `Protective action: ${erg.protectiveActionMi} mi downwind`,
          `Wind direction input: ${windDirection}°`,
          ...erg.limitations,
        ],
      };
      const workflowRecord = buildErgOverlayWorkflowRecord({ location, modeled, command: activePlumeCommand });
      saveLatestPlumeOverlay({
        location,
        releaseType,
        windSpeed,
        windDirection,
        stabilityClass: stability,
        notes: activePlumeCommand.summary,
      });
      const saveMode = savePlumeResult(activePlumeCommand, workflowRecord, await capturePlumeMapImage());
      renderIncidentCommandSnapshot();
      setText('plume-input-status', 'ERG protective-action guide displayed. Verify spill size, day/night condition, wind direction, current ERG, field observations, and Incident Command.');
      document.getElementById('plume-input-status')?.setAttribute('data-state', 'planning');
      setText('plume-mode-summary', saveMode === 'active-incident' ? 'Active Incident Mode' : 'Planning Mode');
      setText('selected-model-summary', 'ERG Overlay — Not a Plume Model');
      setText('plume-model-status-summary', 'ERG Protective Action Guide — Not a Modeled Plume');
      setText('plume-limitations-summary', erg.limitations.join(' · '));
      setText('plume-endpoint-summary', `PHMSA ERG 2024 Table 1 · UN ${erg.un} · Guide ${erg.guide} · ${erg.spillSize} spill · ${erg.period}`);
      setText('plume-zone-meaning-summary', 'Bright orange: ERG Initial Isolation / Protective Action guide area — not a toxic concentration zone');
      setText('plume-endpoint-status', modeled.result.endpointStatus);
      setText('plume-model-time-summary', new Date(workflowRecord.createdAt).toLocaleString());
      setText('plume-model-details-time', new Date(workflowRecord.createdAt).toLocaleString());
      setText('plume-result-summary', 'ERG protective-action overlay displayed. Verify with the current ERG, field observations, monitoring, and Incident Command.');
      if (resultsSection) resultsSection.hidden = false;
      setPlumeMapResultVisible(true);
      updatePlumeModeLabel();
      setText('plume-live-status', `ERG protective-action overlay displayed ${formatCentralZuluHtml()}.`);
      return;
    }

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
    const workflowRecord = buildPlumeWorkflowRecord({ location, inputs, modeled, command: activePlumeCommand });
    saveLatestPlumeOverlay({
      location,
      releaseType,
      windSpeed,
      windDirection,
      stabilityClass: stability,
      notes: activePlumeCommand.summary,
    });
    const saveMode = savePlumeResult(activePlumeCommand, workflowRecord, await capturePlumeMapImage());
    renderIncidentCommandSnapshot();
    setText('plume-input-status', '');
    document.getElementById('plume-input-status')?.removeAttribute('data-state');
    setText('plume-mode-summary', saveMode === 'active-incident' ? 'Active Incident Mode' : 'Planning Mode');
    setText('selected-model-summary', 'Planning Estimate');
    setText('plume-model-status-summary', workflowRecord.model.confidenceStatus);
    setText('plume-limitations-summary', (modeled.result.limitations || modeled.result.modelMetadata?.limitations || []).join(' · '));
    setText('plume-release-summary', `${releaseType} · ${releaseQuantity} ${releaseUnit} · ${controlValue('plume-container-type', { selectedLabel: true })}`);
    setText('plume-weather-input-summary', `${workflowRecord.weather.source} · ${windSpeed} mph from ${windDirection}° · stability ${stability}`);
    setText('plume-endpoint-summary', `EPA AEGL · ${modeled.result.endpoint.selectedDurationMinutes}-minute endpoint · AEGL-1 ${modeled.result.endpoint.aegl1} / AEGL-2 ${modeled.result.endpoint.aegl2} / AEGL-3 ${modeled.result.endpoint.aegl3} ${modeled.result.endpoint.units}`);
    setText('plume-zone-meaning-summary', 'Red: AEGL-3 · Orange: AEGL-2 · Yellow: AEGL-1');
    setText('plume-endpoint-status', `EPA final AEGL values linked by Chemical Companion master record and CAS ${modeled.result.endpoint.casNumber}.`);
    setText('plume-model-time-summary', new Date(workflowRecord.createdAt).toLocaleString());
    setText('plume-model-details-time', new Date(workflowRecord.createdAt).toLocaleString());
    setText('plume-result-summary', 'Planning plume plotted. Field monitoring and Incident Command verification are required.');
    if (resultsSection) resultsSection.hidden = false;
    setPlumeMapResultVisible(true);
    updatePlumeModeLabel();
    setText('plume-live-status', `Plume plotted ${formatCentralZuluHtml()}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The plume could not be plotted.';
    updatePlumeEvidenceStatus(null);
    showPlumeWorkflowMessage(message);
    updateOperationalPlumeReadiness(latestPlumeAvailability, null, message);
    setText('plume-overlay-status', message);
  } finally {
    if (plotButton) plotButton.disabled = false;
  }
}

async function refreshPlumeWorkspace({ requestGps = true } = {}) {
  const token = ++plumeRefreshToken;
  const status = document.getElementById('plume-live-status');
  if (status) status.textContent = 'Resolving incident location…';

  // Chemical restoration and the basemap must not depend on GPS permission.
  const chemicalReady = activeChemicalRecord ? Promise.resolve() : restoreSelectedChemical();
  void Promise.resolve().then(() => ensurePlumeMap()).catch((error) => {
    setText('plume-overlay-status', error instanceof Error ? error.message : 'The plume map is unavailable.');
  });

  const plumeAddressInput = document.getElementById('plume-map-address-input');
  const incidentAddress = getIncidentAddressValue();
  if (plumeAddressInput && !plumeAddressInput.value.trim() && incidentAddress) {
    plumeAddressInput.value = incidentAddress;
  }

  let location;
  try {
    location = await getIncidentCoordinates({ requestGps, allowPlumeManual: true });
  } catch (error) {
    if (token !== plumeRefreshToken) return;
    if (status) status.textContent = `${error.message} Enter an address or coordinates above to load local weather.`;
    setText('plume-location-source', 'Location required');
    return;
  }
  if (token !== plumeRefreshToken) return;
  if (!location) {
    if (status) status.textContent = 'Enter an address or coordinates above to load local weather.';
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

  // Map tiles and styles are visual support, not a prerequisite for weather.
  // Begin map initialization without allowing it to gate current conditions.
  const mapReadyPromise = Promise.resolve().then(() => ensurePlumeMap(location)).then(() => true).catch((error) => {
    setText('plume-overlay-status', error instanceof Error ? error.message : 'The plume map is unavailable.');
    return false;
  });
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

  renderNotificationWeather(openMeteo, nws);
  const weatherSourceMode = document.getElementById('plume-weather-source')?.value;
  const selectedLiveWeather = selectPlumeWeather(openMeteo, nws);
  const openMeteoFreshness = openMeteo ? getWeatherFreshness(openMeteo.observedAt) : null;
  latestPlumeWeather = weatherSourceMode === 'open-meteo'
    ? (openMeteo && !['Expired', 'Time Unknown'].includes(openMeteoFreshness.status)
      ? { ...openMeteo, ...openMeteoFreshness, source: 'Open-Meteo current conditions' }
      : null)
    : selectedLiveWeather;
  updateCommandWeatherState(openMeteo, nws, location);
  if (latestPlumeWeather && ['auto-live', 'open-meteo'].includes(weatherSourceMode)) {
    applyLiveWeatherToPlumeInputs(latestPlumeWeather);
    updatePlumeWeatherSourceStatus(latestPlumeWeather.source, latestPlumeWeather.observedAt || '');
    setText('plume-weather-prompt', `Current weather: ${latestPlumeWeather.source}.`);
  }
  else {
    const sourceSelect = document.getElementById('plume-weather-source');
    const manualTime = document.getElementById('plume-manual-observation-time');
    if (sourceSelect) sourceSelect.value = 'manual';
    if (manualTime) manualTime.value = new Date().toISOString();
    if (!document.getElementById('plume-temperature')?.value) setPlumeInputValue('plume-temperature', 68);
    updatePlumeWeatherSourceStatus('Manual Entry', new Date().toISOString(), 'Live weather unavailable — enter wind direction and wind speed.');
    setText('plume-weather-prompt', 'Live weather unavailable — enter wind direction and wind speed.');
    setText('plume-input-status', 'Live weather is unavailable. Enter wind direction and wind speed to continue.');
  }
  setText('backend-model-summary', 'Run plume model to view result.');
  await Promise.all([mapReadyPromise, chemicalReady]);
  if (token !== plumeRefreshToken) return;
  await clearThreatZones('Enter release information to calculate a Planning Plume.');
  if (token !== plumeRefreshToken) return;
  if (status) status.innerHTML = `Location and weather updated ${formatCentralZuluHtml()}.`;
  updatePlumeInputSummaries();
  scheduleAutomaticPlanningPlume();
}

let plumeAutomaticCalculationTimer = null;

function scheduleAutomaticPlanningPlume() {
  window.clearTimeout(plumeAutomaticCalculationTimer);
  if (!document.getElementById('plume')?.classList.contains('active')) return;
  if (getMissingPlumeRequiredInputs().length) return;
  plumeAutomaticCalculationTimer = window.setTimeout(() => {
    setText('plume-input-status', 'Release and weather inputs complete. Calculating Planning Plume…');
    void plotPlumeFromControls();
  }, 650);
}

let plumeNavigationContext = null;

function activeViewId() {
  return [...views].find((view) => view.classList.contains('active'))?.id || 'direct';
}

function normalizePlumeNavigationContext(input = {}) {
  const sourcePage = input.sourcePage || activeViewId();
  const activeIncident = input.incident || getActiveIncident();
  const planningState = readPlanningState();
  const savedPlume = planningState.plumeModelResults || {};
  const savedChemical = planningState.selectedChemical || savedPlume.chemical || null;
  const chemical = input.chemical || (activeIncident?.selectedChemicalId ? {
    id: activeIncident.selectedChemicalId,
    selectedChemicalId: activeIncident.selectedChemicalId,
    name: activeIncident.chemicalName,
  } : null) || activeChemical || savedChemical || null;
  const activeIncidentChemicalMatches = !activeIncident?.selectedChemicalId
    || String(activeChemical?.selectedChemicalId ?? activeChemical?.id ?? '') === String(activeIncident.selectedChemicalId);
  const record = input.chemicalRecord || (activeIncidentChemicalMatches ? activeChemicalRecord : null);
  const profileHeader = record?.profile?.header || activeIncident?.chemicalProfile?.header || {};
  const savedLocation = savedPlume.location || savedPlume.output?.mapCenter;
  const liveMapCenter = sourcePage === 'map' ? window.hazmatiqLiveMap?.getCenter?.() : null;
  const suppliedLocation = input.location || (sourcePage === 'plume' && plumeManualLocation ? {
    latitude: plumeManualLocation.lat,
    longitude: plumeManualLocation.lon,
    address: plumeManualLocation.address,
  } : null) || (
    Number.isFinite(Number(input.latitude)) && Number.isFinite(Number(input.longitude))
      ? { latitude: Number(input.latitude), longitude: Number(input.longitude), address: input.address }
      : null
  ) || (liveMapCenter ? { latitude: liveMapCenter.lat, longitude: liveMapCenter.lng } : null);
  const location = suppliedLocation || (activeIncident?.latitude !== '' && activeIncident?.longitude !== ''
    ? { latitude: Number(activeIncident.latitude), longitude: Number(activeIncident.longitude), address: activeIncident.address }
    : Array.isArray(savedLocation) && savedLocation.length >= 2
      ? { latitude: Number(savedLocation[1]), longitude: Number(savedLocation[0]) }
      : null);
  const releaseData = input.releaseData || {
    releaseKind: document.getElementById('plume-release-type')?.value || savedPlume.release?.releaseType,
    quantity: document.getElementById('plume-release-quantity')?.value || savedPlume.release?.quantity,
    durationMinutes: document.getElementById('plume-release-duration')?.value,
    puffDurationSeconds: document.getElementById('plume-puff-duration')?.value,
    releaseHeightFt: document.getElementById('plume-release-height')?.value,
  };
  const weatherData = input.weatherData || {
    source: document.getElementById('plume-weather-source')?.value || savedPlume.weather?.source,
    windSpeedMph: document.getElementById('plume-wind-speed')?.value || activeIncident?.windSpeed || savedPlume.weather?.windSpeed,
    windDirectionDeg: document.getElementById('plume-wind-direction')?.value || activeIncident?.windDirection || savedPlume.weather?.windDirection,
    temperatureF: document.getElementById('plume-temperature')?.value || savedPlume.weather?.temperature,
    stabilityClass: document.getElementById('plume-stability-class')?.value || savedPlume.weather?.stabilityClass,
    surfaceRoughness: document.getElementById('plume-surface-roughness')?.value,
    observationTime: activeIncident?.weatherObservationTime || savedPlume.weather?.observationTime,
  };
  return {
    chemicalId: input.chemicalId ?? chemical?.selectedChemicalId ?? chemical?.id ?? activeIncident?.selectedChemicalId ?? null,
    chemicalName: input.chemicalName ?? chemical?.name ?? activeIncident?.chemicalName ?? savedPlume.chemical?.chemicalName ?? '',
    cas: input.cas ?? profileHeader.cas ?? activeIncident?.casNumber ?? savedPlume.chemical?.casNumber ?? '',
    un: input.un ?? profileHeader.un ?? activeIncident?.unNumber ?? savedPlume.chemical?.unNumber ?? '',
    ergGuide: input.ergGuide ?? profileHeader.ergGuide ?? activeIncident?.ergGuide ?? savedPlume.chemical?.ergGuide ?? '',
    incidentId: input.incidentId ?? activeIncident?.incidentId ?? savedPlume.incidentId ?? null,
    incidentName: input.incidentName ?? activeIncident?.incidentName ?? savedPlume.incidentName ?? '',
    latitude: location?.latitude ?? location?.lat ?? null,
    longitude: location?.longitude ?? location?.lon ?? location?.lng ?? null,
    address: location?.address || activeIncident?.address || '',
    releaseData,
    weatherData,
    sourcePage,
  };
}

function applyPlumeNavigationContext(context) {
  const chemicalId = normalizeChemicalSelectionId(context.chemicalId);
  const activeId = normalizeChemicalSelectionId(activeChemical?.selectedChemicalId ?? activeChemical?.id);
  if (chemicalId !== null && chemicalId !== undefined && chemicalId !== '' && String(activeId ?? '') !== String(chemicalId)) {
    setActiveChemical({
      id: String(chemicalId),
      selectedChemicalId: chemicalId,
      name: context.chemicalName || 'Selected chemical',
      cas: context.cas,
      un: context.un,
      ergGuide: context.ergGuide,
    }, { persist: false, clearOverlay: false });
  }
  if (context.latitude !== null && context.longitude !== null) {
    const coordinateText = `${Number(context.latitude).toFixed(6)}, ${Number(context.longitude).toFixed(6)}`;
    const incidentCoordinates = document.getElementById('incident-coordinates-input');
    if (incidentCoordinates && !incidentCoordinates.value.trim()) incidentCoordinates.value = coordinateText;
    const plumeAddress = document.getElementById('plume-map-address-input');
    if (plumeAddress && !plumeAddress.value.trim()) plumeAddress.value = context.address || coordinateText;
    plumeManualLocation = {
      lat: Number(context.latitude),
      lon: Number(context.longitude),
      address: context.address || undefined,
      source: context.sourcePage === 'map' ? 'Live Map context' : 'Navigation context',
    };
  } else if (context.sourcePage !== 'plume') plumeManualLocation = null;
  const setControl = (id, value) => {
    const control = document.getElementById(id);
    if (control && value !== undefined && value !== null && value !== '') control.value = String(value);
  };
  const release = context.releaseData || {};
  const kind = ['plume', 'puff'].includes(release.releaseKind) ? release.releaseKind : '';
  if (kind) setControl('plume-release-type', kind);
  setControl('plume-release-quantity', release.quantity);
  setControl('plume-release-duration', release.durationMinutes);
  setControl('plume-puff-duration', release.puffDurationSeconds);
  setControl('plume-release-height', release.releaseHeightFt);
  updatePlumeReleaseQuantityLabel();

  const weather = context.weatherData || {};
  if (['auto-live', 'open-meteo', 'columbia-live', 'columbia-csv', 'manual'].includes(weather.source)) {
    setControl('plume-weather-source', weather.source);
  }
  setControl('plume-wind-speed', weather.windSpeedMph ?? weather.windSpeed);
  setControl('plume-wind-direction', weather.windDirectionDeg ?? weather.windDirection);
  setControl('plume-temperature', weather.temperatureF ?? weather.temperature);
  setControl('plume-stability-class', weather.stabilityClass);
  setControl('plume-surface-roughness', weather.surfaceRoughness);
  setControl('plume-manual-observation-time', weather.observationTime);
  syncPlumeChemicalSelection();
  updatePlumeInputSummaries();
  updateOperationalPlumeReadiness();
}

function openPlumeModel(context = {}) {
  const normalized = normalizePlumeNavigationContext(context);
  plumeNavigationContext = normalized;
  window.HazMatIQ ||= {};
  window.HazMatIQ.plumeNavigationContext = normalized;
  // This is the only page owner for plume navigation. The skip flag prevents
  // showView from routing back through this initializer.
  showView('plume', { skipPlumeInitialization: true });
  applyPlumeNavigationContext(normalized);
  window.requestAnimationFrame(() => void refreshPlumeWorkspace({ requestGps: true }));
  return normalized;
}

function openPlumeWorkspace(context = {}) {
  return openPlumeModel({
    sourcePage: context.sourcePage || activeViewId(),
    chemical: context.chemical || activeChemical,
    chemicalRecord: context.chemicalRecord || activeChemicalRecord,
    ...context,
  });
}

let guidedResponseOpenRequest = 0;

async function ensureGuidedResponseChemicalSelection(requestId) {
  const activeIncident = getActiveIncident();
  const targetId = activeIncident?.selectedChemicalId
    ?? activeChemical?.selectedChemicalId
    ?? activeChemical?.id
    ?? null;
  if (targetId === null || targetId === undefined || targetId === '') return;

  const targetName = activeIncident?.chemicalName || activeChemical?.name || '';
  const activeId = activeChemical?.selectedChemicalId ?? activeChemical?.id ?? null;
  const loadedName = activeChemicalRecord?.profile?.header?.name || activeChemicalRecord?.name || '';
  const selectionIsLoaded = String(activeId ?? '') === String(targetId)
    && Boolean(activeChemicalRecord?.profile)
    && (!targetName || !loadedName || loadedName === targetName);
  if (selectionIsLoaded) return;

  const container = document.getElementById('guided-response-content');
  if (container) {
    const loading = document.createElement('article');
    loading.className = 'panel-card guided-response-empty';
    loading.textContent = `Loading Guided Response for ${targetName || 'the selected chemical'}…`;
    container.replaceChildren(loading);
  }

  try {
    const chemical = await fetchJson(`/api/chemicals/${encodeURIComponent(targetId)}`);
    if (requestId !== guidedResponseOpenRequest || chemical?.error) throw new Error('Chemical record unavailable');
    setActiveChemical(chemical, { persist: false, clearOverlay: false });
    const record = await buildFullChemicalRecord(chemical);
    const profileResponse = await fetchJson(`/api/chemicals/${encodeURIComponent(targetId)}/profile`);
    if (requestId !== guidedResponseOpenRequest) return;
    const profile = profileResponse && !profileResponse.error ? profileResponse : null;
    activeChemicalRecord = profile
      ? { ...record, profile: { ...profile, activeTab: 'overview' }, name: record.name }
      : record;
  } catch {
    if (requestId !== guidedResponseOpenRequest || !activeIncident?.chemicalProfile) return;
    setActiveChemical({
      id: targetId,
      selectedChemicalId: targetId,
      name: targetName || activeIncident.chemicalProfile.header?.name,
    }, { persist: false, clearOverlay: false });
    activeChemicalRecord = {
      id: String(targetId),
      selectedChemicalId: targetId,
      name: targetName || activeIncident.chemicalProfile.header?.name,
      profile: activeIncident.chemicalProfile,
      summarySources: activeIncident.chemicalSources || [],
    };
  }
}

async function openGuidedResponseWorkspace() {
  const requestId = ++guidedResponseOpenRequest;
  showView('guided-response');
  await ensureGuidedResponseChemicalSelection(requestId);
  if (requestId === guidedResponseOpenRequest && document.getElementById('guided-response')?.classList.contains('active')) {
    renderGuidedResponse();
  }
}

function saveGuidedResponseTacticalRecord({ attachToIncident = false } = {}) {
  const current = window.HazMatIQ?.guidedResponseDecisionRecord;
  if (!current) return { saved: false, attached: false };
  let prior = null;
  try {
    prior = JSON.parse(window.localStorage.getItem(guidedResponseTacticalStorageKey) || 'null');
  } catch {
    prior = null;
  }
  const savedAt = new Date().toISOString();
  const activeIncident = getActiveIncident();
  const record = {
    ...current,
    mode: activeIncident ? 'active-incident' : 'planning',
    incidentId: activeIncident?.incidentId || null,
    createdAt: prior?.id === current.id && prior.createdAt ? prior.createdAt : current.createdAt,
    updatedAt: savedAt,
  };
  window.localStorage.setItem(guidedResponseTacticalStorageKey, JSON.stringify(record));
  window.HazMatIQ.guidedResponseDecisionRecord = record;
  if (!attachToIncident || !activeIncident) return { saved: true, attached: false };

  updateActiveIncidentRecord();
  const incidents = readIncidents();
  const incidentIndex = incidents.findIndex((incident) => incident.incidentId === activeIncident.incidentId);
  if (incidentIndex < 0) return { saved: true, attached: false };
  incidents[incidentIndex] = {
    ...incidents[incidentIndex],
    guidedResponseTacticalRecord: record,
    updatedAt: savedAt,
  };
  writeIncidents(incidents);
  renderIncidentLists();
  return { saved: true, attached: true };
}

document.getElementById('open-plume-btn')?.addEventListener('click', openPlumeWorkspace);
document.getElementById('open-guided-response-btn')?.addEventListener('click', openGuidedResponseWorkspace);
document.getElementById('guided-open-plume-btn')?.addEventListener('click', openPlumeWorkspace);
document.getElementById('guided-back-btn')?.addEventListener('click', () => showView('lookup'));
document.getElementById('guided-save-record-btn')?.addEventListener('click', () => {
  const status = document.getElementById('guided-response-action-status');
  const result = saveGuidedResponseTacticalRecord();
  if (status) status.textContent = !result.saved
    ? 'No tactical decision record is available to save.'
    : hasActiveIncident()
      ? 'Tactical decision record saved locally. Use Save to Incident to attach it to the active incident.'
      : 'Planning Mode — tactical decision record saved locally, not attached to an incident.';
});
document.getElementById('guided-save-chemical-btn')?.addEventListener('click', () => {
  saveCurrentChemical();
  const status = document.getElementById('guided-response-action-status');
  if (status) status.textContent = activeChemical ? `${activeChemical.name} added to My Chemicals.` : 'No chemical selected.';
});
document.getElementById('guided-save-incident-btn')?.addEventListener('click', () => {
  const status = document.getElementById('guided-response-action-status');
  if (!hasActiveIncident()) {
    if (status) status.textContent = 'Start or select an active incident to save this guided response.';
    return;
  }
  const result = saveGuidedResponseTacticalRecord({ attachToIncident: true });
  if (status) status.textContent = result.attached
    ? 'Active Incident Mode — tactical decision record saved to this incident.'
    : 'The tactical decision record could not be attached to the active incident.';
});
document.querySelectorAll('[data-command-view]').forEach((button) => {
  // Dashboard controls use its delegated handler, including dynamically rendered actions.
  if (incidentCommandDashboard?.contains(button)) return;
  button.addEventListener('click', () => {
    const target = button.dataset.commandView;
    if (target === 'plume') openPlumeWorkspace({ sourcePage: activeViewId() });
    else if (target === 'guided-response') void openGuidedResponseWorkspace();
    else if (target) showView(target);
  });
});

document.getElementById('refresh-plume-data-btn')?.addEventListener('click', () => refreshPlumeWorkspace({ requestGps: true }));
document.getElementById('refresh-command-weather-btn')?.addEventListener('click', () => refreshCommandWeather({ requestGps: true }));
document.getElementById('change-plume-chemical-btn')?.addEventListener('click', () => {
  showView('lookup');
  chemicalSearchInput?.focus();
  chemicalSearchInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Direct URL aliases open the unified workspace without changing the existing
// in-page view identifiers or Chemical Companion navigation state.
if (/^\/(?:hazard-id|chemical-id)\/?$/i.test(window.location.pathname)) {
  showView('lookup');
}
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
  const source = document.getElementById('plume-weather-source')?.value;
  if (source === 'columbia-live') {
    updatePlumeWeatherSourceStatus('Columbia Weather Station', '', 'Live station connection not configured yet.');
    return;
  }
  if (source === 'columbia-csv' || source === 'manual') return;
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
document.getElementById('plume-weather-source')?.addEventListener('change', (event) => {
  const source = event.target.value;
  document.querySelectorAll('.plume-columbia-csv').forEach((field) => {
    field.hidden = source !== 'columbia-csv';
  });
  document.querySelectorAll('.plume-manual-weather').forEach((field) => {
    field.hidden = source !== 'manual';
  });
  if (source === 'columbia-live') {
    updatePlumeWeatherSourceStatus('Columbia Weather Station', '', 'Columbia Weather Station selected. Live station connection not configured yet.');
  } else if (source === 'columbia-csv') {
    updatePlumeWeatherSourceStatus('Columbia CSV Import', '', 'Time unknown');
  } else if (source === 'manual') {
    const manualTime = new Date().toISOString();
    const manualTimeInput = document.getElementById('plume-manual-observation-time');
    if (manualTimeInput) manualTimeInput.value = manualTime;
    updatePlumeWeatherSourceStatus('Manual Entry', manualTime, 'Manual Weather Entry — verify before operational use.');
    setText('plume-weather-prompt', 'Manual weather — enter wind direction and wind speed.');
  } else if (source === 'auto-live') {
    updatePlumeWeatherSourceStatus(latestPlumeWeather?.source || 'Best Current Live Source', latestPlumeWeather?.observedAt || '');
  } else {
    updatePlumeWeatherSourceStatus('Open-Meteo', latestPlumeWeather?.source?.includes('Open-Meteo') ? latestPlumeWeather.observedAt : '');
  }
});
document.getElementById('plume-manual-observation-time')?.addEventListener('change', (event) => {
  const value = event.target.value;
  updatePlumeWeatherSourceStatus('Manual Entry', value ? new Date(value).toISOString() : '', 'Manual Weather Entry — verify before operational use.');
});
document.getElementById('plume-columbia-csv')?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const weather = parseColumbiaWeatherCsv(await file.text());
    applyColumbiaWeatherToPlumeInputs(weather);
  } catch {
    updatePlumeWeatherSourceStatus('Columbia CSV Import', '', 'Time unknown');
  }
});
document.getElementById('plume-model-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await plotPlumeFromControls();
});
document.getElementById('plume-model-form')?.addEventListener('input', () => {
  updatePlumeInputSummaries();
  updateOperationalPlumeReadiness();
});
document.getElementById('plume-model-form')?.addEventListener('input', scheduleAutomaticPlanningPlume);
document.getElementById('plume-model-form')?.addEventListener('change', () => {
  updatePlumeInputSummaries();
  updateOperationalPlumeReadiness();
  scheduleAutomaticPlanningPlume();
});
updatePlumeReleaseQuantityLabel();
applyChemicalContainerProfile();
updatePlumeInputSummaries();
window.setInterval(() => {
  if (document.getElementById('incident')?.classList.contains('active')) {
    void refreshCommandWeather({ requestGps: false });
  }
}, 5 * 60 * 1000);
document.querySelectorAll('[data-plume-map-view]').forEach((button) => {
  button.addEventListener('click', () => setPlumeMapView(button.dataset.plumeMapView));
});
document.getElementById('plume-buildings-toggle')?.addEventListener('click', toggleConfiguredPlumeBuildings);
document.getElementById('plume-reset-view-btn')?.addEventListener('click', resetPlumeMapView);
document.querySelectorAll('[data-plume-camera]').forEach((button) => {
  button.addEventListener('click', () => {
    const actions = {
      'rotate-left': () => rotatePlumeMap(-15),
      'rotate-right': () => rotatePlumeMap(15),
      'tilt-up': () => tiltPlumeMap(10),
      'tilt-down': () => tiltPlumeMap(-10),
      'reset-north': resetPlumeMapNorth,
    };
    actions[button.dataset.plumeCamera]?.();
  });
});
document.getElementById('plume-map-address-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  void useManualPlumeAddress();
});
document.getElementById('use-plume-incident-location-btn')?.addEventListener('click', () => {
  void useIncidentPlumeLocation();
});
document.getElementById('plume-map-address-input')?.addEventListener('input', () => {
  plumeManualLocation = null;
  setText('plume-map-address-status', '');
});
document.querySelectorAll('[data-plume-layer]').forEach((button) => {
  button.addEventListener('click', async () => {
    const layerName = button.dataset.plumeLayer;
    if (plumeLayerState[layerName]) {
      plumeLayerState[layerName] = false;
      setPlumeLayerVisibility(layerName, false);
      if (layerName === 'distance') clearPlumePointMeasurement();
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
      if (layerName === 'distance') setText('plume-layers-status', 'Click anywhere on the map to measure from the red release pin.');
      else if (layerName !== 'hazards') setText('plume-layers-status', '');
    } catch {
      plumeLayerState[layerName] = false;
      setText('plume-layers-status', layerName === 'hazards'
        ? 'Hazards unavailable until plume bounds or release point are available.'
        : '');
    }
  });
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
    if (status) status.textContent = 'GPS found. Looking up the street address…';
    let addressFound = false;
    try {
      addressFound = await reverseGeocodeIncidentGps(gps);
    } catch {
      // GPS remains usable when reverse geocoding is unavailable.
    }
    await setTacticalClockTimeZoneFromCoordinates(gps);
    await refreshNotificationWeather(gps);
    await refreshCommandWeather({ requestGps: false });
    updateActiveIncidentRecord();
    if (status) status.textContent = addressFound
      ? `Current GPS and address saved: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}.`
      : `Current GPS saved: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}. Address was not available.`;
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

const liveMapStorageKey = 'hazmatiq_live_map_state';
const latestPlumeOverlayStorageKey = 'hazmatiq_latest_plume_overlay';
let liveMap = null;
let liveMapState = null;
let liveMapMarkers = [];
let liveMapGpsRequested = false;
// Vector street style includes roads, buildings, parks, schools, hospitals, and POIs.
const liveMapDetailedStyleUrl = 'https://tiles.openfreemap.org/styles/liberty';
let liveRadarController = null;
const livePlumeSourceId = 'live-plume-overlay';
const livePlumeFillLayerId = 'live-plume-overlay-fill';
const livePlumeOutlineLayerId = 'live-plume-overlay-outline';

function defaultLiveMapState() {
  return {
    incidentId: null,
    mapCenter: [-86.81, 33.29],
    zoom: 14,
    activeLayers: { zones: false, icp: false, entry: false, decon: false, monitors: false, staging: false, medical: false, traffic: false, trafficCams: false, weatherRadar: false, plume: false },
    markers: [],
    zones: [],
    monitors: [],
    lastUpdated: null,
  };
}

function readLiveMapState() {
  try {
    const defaults = defaultLiveMapState();
    const saved = JSON.parse(window.localStorage.getItem(liveMapStorageKey) || '{}');
    return { ...defaults, ...saved, activeLayers: { ...defaults.activeLayers, ...saved.activeLayers } };
  } catch {
    return defaultLiveMapState();
  }
}

function saveLiveMapState(message = 'Map saved on this device.') {
  if (!liveMapState) return;
  if (liveMap) {
    const center = liveMap.getCenter();
    liveMapState.mapCenter = [center.lng, center.lat];
    liveMapState.zoom = liveMap.getZoom();
  }
  liveMapState.lastUpdated = new Date().toISOString();
  window.localStorage.setItem(liveMapStorageKey, JSON.stringify(liveMapState));
  setText('live-map-status', message);
}

function updateLiveMapPanels() {
  document.querySelectorAll('[data-live-layer]').forEach((button) => {
    const active = Boolean(liveMapState?.activeLayers?.[button.dataset.liveLayer]);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-live-panel]').forEach((panel) => {
    panel.hidden = !liveMapState?.activeLayers?.[panel.dataset.livePanel];
  });
}

function selectLiveMapMarker(marker) {
  const panel = document.getElementById('live-map-selected');
  if (!panel) return;
  panel.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = marker.name || marker.type;
  const details = document.createElement('span');
  details.textContent = `${marker.type} · ${Number(marker.lat).toFixed(5)}, ${Number(marker.lng).toFixed(5)}${marker.reading ? ` · ${marker.reading} ${marker.unit || ''}` : ''}`;
  panel.append(title, details);
  panel.hidden = false;
}

function getLiveMarkerLayer(marker) {
  return marker.type === 'Medical / Rehab' ? 'medical' : marker.layer;
}

function ensureLiveLayerMarker(layer) {
  const markerTypes = {
    icp: 'ICP / Command Post',
    entry: 'Entry Team',
    decon: 'Decon Corridor',
    monitors: 'Monitor',
    staging: 'Staging',
    medical: 'Medical / Rehab',
    trafficCams: 'Traffic Camera',
  };
  const type = markerTypes[layer];
  if (!type || !liveMap || !liveMapState) return;
  const allMarkers = [...liveMapState.markers, ...liveMapState.monitors];
  if (allMarkers.some((marker) => getLiveMarkerLayer(marker) === layer)) return;
  const center = liveMap.getCenter();
  const marker = {
    id: `marker-${Date.now()}`,
    type,
    name: type,
    lat: center.lat,
    lng: center.lng,
    layer,
    status: 'Active',
    notes: '',
    timestamp: new Date().toISOString(),
  };
  (layer === 'monitors' ? liveMapState.monitors : liveMapState.markers).push(marker);
}

function renderLiveMapMarkers() {
  liveMapMarkers.forEach((marker) => marker.remove());
  liveMapMarkers = [];
  if (!liveMap || !liveMapState) return;
  [...liveMapState.markers, ...liveMapState.monitors].forEach((marker) => {
    const layer = getLiveMarkerLayer(marker);
    if (!liveMapState.activeLayers[layer]) return;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'live-map-marker';
    element.dataset.layer = layer;
    element.textContent = layer === 'trafficCams' ? '📷' : layer === 'medical' ? '+' : layer === 'monitors' ? 'M' : marker.type.charAt(0);
    element.title = marker.name;
    element.addEventListener('click', () => selectLiveMapMarker(marker));
    const mapMarker = new window.maplibregl.Marker({ element, draggable: true })
      .setLngLat([marker.lng, marker.lat])
      .addTo(liveMap);
    mapMarker.on('dragend', () => {
      const position = mapMarker.getLngLat();
      marker.lng = position.lng;
      marker.lat = position.lat;
      saveLiveMapState(`${marker.name || marker.type} moved.`);
    });
    liveMapMarkers.push(mapMarker);
  });
}

function readLatestPlumeOverlay() {
  if (window.HazMatIQ.latestPlumeOverlay?.plumeGeometry?.features?.length) {
    return window.HazMatIQ.latestPlumeOverlay;
  }
  try {
    const overlay = JSON.parse(window.localStorage.getItem(latestPlumeOverlayStorageKey) || 'null');
    if (overlay?.plumeGeometry?.features?.length) window.HazMatIQ.latestPlumeOverlay = overlay;
    return overlay;
  } catch {
    return null;
  }
}

function updateLivePlumeOverlay() {
  if (!liveMap?.isStyleLoaded()) return;
  const enabled = Boolean(liveMapState?.activeLayers?.plume);
  if (!enabled) {
    if (liveMap.getLayer(livePlumeOutlineLayerId)) liveMap.removeLayer(livePlumeOutlineLayerId);
    if (liveMap.getLayer(livePlumeFillLayerId)) liveMap.removeLayer(livePlumeFillLayerId);
    if (liveMap.getSource(livePlumeSourceId)) liveMap.removeSource(livePlumeSourceId);
    setText('live-plume-status', 'Plume Overlay Active');
    return;
  }
  const overlay = readLatestPlumeOverlay();
  if (!overlay?.plumeGeometry?.features?.length) {
    setText('live-plume-status', 'Create a plume on the Plume Model page first.');
    return;
  }
  setText('live-plume-status', 'Plume Overlay Active');
  if (liveMap.getSource(livePlumeSourceId)) {
    liveMap.getSource(livePlumeSourceId).setData(overlay.plumeGeometry);
    return;
  }
  liveMap.addSource(livePlumeSourceId, { type: 'geojson', data: overlay.plumeGeometry });
  const firstSymbolLayer = liveMap.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
  liveMap.addLayer({
    id: livePlumeFillLayerId,
    type: 'fill',
    source: livePlumeSourceId,
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], '#d71920'],
      'fill-opacity': 0.2,
    },
  }, firstSymbolLayer);
  liveMap.addLayer({
    id: livePlumeOutlineLayerId,
    type: 'line',
    source: livePlumeSourceId,
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#d71920'],
      'line-width': 3,
      'line-opacity': 0.9,
    },
  }, firstSymbolLayer);
  liveRadarController?.reorder();
}

window.addEventListener('hazmatiq:plume-updated', (event) => {
  if (event.detail?.plumeGeometry?.features?.length) window.HazMatIQ.latestPlumeOverlay = event.detail;
  if (liveMapState?.activeLayers?.plume) updateLivePlumeOverlay();
});

function removeLiveRadarOverlay() {
  liveRadarController?.disable();
  document.querySelector('.live-map-stage')?.classList.remove('radar-enhanced');
}

function updateLiveRadarOverlay() {
  if (!liveMap?.isStyleLoaded()) return;
  const enabled = Boolean(liveMapState?.activeLayers?.weatherRadar);
  if (!enabled) {
    removeLiveRadarOverlay();
    return;
  }
  document.querySelector('.live-map-stage')?.classList.add('radar-enhanced');
  if (!window.HazMatWeatherRadar) {
    setText('live-map-status', 'Weather radar is unavailable.');
    return;
  }
  liveRadarController ||= window.HazMatWeatherRadar.createController(liveMap, {
    prefix: 'live-weather-radar',
    beforeLayerId: livePlumeFillLayerId,
    providerId: 'BEST_AVAILABLE',
    onAvailability: (_, provider) => setText('live-map-status', `${provider.displayName} active.`),
    onFallback: () => setText('live-map-status', 'Primary radar unavailable. NOAA/NWS fallback active.'),
  });
  liveRadarController.setOpacity(0.58);
  void liveRadarController.enable();
}

function initializeLiveMap() {
  if (!window.maplibregl) {
    setText('live-map-loading', 'Map library unavailable. Refresh the page and try again.');
    setText('live-map-status', 'The local MapLibre library did not load.');
    return;
  }
  if (!liveMap && window.hazmatiqLiveMap) liveMap = window.hazmatiqLiveMap;
  const incident = getActiveIncident();
  setText('live-map-incident-name', incident?.incidentName || 'Planning Map');
  setText('live-map-mode', incident ? 'Active Incident' : 'Planning Mode');
  if (!liveMapState) liveMapState = readLiveMapState();
  liveMapState.incidentId = incident?.incidentId || null;
  if (!liveMap) {
    const container = document.getElementById('live-gis-map');
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
      if (document.getElementById('map')?.classList.contains('active')) window.setTimeout(initializeLiveMap, 50);
      return;
    }
    try {
      liveMap = new window.maplibregl.Map({
        container: 'live-gis-map',
        center: liveMapState.mapCenter,
        zoom: liveMapState.zoom,
        style: liveMapDetailedStyleUrl,
        preserveDrawingBuffer: true,
      });
      window.hazmatiqLiveMap = liveMap;
    } catch (error) {
      setText('live-map-status', `Map could not initialize: ${error.message}`);
      return;
    }
    liveMap.addControl(new window.maplibregl.NavigationControl(), 'bottom-right');
    liveMap.on('style.load', () => {
      updateLiveRadarOverlay();
      updateLivePlumeOverlay();
      renderLiveMapMarkers();
      document.querySelector('.live-map-stage')?.classList.add('map-ready');
      setText('live-map-status', 'Street map ready.');
    });
    liveMap.on('idle', () => document.querySelector('.live-map-stage')?.classList.add('map-ready'));
    liveMap.on('load', () => {
      document.querySelector('.live-map-stage')?.classList.add('map-ready');
      setText('live-map-status', 'Live Map ready.');
    });
    liveMap.on('error', (event) => {
      if (liveRadarController?.ownsSource(event?.sourceId)) {
        setText('live-map-status', 'Radar tile failed. Switching to NOAA/NWS fallback.');
        if (liveRadarController.getState().activeProvider?.id !== window.HazMatRadarProviders?.IDS?.NOAA) {
          void liveRadarController.fallback();
        }
        return;
      }
      const message = event?.error?.message || 'Basemap could not load.';
      setText('live-map-loading', `Map error: ${message}`);
      setText('live-map-status', `${message} Try the other map view.`);
    });
  }
  ['icp', 'entry', 'decon', 'monitors', 'staging', 'medical', 'trafficCams'].forEach((layer) => {
    if (liveMapState.activeLayers[layer]) ensureLiveLayerMarker(layer);
  });
  updateLiveMapPanels();
  updateLivePlumeOverlay();
  renderLiveMapMarkers();
  window.requestAnimationFrame(() => liveMap.resize());
  window.setTimeout(() => liveMap.resize(), 150);
  if (!liveMapGpsRequested) {
    liveMapGpsRequested = true;
    setText('live-map-status', 'Locating current GPS position…');
    getCurrentGps().then((gps) => {
      liveMap.jumpTo({ center: [gps.lon, gps.lat], zoom: Math.max(liveMap.getZoom(), 15) });
      saveLiveMapState(`Map centered on current GPS: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}.`);
      void fetchWeatherSources(gps.lat, gps.lon).then(({ openMeteo, nws }) => {
        latestPlumeWeather = selectPlumeWeather(openMeteo, nws);
      }).catch(() => {});
    }).catch((error) => {
      setText('live-map-status', `${error.message} Showing the saved map location.`);
    });
  }
}

const liveMapViewElement = document.getElementById('map');
if (liveMapViewElement) {
  new MutationObserver(() => {
    if (liveMapViewElement.classList.contains('active')) window.requestAnimationFrame(initializeLiveMap);
  }).observe(liveMapViewElement, { attributes: true, attributeFilter: ['class'] });
}

document.querySelectorAll('[data-live-layer]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!liveMap && window.hazmatiqLiveMap) liveMap = window.hazmatiqLiveMap;
    if (!liveMapState) liveMapState = readLiveMapState();
    const layer = button.dataset.liveLayer;
    liveMapState.activeLayers[layer] = !liveMapState.activeLayers[layer];
    if (liveMapState.activeLayers[layer]) ensureLiveLayerMarker(layer);
    updateLiveMapPanels();
    if (layer === 'weatherRadar') updateLiveRadarOverlay();
    if (layer === 'plume') updateLivePlumeOverlay();
    renderLiveMapMarkers();
    saveLiveMapState(`${button.textContent} layer ${liveMapState.activeLayers[layer] ? 'shown' : 'hidden'}.`);
  });
});

document.getElementById('live-map-add-marker')?.addEventListener('click', () => {
  const dialog = document.getElementById('live-map-marker-dialog');
  const center = liveMap?.getCenter();
  if (center) {
    document.getElementById('live-marker-lat').value = center.lat.toFixed(6);
    document.getElementById('live-marker-lng').value = center.lng.toFixed(6);
  }
  dialog?.showModal();
});

document.getElementById('live-marker-type')?.addEventListener('change', (event) => {
  const layer = event.target.selectedOptions[0]?.dataset.layer;
  document.getElementById('live-monitor-fields').hidden = layer !== 'monitors';
});

// CSS-only rail and panel changes can alter a map container without a window resize.
// Resize rendering canvases only; plume sources, calculations, and geometry are untouched.
const operationalWorkspace = document.querySelector('.content-area');
if (operationalWorkspace && window.ResizeObserver) {
  new ResizeObserver(() => {
    window.requestAnimationFrame(() => {
      plumeMap?.resize();
      liveMap?.resize();
    });
  }).observe(operationalWorkspace);
}

document.querySelectorAll('[data-command-reference]').forEach((panel) => {
  panel.addEventListener('toggle', () => {
    if (!panel.open) return;
    document.querySelectorAll('[data-command-reference][open]').forEach((otherPanel) => {
      if (otherPanel !== panel) otherPanel.open = false;
    });
  });
});

document.getElementById('live-marker-cancel')?.addEventListener('click', () => {
  document.getElementById('live-map-marker-dialog')?.close();
});

document.getElementById('live-map-marker-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const typeSelect = document.getElementById('live-marker-type');
  const layer = typeSelect.selectedOptions[0]?.dataset.layer || 'staging';
  const marker = {
    id: `marker-${Date.now()}`,
    type: typeSelect.value,
    name: document.getElementById('live-marker-name').value.trim(),
    lat: Number(document.getElementById('live-marker-lat').value),
    lng: Number(document.getElementById('live-marker-lng').value),
    layer,
    status: layer === 'monitors' ? document.getElementById('live-monitor-status').value.trim() : 'Active',
    notes: document.getElementById('live-marker-notes').value.trim(),
    timestamp: layer === 'monitors' ? document.getElementById('live-monitor-time').value : new Date().toISOString(),
  };
  if (layer === 'monitors') {
    marker.monitorType = document.getElementById('live-monitor-type').value.trim();
    marker.reading = document.getElementById('live-monitor-reading').value.trim();
    marker.unit = document.getElementById('live-monitor-unit').value.trim();
    liveMapState.monitors.push(marker);
  } else {
    liveMapState.markers.push(marker);
  }
  liveMapState.activeLayers[layer] = true;
  renderLiveMapMarkers();
  updateLiveMapPanels();
  saveLiveMapState(`${marker.name} added to the map.`);
  event.target.reset();
  document.getElementById('live-monitor-fields').hidden = true;
  document.getElementById('live-map-marker-dialog').close();
});

document.getElementById('live-map-save')?.addEventListener('click', () => saveLiveMapState());
document.getElementById('live-map-clear')?.addEventListener('click', () => {
  if (!window.confirm('Clear all locally saved Live Map markers and layer settings?')) return;
  window.localStorage.removeItem(liveMapStorageKey);
  liveMapState = defaultLiveMapState();
  renderLiveMapMarkers();
  updateLiveMapPanels();
  setText('live-map-status', 'Live Map draft cleared.');
});

renderTier2Facilities();

// Monitoring Equipment Phase 1 uses local sample data only. It does not start an integration connection.
const monitorSampleReadings = [
  {
    id: 'sample-entry-1', deviceId: 'sample-arae-01', deviceName: 'AreaRAE Entry Team 1',
    manufacturer: 'RAE Systems', model: 'AreaRAE Pro', assignedTo: 'Entry Team 1', team: 'Entry Team 1',
    location: 'Hot Zone Entry', status: 'Online', alarmState: 'No Alarm', battery: 92, signal: 88,
    latitude: null, longitude: null, lastUpdate: null, source: 'Simulated', sourceMode: 'sample', notes: 'Training sample',
    sensors: [
      { gas: 'O2', value: 20.9, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'LEL', value: 0, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'CO', value: 1, unit: 'ppm', status: 'normal', alarmLevel: null },
      { gas: 'H2S', value: 0, unit: 'ppm', status: 'normal', alarmLevel: null },
      { gas: 'VOC / PID', value: 0.2, unit: 'ppm', status: 'normal', alarmLevel: null },
    ],
  },
  {
    id: 'sample-entry-2', deviceId: 'sample-arae-02', deviceName: 'AreaRAE Entry Team 2',
    manufacturer: 'RAE Systems', model: 'AreaRAE Pro', assignedTo: 'Entry Team 2', team: 'Entry Team 2',
    location: 'Backup Line', status: 'Online', alarmState: 'No Alarm', battery: 86, signal: 81,
    latitude: null, longitude: null, lastUpdate: null, source: 'Simulated', sourceMode: 'sample', notes: 'Training sample',
    sensors: [
      { gas: 'O2', value: 20.8, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'LEL', value: 0, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'CO', value: 2, unit: 'ppm', status: 'normal', alarmLevel: null },
      { gas: 'H2S', value: 0, unit: 'ppm', status: 'normal', alarmLevel: null },
      { gas: 'NH3', value: 0.1, unit: 'ppm', status: 'normal', alarmLevel: null },
    ],
  },
  {
    id: 'sample-decon', deviceId: 'sample-arae-03', deviceName: 'AreaRAE Decon Corridor',
    manufacturer: 'RAE Systems', model: 'AreaRAE Pro', assignedTo: 'Decon Group', team: 'Decon',
    location: 'Decon Corridor Exit', status: 'Online', alarmState: 'No Alarm', battery: 78, signal: 75,
    latitude: null, longitude: null, lastUpdate: null, source: 'Simulated', sourceMode: 'sample', notes: 'Training sample',
    sensors: [
      { gas: 'O2', value: 20.9, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'LEL', value: 0, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'VOC / PID', value: 0.4, unit: 'ppm', status: 'normal', alarmLevel: null },
      { gas: 'Cl2', value: 0, unit: 'ppm', status: 'normal', alarmLevel: null },
    ],
  },
  {
    id: 'sample-downwind', deviceId: 'sample-arae-04', deviceName: 'AreaRAE Downwind Monitor',
    manufacturer: 'RAE Systems', model: 'AreaRAE Pro', assignedTo: 'Monitoring Group', team: 'Recon',
    location: 'Downwind 300 ft', status: 'Online', alarmState: 'No Alarm', battery: 74, signal: 68,
    latitude: null, longitude: null, lastUpdate: null, source: 'Simulated', sourceMode: 'sample', notes: 'Training sample',
    sensors: [
      { gas: 'O2', value: 20.9, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'LEL', value: 1, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'VOC / PID', value: 1.8, unit: 'ppm', status: 'caution', alarmLevel: 'Training caution' },
      { gas: 'NH3', value: 0.2, unit: 'ppm', status: 'normal', alarmLevel: null },
      { gas: 'Cl2', value: 0, unit: 'ppm', status: 'normal', alarmLevel: null },
    ],
  },
  {
    id: 'sample-perimeter', deviceId: 'sample-arae-05', deviceName: 'AreaRAE Perimeter Monitor',
    manufacturer: 'RAE Systems', model: 'AreaRAE Pro', assignedTo: 'Perimeter Group', team: 'Recon',
    location: 'Cold Zone Boundary', status: 'Online', alarmState: 'No Alarm', battery: 81, signal: 72,
    latitude: null, longitude: null, lastUpdate: null, source: 'Simulated', sourceMode: 'sample', notes: 'Training sample',
    sensors: [
      { gas: 'O2', value: 20.9, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'LEL', value: 0, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'CO', value: 1, unit: 'ppm', status: 'normal', alarmLevel: null },
      { gas: 'H2S', value: 0, unit: 'ppm', status: 'normal', alarmLevel: null },
    ],
  },
  {
    id: 'sample-command', deviceId: 'sample-arae-06', deviceName: 'AreaRAE Command Post',
    manufacturer: 'RAE Systems', model: 'AreaRAE Pro', assignedTo: 'HazMat Group Supervisor', team: 'Command',
    location: 'Command Post', status: 'Online', alarmState: 'No Alarm', battery: 96, signal: 94,
    latitude: null, longitude: null, lastUpdate: null, source: 'Simulated', sourceMode: 'sample', notes: 'Training sample',
    sensors: [
      { gas: 'O2', value: 20.9, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'LEL', value: 0, unit: '%', status: 'normal', alarmLevel: null },
      { gas: 'CO', value: 0, unit: 'ppm', status: 'normal', alarmLevel: null },
      { gas: 'VOC / PID', value: 0.1, unit: 'ppm', status: 'normal', alarmLevel: null },
    ],
  },
];

function formatMonitorTime(value) {
  return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(value);
}

function varySampleSensor(sensor) {
  const ranges = { O2: 0.05, LEL: 0.2, CO: 0.4, H2S: 0.1, 'VOC / PID': 0.25, NH3: 0.1, Cl2: 0.02 };
  const range = ranges[sensor.gas] ?? 0.1;
  const decimals = sensor.gas === 'O2' || sensor.gas === 'VOC / PID' || sensor.gas === 'NH3' || sensor.gas === 'Cl2' ? 1 : 0;
  sensor.value = Math.max(0, Number((sensor.value + (Math.random() - 0.5) * range).toFixed(decimals)));
}

function renderSampleMonitorCards() {
  const container = document.getElementById('monitor-live-cards');
  if (!container) return;
  container.replaceChildren();
  monitorSampleReadings.forEach((monitor) => {
    const card = document.createElement('article');
    card.className = 'monitor-device-card';
    card.dataset.state = monitor.status === 'Online' ? 'normal' : 'offline';
    const header = document.createElement('header');
    const heading = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = monitor.deviceName;
    const assignment = document.createElement('p');
    assignment.textContent = `${monitor.assignedTo} · ${monitor.location}`;
    heading.append(title, assignment);
    const source = document.createElement('span');
    source.className = 'monitor-simulated-label';
    source.textContent = 'Source: Simulated';
    header.append(heading, source);

    const meta = document.createElement('div');
    meta.className = 'monitor-device-meta';
    [['Status', monitor.status], ['Alarm', monitor.alarmState], ['Battery', `${monitor.battery}%`], ['Signal', `${monitor.signal}%`], ['Updated', formatMonitorTime(monitor.lastUpdate)], ['Data mode', 'Simulated'], ['Source', 'Sample / Simulator']].forEach(([label, value]) => {
      const item = document.createElement('div');
      const name = document.createElement('span');
      const reading = document.createElement('strong');
      name.textContent = label;
      reading.textContent = value;
      item.append(name, reading);
      meta.append(item);
    });

    const sensors = document.createElement('div');
    sensors.className = 'monitor-sensor-list';
    monitor.sensors.forEach((sensor) => {
      const chip = document.createElement('span');
      chip.className = `monitor-sensor ${sensor.status}`;
      const gas = document.createElement('span');
      const value = document.createElement('strong');
      gas.textContent = sensor.gas;
      value.textContent = `${sensor.value} ${sensor.unit} · Simulated`;
      chip.append(gas, value);
      sensors.append(chip);
    });
    card.append(header, meta, sensors);
    container.append(card);
  });
}

function renderSampleMonitorLog() {
  const body = document.getElementById('monitor-log-rows');
  if (!body) return;
  const samples = [
    [monitorSampleReadings[0], 'O2', 'Baseline established'],
    [monitorSampleReadings[3], 'VOC / PID', 'Training caution trend only'],
    [monitorSampleReadings[2], 'Cl2', 'Decon exit check'],
    [monitorSampleReadings[4], 'LEL', 'Perimeter verification'],
  ];
  body.replaceChildren();
  samples.forEach(([monitor, gas, notes], index) => {
    const sensor = monitor.sensors.find((entry) => entry.gas === gas);
    const row = document.createElement('tr');
    [
      formatMonitorTime(new Date(monitor.lastUpdate.getTime() - index * 60000)), monitor.deviceName,
      monitor.location, gas, `${sensor.value} ${sensor.unit} (Simulated)`, sensor.status === 'caution' ? 'Caution · Simulated' : 'Normal · Simulated', notes,
    ].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
}

function refreshSampleMonitorReadings({ vary = true } = {}) {
  const now = new Date();
  monitorSampleReadings.forEach((monitor) => {
    monitor.lastUpdate = now;
    if (vary) monitor.sensors.forEach(varySampleSensor);
  });
  setText('monitor-last-updated', `${formatMonitorTime(now)} · Simulated`);
  renderSampleMonitorCards();
  renderSampleMonitorLog();
}

document.querySelectorAll('.monitor-objective').forEach((objective) => {
  objective.addEventListener('click', () => {
    document.querySelectorAll('.monitor-objective').forEach((item) => item.classList.toggle('selected', item === objective));
  });
});

document.getElementById('monitor-refresh-readings')?.addEventListener('click', () => {
  const source = document.getElementById('monitor-data-source')?.value;
  if (source === 'Sample / Simulator') refreshSampleMonitorReadings();
});

document.getElementById('monitor-data-source')?.addEventListener('change', (event) => {
  const status = document.getElementById('monitor-connection-status');
  const refresh = document.getElementById('monitor-refresh-readings');
  const isSample = event.target.value === 'Sample / Simulator';
  if (status) status.textContent = isSample ? 'Simulated' : event.target.value === 'RAE / Honeywell Safety Suite' ? 'Not Configured' : 'Awaiting Input';
  if (refresh) refresh.disabled = !isSample;
});

refreshSampleMonitorReadings({ vary: false });
syncCommandBarContext();

// Render saved incidents only after chemical state and all control handlers are initialized.
startIncidentTimer();
renderIncidentLists();
void restoreIncidentsFromBackend();
