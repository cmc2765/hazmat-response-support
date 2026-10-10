/* global document, FileReader, Option, window */
(() => {
  const storageKeys = {
    inventory: 'hazmatiq_monitor_inventory',
    assignments: 'hazmatiq_incident_monitor_assignments',
    activity: 'hazmatiq_monitor_activity_log',
    readings: 'hazmatiq_monitor_readings',
  };
  const importFields = [
    'deviceName', 'manufacturer', 'model', 'serialNumber', 'sensorPackage', 'assignedUnit', 'apparatus',
    'compartment', 'primaryUse', 'status', 'calibrationDate', 'calibrationDue', 'lastBumpTest',
    'inspectionDate', 'inspectionStatus', 'sourceId', 'sourceLastUpdated', 'notes',
  ];
  const inventoryFieldIds = {
    id: 'monitor-device-id', deviceName: 'monitor-device-name', manufacturer: 'monitor-device-manufacturer',
    model: 'monitor-device-model', serialNumber: 'monitor-device-serial', sensorPackage: 'monitor-device-sensors',
    assignedUnit: 'monitor-device-assigned', primaryUse: 'monitor-device-primary-use', status: 'monitor-device-status',
    calibrationDate: 'monitor-device-calibration-date', calibrationDue: 'monitor-device-calibration-due',
    lastBumpTest: 'monitor-device-bump-test', inspectionDate: 'monitor-device-inspection-date',
    inspectionStatus: 'monitor-device-inspection-status', notes: 'monitor-device-notes',
  };
  let inventory = readList(storageKeys.inventory);
  let assignments = readList(storageKeys.assignments);
  let activity = readList(storageKeys.activity);
  let readings = readList(storageKeys.readings);
  let importPreview = [];
  let logFilter = 'all';

  function readList(key) {
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) || '[]');
      return Array.isArray(stored) ? stored.filter((item) => item && typeof item === 'object' && item.id) : [];
    } catch { return []; }
  }

  function persist(key, value, statusId) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { setText(statusId, 'Unable to save in this browser. Check local storage access and try again.'); return false; }
  }

  function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
  function makeId(prefix) { return window.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function value(id) { return (document.getElementById(id)?.value || '').trim(); }
  function statusClass(status) {
    if (['Ready', 'Normal', 'Cleared'].includes(status)) return 'normal';
    if (['Due Soon', 'Caution'].includes(status)) return 'caution';
    if (['Overdue', 'Alarm'].includes(status)) return 'alarm';
    if (['Out of Service', 'Offline / Stale'].includes(status)) return 'offline';
    if (status === 'Training / Demo') return 'training';
    return 'unknown';
  }
  function formatDate(valueToFormat, includeTime = false) {
    if (!valueToFormat) return '—';
    const date = new Date(includeTime ? valueToFormat : `${valueToFormat}T00:00:00`);
    if (Number.isNaN(date.getTime())) return valueToFormat;
    return includeTime ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : date.toLocaleDateString([], { dateStyle: 'medium' });
  }
  function localDateTimeValue(date = new Date()) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function addCell(row, cellValue) { const cell = document.createElement('td'); cell.textContent = cellValue || 'Not provided'; row.append(cell); return cell; }
  function closeDialog(id) { const dialog = document.getElementById(id); if (dialog?.open && typeof dialog.close === 'function') dialog.close(); else dialog?.removeAttribute('open'); }
  function showDialog(id, focusId) { const dialog = document.getElementById(id); if (!dialog) return; if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); document.getElementById(focusId)?.focus(); }
  function downloadJson(filename, records) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  }
  function nowIso() { return new Date().toISOString(); }

  function findInventoryMatch(record) {
    if (record.serialNumber) {
      const match = inventory.find((item) => item.serialNumber && item.serialNumber.toLowerCase() === record.serialNumber.toLowerCase());
      if (match) return match;
    }
    if (record.sourceId) {
      const match = inventory.find((item) => item.sourceId && item.sourceId.toLowerCase() === record.sourceId.toLowerCase());
      if (match) return match;
    }
    if (record.deviceName && record.model) return inventory.find((item) => item.deviceName?.toLowerCase() === record.deviceName.toLowerCase() && item.model?.toLowerCase() === record.model.toLowerCase());
    return null;
  }

  function renderInventory() {
    const section = document.getElementById('monitor-saved-inventory');
    const body = document.getElementById('monitor-saved-inventory-rows');
    if (!section || !body) return;
    section.hidden = inventory.length === 0; body.replaceChildren();
    inventory.forEach((monitor) => {
      const row = document.createElement('tr'); row.dataset.monitorId = monitor.id;
      const device = addCell(row, monitor.deviceName); const source = document.createElement('small'); source.className = 'monitor-source-badge'; source.textContent = monitor.sourceSystem || 'Manual EMERGENZ Entry'; device.append(document.createElement('br'), source);
      addCell(row, [monitor.manufacturer, monitor.model].filter(Boolean).join(' / ')); addCell(row, monitor.serialNumber); addCell(row, monitor.sensorPackage);
      addCell(row, [monitor.assignedUnit, monitor.apparatus, monitor.compartment].filter(Boolean).join(' · ')); addCell(row, monitor.primaryUse);
      const statusCell = document.createElement('td'); const status = document.createElement('span'); status.className = `monitor-state ${statusClass(monitor.status)}`; status.textContent = monitor.status || 'Unknown'; statusCell.append(status); row.append(statusCell);
      addCell(row, formatDate(monitor.calibrationDue)); addCell(row, formatDate(monitor.lastBumpTest, true)); addCell(row, monitor.notes);
      const actions = document.createElement('td'); actions.innerHTML = '<div class="monitor-row-actions"><button type="button" data-monitor-action="edit">Edit</button><button type="button" class="monitor-delete-btn" data-monitor-action="delete">Delete</button></div>'; row.append(actions); body.append(row);
    });
    populateMonitorOptions();
  }

  function setInventoryField(name, fieldValue = '') { const field = document.getElementById(inventoryFieldIds[name]); if (field) field.value = fieldValue || ''; }
  function openInventoryDialog(monitor = null) {
    document.getElementById('monitor-device-form')?.reset(); setText('monitor-device-form-status', ''); setText('monitor-device-dialog-title', monitor ? 'Edit Monitor Reference' : 'Add Manual Monitor');
    Object.keys(inventoryFieldIds).forEach((name) => setInventoryField(name, monitor?.[name])); setInventoryField('primaryUse', monitor?.primaryUse || 'Area Monitoring'); setInventoryField('status', monitor?.status || 'Ready'); showDialog('monitor-device-dialog', inventoryFieldIds.deviceName);
  }
  function readInventoryForm() { return Object.fromEntries(Object.entries(inventoryFieldIds).map(([name, id]) => [name, value(id)])); }

  function populateMonitorOptions() {
    const assignmentSelect = document.getElementById('monitor-assignment-monitor');
    if (assignmentSelect) {
      const current = assignmentSelect.value; assignmentSelect.replaceChildren(); assignmentSelect.add(new Option('Manual / Temporary Monitor', '__temporary__'));
      inventory.forEach((monitor) => assignmentSelect.add(new Option(`${monitor.deviceName} · ${monitor.sourceSystem || 'Manual EMERGENZ Entry'}`, monitor.id)));
      if ([...assignmentSelect.options].some((option) => option.value === current)) assignmentSelect.value = current;
    }
    const logSelect = document.getElementById('monitor-log-monitor');
    if (logSelect) {
      const current = logSelect.value; logSelect.replaceChildren(); logSelect.add(new Option('Manual / Unlisted Monitor', ''));
      inventory.forEach((monitor) => logSelect.add(new Option(monitor.deviceName, monitor.id)));
      assignments.forEach((assignment) => { if (![...logSelect.options].some((option) => option.value === assignment.id)) logSelect.add(new Option(`${assignment.deviceName} · ${assignment.role || 'Incident monitor'}`, assignment.id)); });
      if ([...logSelect.options].some((option) => option.value === current)) logSelect.value = current;
    }
    toggleTemporaryFields();
  }
  function toggleTemporaryFields() { const temporary = value('monitor-assignment-monitor') === '__temporary__'; const fields = document.getElementById('monitor-temporary-fields'); if (fields) fields.hidden = !temporary; const name = document.getElementById('monitor-temporary-name'); if (name) name.required = temporary; }
  function assignmentSnapshot(form) {
    const saved = inventory.find((monitor) => monitor.id === form.monitorId); const temporary = form.monitorId === '__temporary__';
    return {
      monitorId: temporary ? '' : form.monitorId, deviceName: temporary ? form.temporaryName : saved?.deviceName || 'Unlisted Monitor',
      manufacturer: temporary ? form.temporaryModel : saved?.manufacturer || '', model: temporary ? '' : saved?.model || '', serialNumber: temporary ? form.temporarySerial : saved?.serialNumber || '',
      sensorPackage: temporary ? form.temporarySensors : saved?.sensorPackage || '', sourceSystem: temporary ? 'Manual / Temporary' : saved?.sourceSystem || 'Manual EMERGENZ Entry',
      sourceMode: temporary ? 'Manual / Temporary' : saved?.sourceMode || 'Manual Reference', readinessDataMode: saved?.readinessDataMode || '',
    };
  }
  function createActivity(entry) {
    const timestamp = entry.dateTime || nowIso();
    activity.push({ id: makeId('monitor-log'), sensor: '', readingValue: '', unit: '', alarmState: 'Unknown', actionTaken: '', enteredBy: '', notes: '', includeInReport: true, createdAt: nowIso(), ...entry, dateTime: timestamp });
    persist(storageKeys.activity, activity, 'monitor-log-status'); renderActivity();
  }
  function latestReadingFor(assignmentId) { return readings.filter((reading) => reading.assignmentId === assignmentId).sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))[0]; }
  function sourceBadge(sourceSystem) { return sourceSystem === 'FirstDue Export' ? 'FirstDue Export' : sourceSystem === 'Manual / Temporary' ? 'Manual / Temporary' : 'Manual EMERGENZ Entry'; }

  function renderAssignments() {
    const list = document.getElementById('monitor-assignment-list'); const empty = document.getElementById('monitor-assignment-empty'); const live = document.getElementById('monitor-assigned-live'); const liveEmpty = document.getElementById('monitor-live-empty'); const liveCards = document.getElementById('monitor-assigned-live-cards');
    if (!list || !empty || !live || !liveCards) return;
    empty.hidden = assignments.length > 0; live.hidden = assignments.length === 0; if (liveEmpty) liveEmpty.hidden = assignments.length > 0; list.replaceChildren(); liveCards.replaceChildren();
    assignments.forEach((assignment) => {
      const reading = latestReadingFor(assignment.id); const coordinates = Number.isFinite(assignment.latitude) && Number.isFinite(assignment.longitude) ? `${assignment.latitude}, ${assignment.longitude}` : 'Location pin pending';
      const card = document.createElement('article'); card.className = 'monitor-assignment-card'; card.dataset.assignmentId = assignment.id;
      card.innerHTML = '<header><div><h4></h4><p class="monitor-assignment-model"></p></div><span class="monitor-source-badge"></span></header><dl></dl><p class="monitor-assignment-notes"></p><div class="monitor-row-actions"><button type="button" data-assignment-action="edit">Edit Assignment</button><button type="button" class="monitor-delete-btn" data-assignment-action="remove">Remove from Incident</button></div>';
      card.querySelector('h4').textContent = assignment.deviceName; card.querySelector('.monitor-source-badge').textContent = sourceBadge(assignment.sourceSystem); card.querySelector('.monitor-assignment-model').textContent = [assignment.manufacturer, assignment.model, assignment.serialNumber].filter(Boolean).join(' · ') || 'Manual / temporary monitor';
      const details = [['Sensor package', assignment.sensorPackage], ['Assignment role', assignment.role], ['Deployment location', assignment.location], ['Assigned team', assignment.team], ['Monitoring purpose', assignment.purpose], ['Map location', coordinates]];
      const dl = card.querySelector('dl'); details.forEach(([label, detail]) => { const dt = document.createElement('dt'); const dd = document.createElement('dd'); dt.textContent = label; dd.textContent = detail || 'Not provided'; dl.append(dt, dd); }); card.querySelector('.monitor-assignment-notes').textContent = assignment.notes || 'No assignment notes.'; list.append(card);
      const liveCard = document.createElement('article'); liveCard.className = 'monitor-device-card'; liveCard.dataset.state = reading ? statusClass(reading.alarmState) : 'offline'; liveCard.dataset.assignmentId = assignment.id;
      liveCard.innerHTML = '<header><div><h3></h3><p></p></div><span class="monitor-state offline"></span></header><div class="monitor-device-meta"></div><p class="monitor-latest-reading"></p><div class="monitor-row-actions"><button type="button" data-reading-action="add">Add Manual Reading</button></div>';
      liveCard.querySelector('h3').textContent = assignment.deviceName; liveCard.querySelector('header p').textContent = `${assignment.role || 'Unassigned role'} · ${assignment.location || 'Location not set'}`;
      const state = liveCard.querySelector('.monitor-state'); state.className = `monitor-state ${reading ? statusClass(reading.alarmState) : 'offline'}`; state.textContent = reading ? 'Manual' : 'Pending Live Feed';
      const summary = reading ? `${reading.sensor}: ${reading.readingValue} ${reading.unit}`.trim() : 'No manual readings recorded.'; liveCard.querySelector('.monitor-latest-reading').textContent = reading ? `Latest Manual · ${summary} · ${formatDate(reading.dateTime, true)}` : summary;
      [['Status', 'Assigned'], ['Alarm', reading?.alarmState || 'No data'], ['Last update', reading ? formatDate(reading.dateTime, true) : 'No data'], ['Data mode', reading ? 'Manual' : 'Pending'], ['Source', sourceBadge(assignment.sourceSystem)], ['Map', coordinates]].forEach(([label, detail]) => { const item = document.createElement('div'); const name = document.createElement('span'); const readingText = document.createElement('strong'); name.textContent = label; readingText.textContent = detail; item.append(name, readingText); liveCard.querySelector('.monitor-device-meta').append(item); }); liveCards.append(liveCard);
    });
    populateMonitorOptions();
    window.hazmatiqMonitorMarkers = getMonitorMarkerData();
  }

  function openAssignmentDialog(assignment = null) {
    document.getElementById('monitor-assignment-form')?.reset(); setText('monitor-assignment-status', ''); setText('monitor-assignment-dialog-title', assignment ? 'Edit Incident Monitor Assignment' : 'Add Monitor to Incident'); document.getElementById('monitor-assignment-id').value = assignment?.id || ''; populateMonitorOptions();
    const monitorSelect = document.getElementById('monitor-assignment-monitor');
    if (assignment) { const savedExists = inventory.some((monitor) => monitor.id === assignment.monitorId); monitorSelect.value = savedExists ? assignment.monitorId : '__temporary__'; document.getElementById('monitor-temporary-name').value = savedExists ? '' : assignment.deviceName || ''; document.getElementById('monitor-temporary-model').value = savedExists ? '' : [assignment.manufacturer, assignment.model].filter(Boolean).join(' / '); document.getElementById('monitor-temporary-serial').value = savedExists ? '' : assignment.serialNumber || ''; document.getElementById('monitor-temporary-sensors').value = savedExists ? '' : assignment.sensorPackage || ''; }
    document.getElementById('monitor-assignment-role').value = assignment?.role || 'Entry Team 1'; document.getElementById('monitor-assignment-location').value = assignment?.location || ''; document.getElementById('monitor-assignment-team').value = assignment?.team || ''; document.getElementById('monitor-assignment-purpose').value = assignment?.purpose || 'Entry Team Safety'; document.getElementById('monitor-assignment-latitude').value = assignment?.latitude ?? ''; document.getElementById('monitor-assignment-longitude').value = assignment?.longitude ?? ''; document.getElementById('monitor-assignment-notes').value = assignment?.notes || ''; toggleTemporaryFields(); showDialog('monitor-assignment-dialog', 'monitor-assignment-monitor');
  }

  function getFilteredActivity() {
    if (logFilter === 'alarms') return activity.filter((entry) => ['Alarm', 'Caution'].includes(entry.alarmState) || /alarm|elevated/i.test(entry.entryType));
    if (logFilter === 'readings') return activity.filter((entry) => entry.entryType === 'Manual reading recorded');
    if (logFilter === 'deployment') return activity.filter((entry) => ['Monitor deployed', 'Monitor repositioned', 'Monitor removed from service', 'Monitor returned to service', 'Monitor assignment updated'].includes(entry.entryType));
    if (logFilter === 'report') return activity.filter((entry) => entry.includeInReport);
    return activity;
  }
  function renderActivity() {
    const body = document.getElementById('monitor-activity-rows'); const table = document.getElementById('monitor-log-table'); const empty = document.getElementById('monitor-log-empty'); if (!body || !table || !empty) return;
    const displayed = getFilteredActivity().sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime)); table.hidden = displayed.length === 0; empty.hidden = displayed.length > 0; empty.textContent = activity.length ? 'No monitor activity matches this filter.' : 'No monitor activity has been recorded.'; body.replaceChildren();
    displayed.forEach((entry) => { const row = document.createElement('tr'); row.dataset.logId = entry.id; addCell(row, formatDate(entry.dateTime, true)); addCell(row, entry.monitorName); addCell(row, [entry.role, entry.location].filter(Boolean).join(' · ')); addCell(row, entry.entryType); addCell(row, [entry.sensor, entry.readingValue, entry.unit].filter(Boolean).join(' ')); addCell(row, entry.alarmState); addCell(row, [entry.actionTaken, entry.enteredBy].filter(Boolean).join(' · ')); addCell(row, entry.includeInReport ? 'Include' : 'No'); addCell(row, entry.notes); const action = document.createElement('td'); action.innerHTML = '<div class="monitor-row-actions"><button type="button" data-log-action="edit">Edit Log Entry</button><button type="button" class="monitor-delete-btn" data-log-action="delete">Delete Log Entry</button></div>'; row.append(action); body.append(row); });
  }
  function openLogDialog(entry = null) {
    document.getElementById('monitor-log-form')?.reset(); populateMonitorOptions(); setText('monitor-log-status', ''); setText('monitor-log-dialog-title', entry ? 'Edit Log Entry' : 'Add Monitor Log Entry'); document.getElementById('monitor-log-id').value = entry?.id || ''; document.getElementById('monitor-log-time').value = entry?.dateTime ? localDateTimeValue(new Date(entry.dateTime)) : localDateTimeValue();
    ['monitor', 'role', 'location', 'type', 'sensor', 'value', 'unit', 'alarm', 'action', 'entered-by', 'notes'].forEach((suffix) => { const map = { monitor: 'monitorId', role: 'role', location: 'location', type: 'entryType', sensor: 'sensor', value: 'readingValue', unit: 'unit', alarm: 'alarmState', action: 'actionTaken', 'entered-by': 'enteredBy', notes: 'notes' }; const field = document.getElementById(`monitor-log-${suffix}`); if (field && entry) field.value = entry[map[suffix]] || ''; });
    if (!entry) document.getElementById('monitor-log-alarm').value = 'Unknown'; document.getElementById('monitor-log-include').checked = entry ? Boolean(entry.includeInReport) : true; showDialog('monitor-log-dialog', 'monitor-log-time');
  }
  function openReadingDialog(assignment) { document.getElementById('monitor-reading-form')?.reset(); setText('monitor-reading-status', ''); document.getElementById('monitor-reading-assignment-id').value = assignment.id; document.getElementById('monitor-reading-monitor').value = assignment.deviceName; document.getElementById('monitor-reading-time').value = localDateTimeValue(); document.getElementById('monitor-reading-location').value = assignment.location || ''; document.getElementById('monitor-reading-include').checked = true; showDialog('monitor-reading-dialog', 'monitor-reading-time'); }

  function parseCsv(text) {
    const rows = []; let row = []; let field = ''; let quoted = false;
    for (let index = 0; index < text.length; index += 1) { const character = text[index]; if (character === '"') { if (quoted && text[index + 1] === '"') { field += '"'; index += 1; } else quoted = !quoted; } else if (character === ',' && !quoted) { row.push(field); field = ''; } else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && text[index + 1] === '\n') index += 1; row.push(field); if (row.some((item) => item.trim())) rows.push(row); row = []; field = ''; } else field += character; }
    row.push(field); if (row.some((item) => item.trim())) rows.push(row); if (rows.length < 2) return [];
    const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ''));
    return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()])));
  }
  function normalizeImportRecord(record) { const normalized = {}; importFields.forEach((field) => { const sourceKey = Object.keys(record).find((key) => key.trim().toLowerCase() === field.toLowerCase()); normalized[field] = sourceKey ? String(record[sourceKey] ?? '').trim() : ''; }); return { ...normalized, id: makeId('monitor'), sourceSystem: 'FirstDue Export', sourceMode: 'Imported Reference', readinessDataMode: 'Reference Only', importedAt: nowIso() }; }
  function parseImport() {
    const text = value('monitor-import-text'); if (!text) { setText('monitor-import-status', 'Paste or upload an approved CSV/JSON export first.'); return; }
    try { let records; if (value('monitor-import-format') === 'json') { const parsed = JSON.parse(text); records = Array.isArray(parsed) ? parsed : parsed.records || parsed.monitors || parsed.equipment; if (!Array.isArray(records)) throw new Error('JSON must be an array or contain records, monitors, or equipment.'); } else records = parseCsv(text); importPreview = records.filter((record) => record && typeof record === 'object').map(normalizeImportRecord); if (!importPreview.length) throw new Error('No records were found.'); renderImportPreview(); setText('monitor-import-status', 'Review every record below before confirming the import.'); } catch (error) { importPreview = []; document.getElementById('monitor-import-preview-section').hidden = true; setText('monitor-import-status', `Import preview failed: ${error.message}`); }
  }
  function renderImportPreview() { const body = document.getElementById('monitor-import-preview-rows'); body.replaceChildren(); importPreview.forEach((record) => { const row = document.createElement('tr'); addCell(row, record.deviceName); addCell(row, [record.manufacturer, record.model].filter(Boolean).join(' / ')); addCell(row, [record.serialNumber, record.sourceId].filter(Boolean).join(' / ')); addCell(row, record.sensorPackage); addCell(row, [record.assignedUnit, record.apparatus, record.compartment].filter(Boolean).join(' · ')); addCell(row, record.status); addCell(row, findInventoryMatch(record) ? 'Matching saved record' : 'New record'); body.append(row); }); setText('monitor-import-preview-count', `${importPreview.length} record${importPreview.length === 1 ? '' : 's'} · Reference Only`); document.getElementById('monitor-import-preview-section').hidden = false; }
  function openImportDialog() { document.getElementById('monitor-import-form')?.reset(); importPreview = []; document.getElementById('monitor-import-preview-section').hidden = true; setText('monitor-import-status', ''); showDialog('monitor-import-dialog', 'monitor-import-format'); }
  function getMonitorMarkerData() { return assignments.filter((assignment) => Number.isFinite(assignment.latitude) && Number.isFinite(assignment.longitude)).map((assignment) => { const reading = latestReadingFor(assignment.id); return { deviceName: assignment.deviceName, assignmentRole: assignment.role, deploymentLocation: assignment.location, latestReadingSummary: reading ? `${reading.sensor}: ${reading.readingValue} ${reading.unit}`.trim() : 'No reading', alarmState: reading?.alarmState || 'Unknown', dataMode: reading ? 'Manual' : assignment.dataMode, sourceSystem: assignment.sourceSystem, latitude: assignment.latitude, longitude: assignment.longitude }; }); }
  window.getHazMatIQMonitorMarkers = getMonitorMarkerData;

  document.getElementById('monitor-add-device')?.addEventListener('click', () => openInventoryDialog());
  ['monitor-device-cancel', 'monitor-device-dialog-close'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => closeDialog('monitor-device-dialog')));
  document.getElementById('monitor-device-form')?.addEventListener('submit', (event) => { event.preventDefault(); const monitor = readInventoryForm(); if (!monitor.deviceName) { setText('monitor-device-form-status', 'Device Name is required.'); return; } const timestamp = nowIso(); const index = inventory.findIndex((item) => item.id === monitor.id); if (index >= 0) inventory[index] = { ...inventory[index], ...monitor, sourceLastUpdated: timestamp, updatedAt: timestamp }; else inventory.push({ ...monitor, id: makeId('monitor'), sourceSystem: 'Manual EMERGENZ Entry', sourceMode: 'Manual Reference', sourceId: '', sourceLastUpdated: timestamp, createdAt: timestamp }); if (!persist(storageKeys.inventory, inventory, 'monitor-device-form-status')) return; renderInventory(); renderAssignments(); closeDialog('monitor-device-dialog'); });
  document.getElementById('monitor-saved-inventory-rows')?.addEventListener('click', (event) => { const button = event.target.closest('[data-monitor-action]'); const row = button?.closest('[data-monitor-id]'); if (!button || !row) return; const monitor = inventory.find((item) => item.id === row.dataset.monitorId); if (!monitor) return; if (button.dataset.monitorAction === 'edit') { openInventoryDialog(monitor); return; } if (!window.confirm(`Delete ${monitor.deviceName} from the locally saved monitor inventory? Incident assignments will remain.`)) return; inventory = inventory.filter((item) => item.id !== monitor.id); if (persist(storageKeys.inventory, inventory, 'monitor-device-form-status')) { renderInventory(); renderAssignments(); } });
  document.getElementById('monitor-firstdue-import')?.addEventListener('click', openImportDialog);
  document.getElementById('monitor-inventory-export')?.addEventListener('click', () => downloadJson(`hazmatiq-monitor-inventory-${new Date().toISOString().slice(0, 10)}.json`, inventory.map((monitor) => Object.fromEntries([...importFields, 'sourceSystem', 'sourceMode', 'readinessDataMode'].map((field) => [field, monitor[field] || ''])))));
  ['monitor-import-close', 'monitor-import-cancel'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => closeDialog('monitor-import-dialog')));
  document.getElementById('monitor-import-preview')?.addEventListener('click', parseImport);
  document.getElementById('monitor-import-file')?.addEventListener('change', (event) => { const file = event.target.files?.[0]; if (!file) return; document.getElementById('monitor-import-format').value = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv'; const reader = new FileReader(); reader.onload = () => { document.getElementById('monitor-import-text').value = String(reader.result || ''); setText('monitor-import-status', 'File loaded locally. Click Preview Import to review it.'); }; reader.onerror = () => setText('monitor-import-status', 'Unable to read that local file.'); reader.readAsText(file); });
  document.getElementById('monitor-import-confirm')?.addEventListener('click', () => { if (!importPreview.length) return; const update = document.getElementById('monitor-import-update-matches').checked; let added = 0; let updated = 0; let skipped = 0; importPreview.forEach((record) => { const match = findInventoryMatch(record); if (match && update) { const index = inventory.findIndex((item) => item.id === match.id); inventory[index] = { ...match, ...record, id: match.id, updatedAt: nowIso() }; updated += 1; } else if (match) skipped += 1; else { inventory.push(record); added += 1; } }); if (!persist(storageKeys.inventory, inventory, 'monitor-import-status')) return; renderInventory(); renderAssignments(); setText('monitor-firstdue-status', `Approved export processed: ${added} added, ${updated} updated, ${skipped} matching record(s) skipped.`); closeDialog('monitor-import-dialog'); });

  document.getElementById('monitor-assignment-monitor')?.addEventListener('change', toggleTemporaryFields); document.getElementById('monitor-add-assignment')?.addEventListener('click', () => openAssignmentDialog()); ['monitor-assignment-close', 'monitor-assignment-cancel'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => closeDialog('monitor-assignment-dialog')));
  document.getElementById('monitor-assignment-form')?.addEventListener('submit', (event) => { event.preventDefault(); const values = { id: value('monitor-assignment-id'), monitorId: value('monitor-assignment-monitor'), temporaryName: value('monitor-temporary-name'), temporaryModel: value('monitor-temporary-model'), temporarySerial: value('monitor-temporary-serial'), temporarySensors: value('monitor-temporary-sensors'), role: value('monitor-assignment-role'), location: value('monitor-assignment-location'), team: value('monitor-assignment-team'), purpose: value('monitor-assignment-purpose'), notes: value('monitor-assignment-notes') }; if (values.monitorId === '__temporary__' && !values.temporaryName) { setText('monitor-assignment-status', 'Temporary Device Name is required.'); return; } const latitudeText = value('monitor-assignment-latitude'); const longitudeText = value('monitor-assignment-longitude'); const latitude = latitudeText === '' ? null : Number(latitudeText); const longitude = longitudeText === '' ? null : Number(longitudeText); const record = { ...assignmentSnapshot(values), role: values.role, location: values.location, team: values.team, purpose: values.purpose, notes: values.notes, latitude, longitude, dataMode: 'Manual / Pending Live Feed', updatedAt: nowIso() }; const index = assignments.findIndex((item) => item.id === values.id); let saved; let entryType; if (index >= 0) { assignments[index] = { ...assignments[index], ...record }; saved = assignments[index]; entryType = 'Monitor assignment updated'; } else { saved = { ...record, id: makeId('assignment'), createdAt: nowIso() }; assignments.push(saved); entryType = 'Monitor deployed'; } if (!persist(storageKeys.assignments, assignments, 'monitor-assignment-status')) return; createActivity({ monitorId: saved.monitorId || saved.id, assignmentId: saved.id, monitorName: saved.deviceName, role: saved.role, location: saved.location, entryType, notes: saved.notes, includeInReport: true }); renderAssignments(); closeDialog('monitor-assignment-dialog'); });
  document.getElementById('monitor-assignment-list')?.addEventListener('click', (event) => { const button = event.target.closest('[data-assignment-action]'); const card = button?.closest('[data-assignment-id]'); if (!button || !card) return; const assignment = assignments.find((item) => item.id === card.dataset.assignmentId); if (!assignment) return; if (button.dataset.assignmentAction === 'edit') { openAssignmentDialog(assignment); return; } if (!window.confirm(`Remove ${assignment.deviceName} from this incident? The saved inventory record will not be deleted.`)) return; assignments = assignments.filter((item) => item.id !== assignment.id); if (persist(storageKeys.assignments, assignments, 'monitor-assignment-status')) { createActivity({ monitorId: assignment.monitorId || assignment.id, assignmentId: assignment.id, monitorName: assignment.deviceName, role: assignment.role, location: assignment.location, entryType: 'Monitor removed from service', notes: assignment.notes, includeInReport: true }); renderAssignments(); } });

  document.getElementById('monitor-assigned-live-cards')?.addEventListener('click', (event) => { const button = event.target.closest('[data-reading-action="add"]'); const card = button?.closest('[data-assignment-id]'); const assignment = assignments.find((item) => item.id === card?.dataset.assignmentId); if (assignment) openReadingDialog(assignment); });
  ['monitor-reading-close', 'monitor-reading-cancel'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => closeDialog('monitor-reading-dialog')));
  document.getElementById('monitor-reading-form')?.addEventListener('submit', (event) => { event.preventDefault(); const assignment = assignments.find((item) => item.id === value('monitor-reading-assignment-id')); if (!assignment) { setText('monitor-reading-status', 'This incident monitor is no longer assigned.'); return; } const reading = { id: makeId('monitor-reading'), assignmentId: assignment.id, monitorId: assignment.monitorId || assignment.id, monitorName: assignment.deviceName, dateTime: value('monitor-reading-time'), sensor: value('monitor-reading-sensor'), readingValue: value('monitor-reading-value'), unit: value('monitor-reading-unit'), alarmState: value('monitor-reading-alarm'), location: value('monitor-reading-location'), actionTaken: value('monitor-reading-action'), enteredBy: value('monitor-reading-entered-by'), notes: value('monitor-reading-notes'), includeInReport: document.getElementById('monitor-reading-include').checked, dataMode: 'Manual', createdAt: nowIso() }; if (!reading.dateTime || !reading.readingValue) { setText('monitor-reading-status', 'Date / Time and Reading Value are required.'); return; } readings.push(reading); if (!persist(storageKeys.readings, readings, 'monitor-reading-status')) return; assignment.lastUpdate = reading.dateTime; persist(storageKeys.assignments, assignments, 'monitor-reading-status'); createActivity({ ...reading, id: makeId('monitor-log'), role: assignment.role, entryType: 'Manual reading recorded' }); renderAssignments(); closeDialog('monitor-reading-dialog'); });

  document.getElementById('monitor-add-log')?.addEventListener('click', () => openLogDialog()); ['monitor-log-close', 'monitor-log-cancel'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => closeDialog('monitor-log-dialog')));
  document.getElementById('monitor-log-monitor')?.addEventListener('change', (event) => { const assignment = assignments.find((item) => item.id === event.target.value || item.monitorId === event.target.value); if (assignment) { document.getElementById('monitor-log-role').value = assignment.role || ''; document.getElementById('monitor-log-location').value = assignment.location || ''; } });
  document.getElementById('monitor-log-form')?.addEventListener('submit', (event) => { event.preventDefault(); const monitorId = value('monitor-log-monitor'); const assignment = assignments.find((item) => item.id === monitorId || item.monitorId === monitorId); const monitor = inventory.find((item) => item.id === monitorId); const entry = { id: value('monitor-log-id') || makeId('monitor-log'), dateTime: value('monitor-log-time'), monitorId, assignmentId: assignment?.id || '', monitorName: assignment?.deviceName || monitor?.deviceName || document.getElementById('monitor-log-monitor').selectedOptions[0]?.textContent || 'Manual / Unlisted Monitor', role: value('monitor-log-role'), location: value('monitor-log-location'), entryType: value('monitor-log-type'), sensor: value('monitor-log-sensor'), readingValue: value('monitor-log-value'), unit: value('monitor-log-unit'), alarmState: value('monitor-log-alarm'), actionTaken: value('monitor-log-action'), enteredBy: value('monitor-log-entered-by'), notes: value('monitor-log-notes'), includeInReport: document.getElementById('monitor-log-include').checked, createdAt: nowIso() }; if (!entry.dateTime) { setText('monitor-log-status', 'Date / Time is required.'); return; } const index = activity.findIndex((item) => item.id === entry.id); if (index >= 0) activity[index] = { ...activity[index], ...entry, updatedAt: nowIso() }; else activity.push(entry); if (!persist(storageKeys.activity, activity, 'monitor-log-status')) return; renderActivity(); closeDialog('monitor-log-dialog'); });
  document.getElementById('monitor-activity-rows')?.addEventListener('click', (event) => { const button = event.target.closest('[data-log-action]'); const row = button?.closest('[data-log-id]'); if (!button || !row) return; const entry = activity.find((item) => item.id === row.dataset.logId); if (!entry) return; if (button.dataset.logAction === 'edit') { openLogDialog(entry); return; } if (!window.confirm('Delete this locally stored monitor activity entry?')) return; activity = activity.filter((item) => item.id !== entry.id); if (persist(storageKeys.activity, activity, 'monitor-log-status')) renderActivity(); });
  document.getElementById('monitor-log-filters')?.addEventListener('click', (event) => { const button = event.target.closest('[data-log-filter]'); if (!button) return; logFilter = button.dataset.logFilter; document.querySelectorAll('#monitor-log-filters button').forEach((item) => item.classList.toggle('active', item === button)); renderActivity(); });
  document.getElementById('monitor-log-export')?.addEventListener('click', () => downloadJson(`hazmatiq-monitor-activity-${new Date().toISOString().slice(0, 10)}.json`, activity));
  document.getElementById('monitor-data-source')?.addEventListener('change', (event) => {
    if (event.target.value === 'RAE / Honeywell Safety Suite') setText('monitor-connection-status', 'Pending SDK/API — live feed not connected');
  });

  renderInventory(); renderAssignments(); renderActivity();
})();
