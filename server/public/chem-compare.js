(function initializeChemCompare() {
  'use strict';

  const NO_DATA = 'No Current Data Exists';
  const REQUIRES_REVIEW = 'Requires Review';
  const BLOCKED_PPE = 'Blocked Pending Verified Chemical Link';
  const ALLOWED_PPE_LABELS = new Set([
    'Vapor Protective Level A w/ SCBA',
    'Level B w/ SCBA',
    'Level C w/ APR — Appropriate Cartridge Required',
    'Level D — No Chemical Protection Required',
    'Requires IC / HazMat Specialist Review',
    NO_DATA,
    BLOCKED_PPE,
  ]);
  const EMPTY_VALUE = /^(?:n\/?a|not available|not established|null|undefined|unknown|no current data exists|not listed by current source|data unavailable from current source|not in (?:the )?.+dataset)$/i;

  const searchInput = document.getElementById('chemcompare-search');
  const selector = document.getElementById('chemcompare-selector');
  const selectorTitle = document.getElementById('chemcompare-selector-title');
  const selectorContext = document.getElementById('chemcompare-selector-context');
  const suggestions = document.getElementById('chemcompare-search-suggestions');
  const searchStatus = document.getElementById('chemcompare-search-status');
  const baseSummary = document.getElementById('chemcompare-base-summary');
  const secondSummary = document.getElementById('chemcompare-second-summary');
  const results = document.getElementById('chemcompare-results');
  let baseComparison = null;
  let secondComparison = null;
  let selectionTarget = 'second';
  let compareTrigger = null;
  let searchTimer = null;
  let latestSearch = 0;

  function valueAt(source, path) {
    return path.split('.').reduce((value, key) => value?.[key], source);
  }

  function valueItems(value) {
    if (Array.isArray(value)) return value.flatMap(valueItems);
    if (value && typeof value === 'object') {
      if ('value' in value) {
        const detail = [value.value, value.units, value.duration].filter(Boolean).join(' ');
        return detail ? [detail] : [];
      }
      return Object.entries(value).flatMap(([key, item]) => valueItems(item).map((text) => `${key}: ${text}`));
    }
    const text = String(value ?? '').trim();
    if (/^[\[{]/.test(text)) {
      try {
        return valueItems(JSON.parse(text));
      } catch {
        // Preserve non-JSON source text that happens to begin with a bracket.
      }
    }
    return text && !EMPTY_VALUE.test(text) ? [text] : [];
  }

  function firstValue(source, paths) {
    for (const path of paths) {
      const items = valueItems(valueAt(source, path));
      if (items.length) return items.join(' · ');
    }
    return NO_DATA;
  }

  function uniqueValues(values) {
    return [...new Map(values.flatMap(valueItems).map((value) => [value.toLowerCase(), value])).values()];
  }

  function reviewedValue(value, requiresReview) {
    if (value === NO_DATA) return value;
    return requiresReview ? REQUIRES_REVIEW : value;
  }

  function sourceBackedHazards(source, requiresReview) {
    const sourceValues = uniqueValues([
      valueAt(source, 'profile.header.hazard'),
      valueAt(source, 'profile.fire.flammability'),
      valueAt(source, 'profile.reactivity.waterReactivity'),
      valueAt(source, 'profile.reactivity.oxidizerReducerConcerns'),
      valueAt(source, 'hazardOverview'),
      valueAt(source, 'hazards'),
      valueAt(source, 'hazardClass'),
      valueAt(source, 'cameo.hazards'),
      valueAt(source, 'nfpa704.special'),
      valueAt(source, 'profile.header.nfpa704.special'),
    ]);
    if (!sourceValues.length) return [NO_DATA];
    if (requiresReview) return [REQUIRES_REVIEW];

    const joined = sourceValues.join(' · ');
    const labels = [
      [/corros/i, 'Corrosive'],
      [/\btoxic|poison/i, 'Toxic'],
      [/inhalation hazard|toxic by inhalation|\bTIH\b/i, 'Inhalation Hazard'],
      [/flammab|combustible/i, 'Flammable'],
      [/oxidiz/i, 'Oxidizer'],
      [/water[- ]react|reacts? (?:violently )?with water/i, 'Water Reactive'],
      [/gas under pressure|compressed gas|liquefied gas/i, 'Gas Under Pressure'],
      [/environmental hazard|aquatic toxic/i, 'Environmental Hazard'],
    ].filter(([pattern]) => pattern.test(joined)).map(([, label]) => label);
    return labels.length ? labels : sourceValues;
  }

  function aeglValues(source, requiresReview) {
    const direct = uniqueValues([
      valueAt(source, 'aegl'),
      valueAt(source, 'aeglValues'),
      valueAt(source, 'exposures.aegl'),
      valueAt(source, 'exposureLimits.aegl'),
      valueAt(source, 'profile.aegl'),
      valueAt(source, 'profile.aeglValues'),
      valueAt(source, 'profile.exposures.aegl'),
      valueAt(source, 'profile.exposureLimits.aegl'),
    ]);
    const monitoring = uniqueValues([valueAt(source, 'profile.exposures.monitoringConcerns')])
      .filter((value) => /AEGL[-_ ]?[123]|\bAEGL\b/i.test(value));
    const values = uniqueValues([...direct, ...monitoring]);
    if (!values.length) return [NO_DATA];
    return requiresReview ? [REQUIRES_REVIEW] : values;
  }

  function isolationValues(source, requiresReview) {
    const initial = firstValue(source, [
      'profile.isolationErg.initialIsolationDistance',
      'erg.initialIsolation',
      'isolationDistances.initialIsolation',
    ]);
    const protective = firstValue(source, [
      'profile.isolationErg.protectiveActionDistance',
      'erg.protectiveAction',
      'isolationDistances.protectiveAction',
      'protectiveActionDistances',
    ]);
    const dayNight = firstValue(source, [
      'profile.isolationErg.dayNightValues',
      'isolationDistances.dayNightValues',
    ]);
    const values = [
      initial !== NO_DATA && `Initial isolation: ${initial}`,
      protective !== NO_DATA && `Protective action: ${protective}`,
      dayNight !== NO_DATA && `Day / night: ${dayNight}`,
    ].filter(Boolean);
    if (!values.length) return [NO_DATA];
    return requiresReview ? [REQUIRES_REVIEW] : values;
  }

  function getChemicalCompareData(chemical) {
    const source = chemical || {};
    const profile = source.profile || source.record?.profile || {};
    const record = source.record || source;
    const selected = source.chemical || source;
    const chemicalId = selected.masterChemicalId ?? selected.selectedChemicalId ?? selected.ChemicalID ?? selected.id ?? null;
    const sourceStatus = String(source.sourceStatus || selected.sourceStatus || '').trim();
    const requiresReview = source.requiresReview === true
      || /requires review|unresolved|transportation-identifier/i.test(`${sourceStatus} ${selected.recordType || ''}`)
      || selected.guidanceEligible === false
      || chemicalId === null
      || String(chemicalId).startsWith('transport-');
    const wrapped = { ...record, ...selected, ...source, profile };
    const ppeObject = profile.ppeRecommendation || source.ppeRecommendation || record.ppeRecommendation;
    let ppeLevel = requiresReview
      ? BLOCKED_PPE
      : String(ppeObject?.displayLabel || '').trim() || NO_DATA;
    if (!ALLOWED_PPE_LABELS.has(ppeLevel)) ppeLevel = REQUIRES_REVIEW;

    const specificGravity = firstValue(wrapped, [
      'specificGravity', 'specific_gravity', 'properties.specificGravity',
      'physicalProperties.specificGravity', 'profile.properties.specificGravity',
    ]);
    const vaporDensity = firstValue(wrapped, [
      'vaporDensity', 'vapor_density', 'properties.vaporDensity',
      'physicalProperties.vaporDensity', 'profile.properties.vaporDensity',
    ]);
    const idlh = firstValue(wrapped, [
      'idlh', 'IDLH', 'exposure.idlh', 'exposureLimits.idlh', 'niosh.idlh',
      'profile.exposures.idlh', 'profile.header.idlh',
    ]);
    const waterReactivity = firstValue(wrapped, [
      'waterReactivity', 'water_reactivity', 'reactivity.water', 'cameo.reactivity.water',
      'specialHazards.waterReactive', 'nfpa704.special', 'profile.reactivity.waterReactivity',
      'profile.header.nfpa704.special',
    ]);
    const sourceValues = (paths) => uniqueValues(paths.map((path) => valueAt(wrapped, path)));

    return {
      chemicalId,
      chemicalName: firstValue(wrapped, ['profile.header.name', 'chemicalName', 'ChemicalName', 'name']),
      sourceStatus: requiresReview ? REQUIRES_REVIEW : (sourceStatus || 'Verified Chemical Companion Master Record'),
      identifiers: {
        cas: firstValue(wrapped, ['profile.header.cas', 'identifiers.cas', 'CasNumber', 'cas']),
        unNa: firstValue(wrapped, ['profile.header.un', 'identifiers.unNa', 'unNa', 'UnnaNumber', 'un']),
        ergGuide: firstValue(wrapped, ['profile.header.ergGuide', 'identifiers.ergGuide', 'ErgNumber', 'ergGuide']),
      },
      nfpa704: profile.header?.nfpa704 || source.nfpa704 || null,
      specificHazards: sourceBackedHazards(wrapped, requiresReview),
      specificGravity: reviewedValue(specificGravity, requiresReview),
      vaporDensity: reviewedValue(vaporDensity, requiresReview),
      hazardClass: reviewedValue(firstValue(wrapped, ['profile.header.hazardClass', 'profile.header.hazard', 'HazardClass', 'hazardClass']), requiresReview),
      physicalProperties: requiresReview ? [REQUIRES_REVIEW] : sourceValues([
        'profile.properties.physicalState', 'profile.properties.appearance', 'profile.properties.boilingPoint',
        'profile.properties.vaporPressure', 'profile.properties.waterSolubility',
      ]),
      aeglLevels: aeglValues(wrapped, requiresReview),
      idlh: reviewedValue(idlh, requiresReview),
      exposureLimits: requiresReview ? [REQUIRES_REVIEW] : sourceValues([
        'profile.exposures.oshaPel', 'profile.exposures.nioshRel', 'profile.exposures.acgihTlv',
        'profile.exposures.exposureLimits',
      ]),
      ppeLevel,
      respiratoryProtection: reviewedValue(firstValue(wrapped, [
        'profile.ppeRecommendation.respiratoryProtection', 'profile.ppeRespiratory.respiratoryProtection',
        'profile.ppeRespiratory.respiratory',
      ]), requiresReview),
      monitoringDetection: requiresReview ? [REQUIRES_REVIEW] : sourceValues([
        'profile.detectors.items', 'profile.detectors.monitoring', 'profile.exposures.monitoringConcerns',
      ]),
      waterReactivity: reviewedValue(waterReactivity, requiresReview),
      reactivity: requiresReview ? [REQUIRES_REVIEW] : sourceValues([
        'profile.reactivity.chemicalMixtureReactivity', 'profile.reactivity.incompatibleMaterials',
        'profile.reactivity.polymerization',
      ]),
      isolationDistances: isolationValues(wrapped, requiresReview),
      medicalConsiderations: requiresReview ? [REQUIRES_REVIEW] : sourceValues([
        'profile.medical.firstAid', 'profile.medical.emsConsiderations', 'profile.medical.treatment',
      ]),
      fireResponse: requiresReview ? [REQUIRES_REVIEW] : sourceValues([
        'profile.fire.extinguishingMedia', 'profile.fire.firefightingProcedures', 'profile.response.fire',
      ]),
      deconGuidance: requiresReview ? [REQUIRES_REVIEW] : sourceValues([
        'profile.decon.guidance', 'profile.decon.emergencyDecon', 'profile.decon.technicalDecon',
        'profile.decon.personalDecon',
      ]),
      limitations: requiresReview
        ? ['Unresolved transport identifiers cannot drive PPE or safety guidance.']
        : uniqueValues([ppeObject?.limitations]),
    };
  }

  window.HazMatIQ = window.HazMatIQ || {};
  window.HazMatIQ.getChemicalCompareData = getChemicalCompareData;

  function setSearchStatus(message, state = '') {
    if (!searchStatus) return;
    searchStatus.textContent = message;
    searchStatus.dataset.state = state;
  }

  function clearSuggestions() {
    suggestions?.replaceChildren();
    if (suggestions) suggestions.hidden = true;
    searchInput?.setAttribute('aria-expanded', 'false');
  }

  function createText(tag, text, className = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function renderNfpaMini(data) {
    const nfpa = data.nfpa704;
    if (!nfpa || !['health', 'flammability', 'instability', 'special'].some((key) => valueItems(nfpa[key]).length)) return null;
    const figure = document.createElement('figure');
    figure.className = 'chemcompare-nfpa';
    figure.setAttribute('aria-label', `NFPA 704 for ${data.chemicalName}`);
    figure.append(createText('figcaption', 'NFPA 704'));
    const diamond = document.createElement('div');
    diamond.className = 'chemcompare-nfpa-diamond';
    [['flammability', 'fire'], ['instability', 'reactivity'], ['health', 'health'], ['special', 'special']].forEach(([key, className]) => {
      const cell = document.createElement('span');
      cell.className = `chemcompare-nfpa-cell ${className}`;
      cell.append(createText('b', valueItems(nfpa[key])[0] || '—'));
      diamond.append(cell);
    });
    figure.append(diamond);
    return figure;
  }

  function renderChips(values) {
    const row = document.createElement('div');
    row.className = 'chemcompare-chip-row';
    values.forEach((value) => row.append(createText('span', value, 'chemcompare-chip')));
    return row;
  }

  function renderSummary(container, data, emptyText) {
    if (!container) return;
    container.replaceChildren();
    if (!data) {
      container.append(createText('p', emptyText, 'chemcompare-empty'));
      return;
    }
    const heading = document.createElement('div');
    heading.className = 'chemcompare-summary-heading';
    const title = createText('h3', data.chemicalName);
    const nfpa = renderNfpaMini(data);
    heading.append(title);
    if (nfpa) heading.append(nfpa);
    const identifiers = document.createElement('dl');
    identifiers.className = 'chemcompare-identifiers';
    [['CAS', data.identifiers.cas], ['UN/NA', data.identifiers.unNa], ['ERG Guide', data.identifiers.ergGuide], ['Source Status', data.sourceStatus]]
      .forEach(([label, value]) => identifiers.append(createText('dt', label), createText('dd', value)));
    container.append(heading, identifiers, renderChips(data.specificHazards));
    const ppe = document.createElement('p');
    ppe.className = 'chemcompare-summary-ppe';
    ppe.append(createText('strong', 'PPE: '), document.createTextNode(data.ppeLevel));
    container.append(ppe);
  }

  const compareRows = [
    ['hazardClass', 'Hazard Class'],
    ['specificHazards', 'Specific Hazard'],
    ['specificGravity', 'Specific Gravity'],
    ['vaporDensity', 'Vapor Density'],
    ['physicalProperties', 'Physical Properties'],
    ['aeglLevels', 'AEGL Levels'],
    ['idlh', 'IDLH'],
    ['exposureLimits', 'Exposure Limits'],
    ['ppeLevel', 'Level of PPE'],
    ['respiratoryProtection', 'Respiratory Protection'],
    ['monitoringDetection', 'Monitoring & Detection'],
    ['waterReactivity', 'Water Reactivity'],
    ['reactivity', 'Reactivity'],
    ['isolationDistances', 'Isolation Distances'],
    ['medicalConsiderations', 'Medical Considerations'],
    ['fireResponse', 'Fire Response'],
    ['deconGuidance', 'DECON Guidance'],
  ];

  function comparisonSignature(value) {
    return valueItems(value).map((item) => item.toLowerCase()).sort().join('|');
  }

  function renderCompareValue(value, title, different) {
    const cell = document.createElement('div');
    cell.className = `chemcompare-value${different ? ' is-different' : ''}`;
    cell.append(createText('div', title, 'chemcompare-value-title'));
    const values = valueItems(value);
    if (values.length > 1 || title === 'Specific Hazard') cell.append(renderChips(values.length ? values : [NO_DATA]));
    else cell.append(createText('div', values[0] || NO_DATA, 'chemcompare-value-main'));
    if (different) cell.append(createText('span', 'Different', 'chemcompare-difference-badge'));
    return cell;
  }

  function renderResults() {
    if (!results) return;
    results.replaceChildren();
    if (!baseComparison || !secondComparison) {
      results.append(createText('p', 'Select a second chemical to display the side-by-side comparison.', 'chemcompare-results-empty'));
      return;
    }
    compareRows.forEach(([key, label]) => {
      const row = document.createElement('article');
      row.className = 'chemcompare-row';
      row.dataset.field = key;
      const different = comparisonSignature(baseComparison[key]) !== comparisonSignature(secondComparison[key]);
      row.append(
        renderCompareValue(baseComparison[key], baseComparison.chemicalName, different),
        createText('div', label, 'chemcompare-label'),
        renderCompareValue(secondComparison[key], secondComparison.chemicalName, different),
      );
      results.append(row);
    });
  }

  async function loadComparisonChemical(chemical) {
    const candidateId = chemical.selectedChemicalId ?? chemical.ChemicalID ?? chemical.id;
    const otherChemical = selectionTarget === 'base' ? secondComparison : baseComparison;
    if (otherChemical && String(candidateId) === String(otherChemical.chemicalId)) {
      setSearchStatus('Choose a different chemical for comparison.', 'error');
      return;
    }
    let loadedComparison;
    if (isUnreviewedTransportationRecord(chemical)) {
      loadedComparison = getChemicalCompareData({ chemical, sourceStatus: REQUIRES_REVIEW, requiresReview: true });
    } else {
      const chemicalId = chemical.selectedChemicalId ?? chemical.ChemicalID ?? chemical.id;
      setSearchStatus(`Loading ${chemical.name || chemical.ChemicalName || 'chemical'}…`, 'loading');
      const record = await buildFullChemicalRecord(chemical);
      const params = new URLSearchParams();
      if (chemical.UnnaNumber && chemical.UnnaNumber !== 'Not available') params.set('identifier', chemical.UnnaNumber);
      if (chemical.ProperShippingName) params.set('shippingName', chemical.ProperShippingName);
      const profileResponse = await fetchJson(`/api/chemicals/${encodeURIComponent(chemicalId)}/profile${params.size ? `?${params}` : ''}`);
      const profile = profileResponse && !profileResponse.error ? profileResponse : null;
      loadedComparison = getChemicalCompareData({
        chemical,
        record: profile ? { ...record, profile } : record,
        profile,
        sourceStatus: chemical.sourceStatus || 'Verified Chemical Companion Master Record',
      });
    }
    if (selectionTarget === 'base') baseComparison = loadedComparison;
    else secondComparison = loadedComparison;
    if (searchInput) searchInput.value = loadedComparison.chemicalName;
    clearSuggestions();
    setSearchStatus('');
    selector?.close();
    renderSummary(baseSummary, baseComparison, NO_DATA);
    renderSummary(secondSummary, secondComparison, 'Search for a second chemical.');
    renderResults();
    if (baseComparison && secondComparison) {
      if (window.history.state?.hazardPageState !== 'compare') {
        window.history.pushState({ ...window.history.state, hazardPageState: 'compare' }, '');
      }
      showView('chem-compare');
    }
  }

  async function searchComparisonChemicals(value) {
    const query = normalizeChemicalQuery(value);
    if (!query) return;
    const requestId = ++latestSearch;
    const data = await fetchJson(`/api/chemicals/search?q=${encodeURIComponent(query)}`);
    if (requestId !== latestSearch || !suggestions) return;
    const chemicals = (data?.chemicals || []).map(companionChemicalForUi);
    suggestions.replaceChildren();
    chemicals.slice(0, 8).forEach((chemical) => {
      suggestions.append(createSuggestion(
        chemical.resultType || (isUnreviewedTransportationRecord(chemical) ? 'Transportation Identifier — Requires Review' : 'Chemical Companion Master'),
        chemical.name,
        chemicalSearchDetail(chemical),
        () => void loadComparisonChemical(chemical),
        {
          identifiers: chemicalSearchIdentifiers(chemical),
          warning: isUnreviewedTransportationRecord(chemical) ? chemical.reviewWarning : '',
        },
      ));
    });
    suggestions.hidden = chemicals.length === 0;
    searchInput?.setAttribute('aria-expanded', String(chemicals.length > 0));
    setSearchStatus(chemicals.length
      ? `${chemicals.length} chemical match${chemicals.length === 1 ? '' : 'es'}.`
      : 'No matching chemicals found.', chemicals.length ? '' : 'error');
  }

  function openSelector(target = 'second', trigger = null) {
    selectionTarget = target;
    compareTrigger = trigger || document.activeElement;
    const replacingBase = target === 'base';
    if (selectorTitle) selectorTitle.textContent = replacingBase ? 'Replace Chemical A' : (secondComparison ? 'Replace Chemical B' : 'Select a second chemical');
    const retained = replacingBase ? secondComparison : baseComparison;
    if (selectorContext) selectorContext.textContent = retained
      ? `${retained.chemicalName} will remain in the comparison. Choose a different chemical.`
      : 'Choose a different chemical to begin comparison.';
    if (searchInput) searchInput.value = '';
    clearSuggestions();
    setSearchStatus('');
    if (selector?.showModal) selector.showModal();
    else selector?.setAttribute('open', '');
    window.requestAnimationFrame(() => searchInput?.focus({ preventScroll: true }));
  }

  function closeSelector() {
    clearSuggestions();
    setSearchStatus('');
    selector?.close();
    compareTrigger?.focus?.({ preventScroll: true });
  }

  function openChemCompare(baseChemical = null, trigger = null) {
    if (!baseChemical && (!activeChemical || !activeChemicalRecord)) return;
    baseComparison = baseChemical
      ? getChemicalCompareData({ chemical: baseChemical, sourceStatus: REQUIRES_REVIEW, requiresReview: true })
      : getChemicalCompareData({
        chemical: activeChemical,
        record: activeChemicalRecord,
        profile: activeChemicalRecord.profile,
        sourceStatus: 'Verified Chemical Companion Master Record',
      });
    secondComparison = null;
    openSelector('second', trigger);
  }

  window.HazMatIQ.openChemCompareWithBase = openChemCompare;
  document.getElementById('open-chemcompare-btn')?.addEventListener('click', (event) => openChemCompare(null, event.currentTarget));
  document.getElementById('chemcompare-cancel-btn')?.addEventListener('click', closeSelector);
  document.getElementById('chemcompare-back-btn')?.addEventListener('click', () => {
    secondComparison = null;
    showView('lookup');
    document.getElementById('open-chemcompare-btn')?.focus({ preventScroll: true });
    if (window.history.state?.hazardPageState === 'compare') window.history.back();
  });
  document.getElementById('chemcompare-search-back-btn')?.addEventListener('click', () => {
    secondComparison = null;
    showView('lookup');
    setHazardProfileMode('search');
    document.getElementById('chemical-search')?.focus({ preventScroll: true });
    if (window.history.state?.hazardPageState === 'compare') window.history.go(-2);
  });
  document.getElementById('chemcompare-replace-base-btn')?.addEventListener('click', (event) => openSelector('base', event.currentTarget));
  document.getElementById('chemcompare-replace-second-btn')?.addEventListener('click', (event) => openSelector('second', event.currentTarget));
  document.getElementById('chemcompare-swap-btn')?.addEventListener('click', () => {
    [baseComparison, secondComparison] = [secondComparison, baseComparison];
    renderSummary(baseSummary, baseComparison, NO_DATA);
    renderSummary(secondSummary, secondComparison, NO_DATA);
    renderResults();
  });
  document.getElementById('chemcompare-print-btn')?.addEventListener('click', () => window.print());
  selector?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSelector();
  });
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      latestSearch += 1;
      clearSuggestions();
      setSearchStatus('');
      return;
    }
    searchTimer = window.setTimeout(() => void searchComparisonChemicals(query), 200);
  });
  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      clearSuggestions();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      suggestions?.querySelector('.chemical-suggestion-select')?.click();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.chemcompare-search-wrap')) clearSuggestions();
  });
})();
