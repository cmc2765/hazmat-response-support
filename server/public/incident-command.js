/* Incident Command ownership. The existing renderer remains behind an explicit
   bridge while this module owns the canonical incident view state, action context,
   plume summary, and ICS prefill contract. */
(() => {
  let initialized = false;
  let activeIncidentState = null;

  const NO_DATA = 'No Current Data Exists';

  function legacyApi() {
    return window.HazMatIQ?.incidentCommandLegacy;
  }

  function firstValue(...values) {
    for (const value of values.flat(Infinity)) {
      if (value !== null && value !== undefined && String(value).trim()) return value;
    }
    return null;
  }

  function listValue(value) {
    if (Array.isArray(value)) return value.flat(Infinity).map((item) => String(item ?? '').trim()).filter(Boolean);
    if (value === null || value === undefined || value === '') return [];
    return String(value).split(/\r?\n|\s*;\s*/).map((item) => item.trim()).filter(Boolean);
  }

  function normalizeIncidentState(incident = legacyApi()?.getActiveIncident?.()) {
    const source = incident && typeof incident === 'object' ? incident : {};
    const location = [source.facilityName, source.address, source.city, source.state, source.zip].filter(Boolean).join(', ');
    const coordinates = Number.isFinite(Number(source.latitude)) && Number.isFinite(Number(source.longitude))
      ? { latitude: Number(source.latitude), longitude: Number(source.longitude) }
      : null;
    const profileType = source.hazardProfileType || (source.cbrneCanonicalId ? 'hazard' : 'chemical');
    const activeChemical = source.chemicalName || source.primaryHazard
      ? {
          profileType,
          canonicalId: String(source.cbrneCanonicalId || source.selectedChemicalId || ''),
          displayName: source.chemicalName || source.primaryHazard || NO_DATA,
          chemicalCompanionId: source.chemicalCompanionId ?? source.selectedChemicalId ?? null,
          cbrneCanonicalId: source.cbrneCanonicalId || null,
          cas: source.casNumber || null,
          un: source.unNumber || null,
          erg: source.ergGuide || null,
          category: source.hazardClass || null,
          routingLane: source.hazardRoutingLane || 'CHEMICAL',
          sourceState: source.sourceStatuses?.chemical || NO_DATA,
        }
      : null;
    const plume = source.plumeModelResults || null;
    const weather = source.weather || source.weatherSnapshot || null;
    return Object.freeze({
      incidentId: source.incidentId || null,
      incidentName: source.incidentName || 'New Incident',
      incidentNumber: source.incidentNumber || '',
      status: source.status || 'Active',
      startedAt: source.startedAt || null,
      location: location || NO_DATA,
      coordinates,
      activeChemical,
      activeChemicals: activeChemical ? [activeChemical] : [],
      release: {
        quantity: source.quantity || null,
        containerType: source.containerType || null,
        releaseLocation: source.containerReleaseLocation || null,
        releasePhase: source.containerReleasePhase || null,
      },
      weather: {
        summary: weather || null,
        source: source.weatherSource || null,
        observationTime: source.weatherObservationTime || null,
        windSpeed: source.windSpeed || null,
        windDirection: source.windDirection || null,
      },
      plume: {
        status: plume || source.plumeMapImage ? 'PLOTTED' : 'NOT PLOTTED',
        result: plume,
        summary: source.plumeSummary || plume?.commandSummary || plume?.textSummary || null,
        mapImage: source.plumeMapImage || '',
      },
      command: {
        objectives: listValue(source.objectives),
        structure: source.commandStructure || '',
        communications: source.communications || '',
        medicalPlan: source.medicalPlan || '',
        stagingResources: source.stagingResources || '',
      },
      operational: {
        protectiveActions: source.protectiveActionSummary || null,
        ppe: source.ppeSummary || null,
        monitoring: source.monitoringStatus || null,
        decon: source.deconSummary || null,
        medical: source.medicalSummary || null,
      },
      reporting: {
        forms: source.icsForms || {},
        notes: source.incidentNotes || [],
      },
      raw: source,
    });
  }

  function buildIcsPrefill(incident = legacyApi()?.getActiveIncident?.()) {
    const state = incident?.raw ? incident : normalizeIncidentState(incident);
    const source = state.raw || {};
    const location = state.location === NO_DATA ? '' : state.location;
    const objectives = state.command.objectives.join('\n');
    const situation = [
      state.activeChemical?.displayName,
      state.activeChemical?.cas && `CAS ${state.activeChemical.cas}`,
      state.activeChemical?.un && `UN ${state.activeChemical.un}`,
      state.activeChemical?.erg && `ERG ${state.activeChemical.erg}`,
      state.activeChemical?.category,
      source.notes,
      state.weather.summary,
    ].filter(Boolean).join(' · ');
    const safety = [state.operational.ppe, state.operational.protectiveActions, state.operational.decon].filter(Boolean).join('\n');
    return Object.freeze({
      incidentId: state.incidentId,
      shared: {
        incidentName: state.incidentName,
        incidentNumber: state.incidentNumber,
        dateFrom: source.startDate || '',
        timeFrom: source.startTime || '',
        incidentLocation: location,
      },
      forms: {
        '201': { incidentName: state.incidentName, incidentLocation: location, situationSummary: situation },
        '202': { incidentName: state.incidentName, objectives },
        '203': { incidentName: state.incidentName, commandStructure: state.command.structure },
        '204': { incidentName: state.incidentName, assignments: state.command.stagingResources },
        '205': { incidentName: state.incidentName, communications: state.command.communications },
        '206': { incidentName: state.incidentName, medicalPlan: state.command.medicalPlan || state.operational.medical || '' },
        '208': { incidentName: state.incidentName, safetyMessage: safety },
        '209': { incidentName: state.incidentName, status: state.status, situationSummary: situation },
        '214': { incidentName: state.incidentName, activityLog: state.reporting.notes.map((note) => note.text || note).join('\n') },
        '215': { incidentName: state.incidentName, objectives, resources: state.command.stagingResources },
        '215A': { incidentName: state.incidentName, safetyAnalysis: safety },
      },
      source,
    });
  }

  function setActiveIncidentState(incident = legacyApi()?.getActiveIncident?.()) {
    activeIncidentState = incident ? normalizeIncidentState(incident) : null;
    window.HazMatIQ.activeIncidentState = activeIncidentState;
    return activeIncidentState;
  }

  function getActiveIncidentState() {
    const current = legacyApi()?.getActiveIncident?.();
    if (!current) return setActiveIncidentState(null);
    if (!activeIncidentState || activeIncidentState.incidentId !== current.incidentId || activeIncidentState.raw !== current) {
      return setActiveIncidentState(current);
    }
    return activeIncidentState;
  }

  function renderIncidentBrief(state) {
    const root = document.getElementById('incident');
    if (!root) return;
    root.dataset.activeIncidentId = state?.incidentId || '';
    root.dataset.activeHazard = state?.activeChemical?.displayName || '';
    const summary = document.getElementById('ic-chemical-summary');
    if (summary) {
      summary.replaceChildren();
      const heading = document.createElement('strong');
      heading.textContent = state?.activeChemical?.displayName || 'Active chemical / hazard not identified';
      summary.append(heading);
      const fields = [
        ['CAS', state?.activeChemical?.cas],
        ['UN', state?.activeChemical?.un],
        ['ERG', state?.activeChemical?.erg],
        ['IDLH', state?.raw?.idlh],
        ['Hazard Class', state?.activeChemical?.category],
        ['Source / Review', state?.activeChemical?.sourceState],
      ];
      const list = document.createElement('dl');
      fields.forEach(([label, value]) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = label;
        detail.textContent = value || NO_DATA;
        row.append(term, detail);
        list.append(row);
      });
      summary.append(list);
    }
    const profileButton = root.querySelector('[data-incident-command-action="chemical-profile"]');
    if (profileButton) profileButton.disabled = !state?.activeChemical || !state.activeChemical.canonicalId;
  }

  function renderOperationalStatus(state) {
    const root = document.getElementById('incident');
    if (!root) return;
    root.dataset.operationalStatus = state?.incidentId ? 'active' : 'empty';
    root.querySelectorAll('#ic-tactical-list .incident-command-tactical-row').forEach((row) => {
      row.dataset.incidentState = state?.incidentId ? 'active' : 'empty';
    });
  }

  function renderPlumeSummary(state) {
    const result = state?.plume?.result;
    const hasPlume = Boolean(result || state?.plume?.mapImage);
    const status = document.getElementById('ic-plume-status');
    const image = document.getElementById('ic-plume-preview-image');
    const empty = document.getElementById('ic-plume-preview-empty');
    const title = document.getElementById('ic-plume-preview-title');
    const summary = document.getElementById('ic-plume-preview-summary');
    const facts = document.getElementById('ic-plume-preview-facts');
    const open = document.getElementById('ic-plume-open-btn');
    if (!status || !image || !empty || !title || !summary || !facts || !open) return;
    status.textContent = hasPlume ? 'PLOTTED' : 'NOT PLOTTED';
    status.dataset.state = hasPlume ? 'plotted' : 'missing';
    image.hidden = !state?.plume?.mapImage;
    image.src = state?.plume?.mapImage || '';
    empty.hidden = Boolean(state?.plume?.mapImage);
    title.textContent = hasPlume ? (state.plume.summary?.title || 'Saved plume assessment') : 'Plot a plume from Incident Command';
    summary.textContent = hasPlume
      ? (state.plume.summary?.summary || result?.output?.resultSummary || result?.textSummary || 'Plume result saved with this incident.')
      : 'Use the canonical Plume Model after confirming chemical identity, release inputs, and current weather.';
    const weather = result?.weather || result?.plumeResult?.weather || {};
    const location = result?.location || {};
    const zones = result?.output?.threatZones || result?.plumeOutput?.threatZones || result?.threatZone?.threatZones || [];
    const rows = [
      ['Location', location.address || (location.latitude !== undefined && location.longitude !== undefined ? `${location.latitude}, ${location.longitude}` : state?.location)],
      ['Wind', weather.windDirection ? `${weather.windSpeed || '—'} mph from ${weather.windDirection}°` : state?.weather?.windDirection ? `from ${state.weather.windDirection}°` : NO_DATA],
      ['Zones', zones.length ? `${zones.length} source-backed zone${zones.length === 1 ? '' : 's'}` : (hasPlume ? 'Saved geometry available' : NO_DATA)],
      ['Assessment', result?.model?.confidenceStatus || result?.confidenceLevel || (hasPlume ? 'Planning Estimate' : NO_DATA)],
    ];
    facts.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value || NO_DATA;
      row.append(dt, dd);
      return row;
    }));
    open.textContent = hasPlume ? 'OPEN PLUME MODEL' : 'PLOT PLUME';
  }

  function renderCommandActions(state) {
    const root = document.getElementById('ic-command-actions');
    if (!root) return;
    root.dataset.incidentId = state?.incidentId || '';
    root.querySelectorAll('[data-incident-command-action="chemical-profile"]').forEach((button) => {
      button.disabled = !state?.activeChemical || !state.activeChemical.canonicalId;
    });
  }

  function propagateHazardToIncident(result, profile) {
    const api = legacyApi();
    const incident = api?.getActiveIncident?.();
    if (!incident || !result) return null;
    const normalized = window.HazMatIQ.normalizeHazardSearchResult?.(result) || result;
    const viewProfile = window.HazMatIQ.normalizeProfileForUi?.(profile) || profile || {};
    const identifiers = viewProfile.identifiers || {};
    const next = {
      ...incident,
      chemicalName: normalized.displayName || incident.chemicalName,
      selectedChemicalId: normalized.chemicalCompanionId ?? incident.selectedChemicalId ?? null,
      chemicalCompanionId: normalized.chemicalCompanionId ?? incident.chemicalCompanionId ?? null,
      cbrneCanonicalId: normalized.cbrneCanonicalId || incident.cbrneCanonicalId || null,
      canonicalHazardId: normalized.canonicalId || incident.canonicalHazardId || null,
      hazardProfileType: normalized.profileType || 'hazard',
      hazardRoutingLane: normalized.routingLane || result.lane || incident.hazardRoutingLane || '',
      casNumber: normalized.cas || identifiers.cas || identifiers.casNumber || incident.casNumber || '',
      unNumber: normalized.un || identifiers.un || identifiers.unNaNumbers || incident.unNumber || '',
      ergGuide: normalized.erg || identifiers.erg || identifiers.ergGuide || incident.ergGuide || '',
      idlh: normalized.idlh || identifiers.idlh || viewProfile.idlh || viewProfile.exposures?.idlh || incident.idlh || '',
      nioshSourceId: normalized.nioshSourceId || viewProfile.niosh?.sourceRecordId || incident.nioshSourceId || '',
      nioshIdentityStatus: normalized.nioshIdentityStatus || viewProfile.niosh?.status || incident.nioshIdentityStatus || '',
      hazardClass: normalized.category || incident.hazardClass || '',
      chemicalProfile: viewProfile,
      chemicalProfileCapturedAt: new Date().toISOString(),
      sourceStatuses: { ...(incident.sourceStatuses || {}), chemical: normalized.sourceState || NO_DATA },
      updatedAt: new Date().toISOString(),
    };
    const incidents = api.readIncidents?.() || [];
    const index = incidents.findIndex((item) => item.incidentId === incident.incidentId);
    if (index < 0 || !api.writeIncidents) return null;
    incidents[index] = next;
    api.writeIncidents(incidents);
    api.renderIncidentLists?.();
    setActiveIncidentState(next);
    return next;
  }

  function openChemicalProfile() {
    const state = getActiveIncidentState();
    const chemical = state?.activeChemical;
    if (!chemical) return null;
    const result = chemical.profileType === 'hazard'
      ? { id: chemical.cbrneCanonicalId || chemical.canonicalId, lane: chemical.routingLane, displayName: chemical.displayName }
      : { selectedChemicalId: chemical.chemicalCompanionId, ChemicalName: chemical.displayName, CasNumber: chemical.cas, UnnaNumber: chemical.un, ErgNumber: chemical.erg, guidanceEligible: true };
    if (window.HazMatIQ.openHazardProfile) return window.HazMatIQ.openHazardProfile(result, { sourcePage: 'incident' });
    return legacyApi()?.showView?.('lookup', { preserveHazardState: true, sourcePage: 'incident' });
  }

  function updateIncidentField(field, value) {
    const api = legacyApi();
    const incident = api?.getActiveIncident?.();
    if (!incident || !api?.readIncidents || !api?.writeIncidents) return null;
    const incidents = api.readIncidents();
    const index = incidents.findIndex((item) => item.incidentId === incident.incidentId);
    if (index < 0) return null;
    incidents[index] = { ...incidents[index], [field]: value, updatedAt: new Date().toISOString() };
    api.writeIncidents(incidents);
    api.renderIncidentLists?.();
    setActiveIncidentState(incidents[index]);
    return incidents[index];
  }

  function refreshIncidentCommand({ renderLegacy = false } = {}) {
    const api = legacyApi();
    if (renderLegacy) api?.renderIncidentCommandDashboard?.();
    const state = setActiveIncidentState(api?.getActiveIncident?.());
    if (!state) return null;
    renderIncidentBrief(state);
    renderOperationalStatus(state);
    renderPlumeSummary(state);
    renderCommandActions(state);
    return state;
  }

  function bindIncidentCommandEvents() {
    const root = document.getElementById('incident');
    if (!root || initialized) return;
    window.addEventListener('hazmatiq:incident-command-updated', () => refreshIncidentCommand());
    initialized = true;
    root.dataset.lifecycleInitialized = 'true';
  }

  function initializeIncidentCommand(context = {}) {
    bindIncidentCommandEvents();
    const root = document.getElementById('incident');
    if (root) root.dataset.lifecycleContext = context.sourcePage || 'navigation';
    refreshIncidentCommand({ renderLegacy: true });
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.normalizeIncidentState = normalizeIncidentState;
  window.HazMatIQ.buildIcsPrefill = buildIcsPrefill;
  window.HazMatIQ.getActiveIncidentState = getActiveIncidentState;
  window.HazMatIQ.updateIncidentField = updateIncidentField;
  window.HazMatIQ.refreshIncidentCommand = refreshIncidentCommand;
  window.HazMatIQ.initializeIncidentCommand = initializeIncidentCommand;
  window.HazMatIQ.incidentCommand = {
    initializeIncidentCommand,
    normalizeIncidentState,
    buildIcsPrefill,
    getActiveIncidentState,
    renderIncidentBrief,
    renderOperationalStatus,
    renderPlumeSummary,
    renderCommandActions,
    updateIncidentField,
    refreshIncidentCommand,
    bindIncidentCommandEvents,
    propagateHazardToIncident,
    openChemicalProfile,
  };
  if (document.getElementById('incident')?.classList.contains('active')) initializeIncidentCommand();
})();
