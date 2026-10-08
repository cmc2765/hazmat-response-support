/* Hazard ID / Profile ownership. Legacy renderers stay behind the explicit
   bridge until their domain-specific sections can be split safely. */
(() => {
  let initialized = false;
  let activeProfileState = null;

  function legacyApi() {
    return window.HazMatIQ?.hazardProfileLegacy;
  }

  function firstValue(...values) {
    for (const value of values.flat(Infinity)) {
      if (value !== null && value !== undefined && String(value).trim()) return value;
    }
    return null;
  }

  function normalizeSearchResult(result, lane = result?.lane || result?.routingLane || 'CHEMICAL') {
    const source = result && typeof result === 'object' ? result : {};
    const routingLane = String(lane || 'CHEMICAL').toUpperCase();
    const isHazard = routingLane !== 'CHEMICAL';
    const canonicalId = firstValue(
      isHazard ? source.id : source.selectedChemicalId,
      isHazard ? source.cbrneCanonicalId : source.ChemicalID,
      isHazard ? null : source.companionId,
      isHazard ? null : source.chemicalCompanionId,
      source.id,
    );
    const identifiers = source.identifiers && typeof source.identifiers === 'object' ? source.identifiers : {};
    const rawSourceState = firstValue(
      source.sourceState,
      source.sourceStatus,
      source.reviewStatus,
      source.verificationStatus,
      source.guidanceEligible === false ? 'Requires Review' : 'Verified',
    );
    const sourceState = rawSourceState && typeof rawSourceState === 'object'
      ? firstValue(rawSourceState.status, rawSourceState.state, rawSourceState.label, rawSourceState.verificationStatus)
      : rawSourceState;
    return {
      profileType: isHazard ? 'hazard' : 'chemical',
      canonicalId: canonicalId === null ? null : String(canonicalId),
      displayName: firstValue(source.displayName, source.name, source.ChemicalName, source.scientificName) || 'Unknown hazard',
      chemicalCompanionId: isHazard
        ? firstValue(source.chemicalCompanionId, source.masterChemicalId)
        : firstValue(source.selectedChemicalId, source.ChemicalID, source.companionId, source.chemicalCompanionId, source.id),
      cbrneCanonicalId: isHazard ? firstValue(source.cbrneCanonicalId, source.id) : null,
      cas: firstValue(source.CasNumber, source.cas, identifiers.cas, identifiers.casNumber),
      un: firstValue(source.UnnaNumber, source.un, identifiers.un, identifiers.unNaNumbers),
      erg: firstValue(source.erg, source.ergGuide, source.ErgNumber, identifiers.erg, identifiers.ergGuide),
      category: firstValue(source.category, source.family, source.domain, source.HazardClass) || 'Unknown',
      routingLane,
      sourceState: String(sourceState || 'Requires Review'),
      raw: source,
    };
  }

  function setActiveHazardState(result, { profile = null, record = null, status = 'ready' } = {}) {
    if (!result) {
      activeProfileState = null;
      window.HazMatIQ.activeHazard = null;
      window.HazMatIQ.activeProfileState = null;
      return null;
    }
    const normalized = result?.profileType && result?.raw ? result : normalizeSearchResult(result);
    const profileHeader = profile?.header || record?.profile?.header || {};
    activeProfileState = Object.freeze({
      ...normalized,
      cas: firstValue(normalized.cas, profileHeader.cas, record?.cas),
      un: firstValue(normalized.un, profileHeader.un, record?.un),
      erg: firstValue(normalized.erg, profileHeader.ergGuide, record?.ergGuide),
      idlh: firstValue(record?.idlh, profile?.exposures?.idlh, profileHeader.idlh),
      nioshSourceId: firstValue(record?.nioshSourceId, profile?.niosh?.sourceRecordId),
      nioshIdentityStatus: firstValue(record?.nioshIdentityStatus, profile?.niosh?.status),
      profile, record, status,
    });
    window.HazMatIQ.activeHazard = activeProfileState;
    window.HazMatIQ.activeProfileState = activeProfileState;
    return activeProfileState;
  }

  function getActiveHazardState() {
    return activeProfileState;
  }

  function normalizeProfileForUi(profile, fallback = {}) {
    return legacyApi()?.normalizeProfileForUi?.(profile, fallback) || null;
  }

  async function openHazardProfile(result, { facilityName = '', sourcePage = 'hazard-id' } = {}) {
    const normalized = normalizeSearchResult(result);
    if (!normalized.canonicalId) return null;
    setActiveHazardState(normalized, { status: 'loading' });
    const lookup = document.getElementById('lookup');
    if (lookup) lookup.dataset.profileReturnView = sourcePage === 'incident' ? 'incident' : 'lookup';
    if (lookup && !lookup.classList.contains('active')) {
      window.HazMatIQ.activatePage?.('lookup', { preserveHazardState: true, sourcePage });
    }
    const api = legacyApi();
    if (!api) return null;
    if (normalized.profileType === 'hazard') return api.openStarterHazard(normalized.raw);
    const legacyChemical = {
      ...normalized.raw,
      selectedChemicalId: normalized.chemicalCompanionId || normalized.canonicalId,
      ChemicalID: normalized.chemicalCompanionId || normalized.canonicalId,
      ChemicalName: normalized.raw.ChemicalName || normalized.raw.name || normalized.displayName,
      name: normalized.raw.name || normalized.raw.ChemicalName || normalized.displayName,
    };
    return api.openChemical(legacyChemical, facilityName);
  }

  function selectProfileTab(button) {
    const state = getActiveHazardState();
    const api = legacyApi();
    if (!button || !state || !api) return;
    if (button.closest('#chemical-profile-tabs')) {
      const profile = api.normalizeProfileForUi?.(state.profile) || state.profile || {};
      api.renderChemicalProfile({ ...profile, activeTab: button.dataset.tab });
      return;
    }
    if (!button.closest('#hazard-profile-tabs')) return;
    let fields;
    try {
      fields = JSON.parse(button.dataset.profileFields || '[]');
    } catch {
      return;
    }
    button.parentElement?.querySelectorAll('button').forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    const profile = api.normalizeProfileForUi?.(state.profile) || state.profile || {};
    api.renderStarterHazardTab(profile, fields);
  }

  function initializeHazardProfilePage(context = {}) {
    const root = document.getElementById('lookup');
    if (!root) return;
    if (!initialized) {
      root.addEventListener('click', (event) => {
        const button = event.target.closest('#chemical-profile-tabs [data-tab], #hazard-profile-tabs [data-profile-fields]');
        if (button) selectProfileTab(button);
      });
      initialized = true;
      root.dataset.lifecycleInitialized = 'true';
    }
    root.dataset.lifecycleContext = context.sourcePage || 'navigation';
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.normalizeHazardSearchResult = normalizeSearchResult;
  window.HazMatIQ.normalizeProfileForUi = normalizeProfileForUi;
  window.HazMatIQ.setActiveHazardState = setActiveHazardState;
  window.HazMatIQ.getActiveHazardState = getActiveHazardState;
  window.HazMatIQ.openHazardProfile = openHazardProfile;
  window.HazMatIQ.initializeHazardProfilePage = initializeHazardProfilePage;
  if (document.getElementById('lookup')?.classList.contains('active')) initializeHazardProfilePage();
})();
