(function registerGuidedResponseDecisionBuilder(global) {
  'use strict';

  const NO_DATA = 'No Current Data Exists';
  const REVIEW = 'Requires IC / HazMat Specialist Review';
  const EXECUTION_NOTE = 'Incident Command approval required before entry or mitigation.';
  const MITIGATION_EXECUTION_NOTE = 'Final mitigation strategy must be approved by Incident Command.';
  const APPROVED_SOURCES = ['Chemical Companion', 'ERG', 'NIOSH', 'CAMEO'];

  function text(value) {
    const normalized = String(value ?? '').trim();
    return !normalized || /^(?:n\/?a|not available|null|undefined|no current data exists)$/i.test(normalized)
      ? ''
      : normalized;
  }

  function values(value) {
    return (Array.isArray(value) ? value.flat(Infinity) : [value]).map(text).filter(Boolean);
  }

  function unique(value) {
    return [...new Set(values(value))];
  }

  function canonicalSource(value) {
    const source = text(value).replace(/^Linked\s+/i, '');
    if (/^Chemical Companion(?: Master)?$/i.test(source)) return 'Chemical Companion';
    if (/^ERG(?: 2024)?$/i.test(source) || /PHMSA ERG/i.test(source)) return 'ERG';
    if (/^NIOSH(?: NPG)?$/i.test(source) || /NIOSH Pocket Guide/i.test(source)) return 'NIOSH';
    if (/^CAMEO(?: Chemicals)?$/i.test(source)) return 'CAMEO';
    return '';
  }

  function approvedSources(linkedSources) {
    const sourceLinks = Array.isArray(linkedSources?.profile?.sourceLinks) ? linkedSources.profile.sourceLinks : [];
    const safetyRecords = Array.isArray(linkedSources?.profile?.safetyCritical?.records) ? linkedSources.profile.safetyCritical.records : [];
    return [...new Set([
      'Chemical Companion',
      ...values(linkedSources?.approvedSources),
      ...sourceLinks.map((item) => item?.sourceName),
      ...safetyRecords.filter((item) => item?.approved !== false).map((item) => item?.sourceName),
    ].map(canonicalSource).filter(Boolean))];
  }

  function sourceSummary(sources, preferred) {
    const wanted = unique(preferred).map(canonicalSource).filter(Boolean);
    const matched = sources.filter((source) => !wanted.length || wanted.includes(source));
    return matched.length ? matched : ['Chemical Companion'];
  }

  function join(value) {
    const items = unique(value);
    return items.length ? items.join(' · ') : NO_DATA;
  }

  function directDecision({ status, primaryDecision, directGuidance, tacticalActions = [], specificValues = {}, missingData = [], sourceSummary: sources = [], limitations = [], confidence, requiresICApprovalForExecution = false }) {
    return {
      status,
      primaryDecision,
      directGuidance,
      tacticalActions: unique(tacticalActions),
      specificValues,
      missingData: unique(missingData),
      sourceSummary: unique(sources),
      limitations: unique(limitations),
      confidence: confidence || (missingData.length ? 'Incomplete — verification required' : 'Source-backed'),
      requiresICApprovalForExecution,
      executionNote: requiresICApprovalForExecution ? EXECUTION_NOTE : '',
    };
  }

  function buildLifeSafety(selectedChemical, linkedSources, sources) {
    const profile = linkedSources.profile || {};
    const recommendation = profile.ppeRecommendation || {
      selectedLevel: 'NO_CURRENT_DATA_EXISTS',
      displayLabel: NO_DATA,
      recommendationStatus: 'NO_CURRENT_DATA',
      respiratoryProtection: NO_DATA,
      skinProtection: NO_DATA,
      cartridgeRequirement: NO_DATA,
      scbaRequired: false,
      aprAllowed: false,
      levelCAllowed: false,
      levelCBlockedReason: 'No approved PPE recommendation object is available.',
      decisionReasons: [],
      verificationRequirements: ['Obtain approved chemical-specific PPE source data.'],
      sourcesReviewed: [],
      sourceConflicts: [],
      limitations: ['Missing PPE data is not guessed.'],
      generatedAt: new Date().toISOString(),
    };
    const scbaDecision = recommendation.scbaRequired
      ? 'SCBA MANDATED'
      : recommendation.selectedLevel === 'LEVEL_C_APR_APPROPRIATE_CARTRIDGE'
        ? 'SCBA NOT SELECTED — LEVEL C CONDITIONS VERIFIED'
        : recommendation.selectedLevel === 'LEVEL_D_NO_CHEMICAL_PROTECTION'
          ? 'NO CHEMICAL RESPIRATORY PROTECTION REQUIRED FOR VERIFIED TASK / AREA'
          : recommendation.displayLabel || NO_DATA;
    const protectionLevel = recommendation.displayLabel || NO_DATA;
    const cartridgeStatus = recommendation.scbaRequired
      ? 'Not displayed — SCBA is mandated.'
      : recommendation.cartridgeRequirement || NO_DATA;
    const requiredVerification = unique(recommendation.verificationRequirements);
    const missingData = ['NO_CURRENT_DATA_EXISTS', 'REQUIRES_REVIEW', 'BLOCKED_PENDING_VERIFIED_CHEMICAL_LINK'].includes(recommendation.selectedLevel)
      ? requiredVerification
      : [];
    const supportingSources = unique(recommendation.sourcesReviewed);
    const entryGuidance = recommendation.scbaRequired
      ? `Entry requires ${protectionLevel}. Do not downgrade based on plume output; resolve all listed verification requirements before entry.`
      : recommendation.levelCAllowed
        ? 'Level C remains conditional on continued air monitoring, adequate oxygen, concentration below limits, and verified cartridge suitability.'
        : 'Do not select Level C unless every atmospheric, monitoring, exposure-limit, and cartridge requirement is verified.';
    const directGuidance = `${protectionLevel}. ${recommendation.respiratoryProtection || NO_DATA} ${entryGuidance}`;

    const evidence = {
      chemicalName: text(selectedChemical.chemicalName) || NO_DATA,
      masterChemicalId: selectedChemical.masterChemicalId ?? null,
      scbaDecision,
      protectionLevel,
      sourceBacked: recommendation.recommendationStatus === 'SOURCE_BACKED_RECOMMENDATION',
      supportingSources,
      sourceFactsUsed: unique(recommendation.decisionReasons),
      triggerReasons: unique(recommendation.decisionReasons),
      idlhValue: text(profile.exposures?.idlh) || NO_DATA,
      idlhSource: text(profile.exposures?.idlh) ? 'Chemical Companion / linked NIOSH data' : NO_DATA,
      respiratoryBasis: recommendation.respiratoryProtection || NO_DATA,
      skinVaporBasis: recommendation.skinProtection || NO_DATA,
      levelCAllowed: Boolean(recommendation.levelCAllowed),
      levelCBlockedReason: recommendation.levelCBlockedReason || '',
      requiredVerification,
      limitations: unique(recommendation.limitations),
      ppeRecommendation: recommendation,
      executionNote: EXECUTION_NOTE,
      generatedAt: recommendation.generatedAt || new Date().toISOString(),
    };

    return {
      decision: directDecision({
        status: recommendation.recommendationStatus || REVIEW,
        primaryDecision: protectionLevel,
        directGuidance,
        tacticalActions: [entryGuidance],
        specificValues: {
          scbaDecision,
          protectionLevel,
          recommendedProtectionLevel: protectionLevel,
          whySelected: unique(recommendation.decisionReasons),
          requiredVerification,
          cartridgeStatus,
          levelCAllowed: Boolean(recommendation.levelCAllowed),
          levelCBlockedReason: recommendation.levelCBlockedReason || '',
          downgradeConditions: requiredVerification,
        },
        missingData,
        sourceSummary: supportingSources,
        limitations: evidence.limitations,
        confidence: recommendation.recommendationStatus === 'SOURCE_BACKED_RECOMMENDATION'
          ? 'Source-backed'
          : recommendation.displayLabel || NO_DATA,
        requiresICApprovalForExecution: true,
      }),
      evidence,
    };
  }

  function buildVerifyIsolate(linkedSources, plumeState, weatherState, sources) {
    const profile = linkedSources.profile || {};
    const isolation = profile.isolationErg || {};
    const ergGuide = text(isolation.ergGuide);
    const initialIsolation = text(isolation.initialIsolationDistance);
    const largeSpillIsolation = text(isolation.largeSpill);
    const protectiveAction = join(isolation.protectiveActionDistance);
    const dayNightProtectiveAction = join(isolation.protectiveActionDistance);
    const evacuationFacts = unique(linkedSources.responderGuide?.publicSafety?.evacuation)
      .filter((value) => /evacuat|shelter/i.test(value));
    const evacuationShelter = evacuationFacts.length ? evacuationFacts.join(' · ') : NO_DATA;
    const weatherStatus = text(weatherState?.status) || 'Requires Verification';
    const plumeStatus = values(plumeState?.missingInputs).length
      ? `Requires Verification: ${values(plumeState.missingInputs).join(', ')}`
      : (text(plumeState?.status) || 'Requires Verification');
    const endpointSelected = text(plumeState?.endpointSelected) || NO_DATA;
    const zoneMeaning = text(plumeState?.zoneMeaning) || NO_DATA;
    const plumeConfidence = text(plumeState?.confidenceLevel || plumeState?.confidenceStatus) || 'Insufficient Data';
    const missingData = [];
    if (!ergGuide) missingData.push('ERG guide');
    if (!initialIsolation) missingData.push('Initial isolation distance');
    if (protectiveAction === NO_DATA) missingData.push('Protective action distance');
    if (evacuationShelter === NO_DATA) missingData.push('Evacuation / shelter-in-place guidance');
    if (/(?:requires|needs) verification|manual|stale|recent/i.test(weatherStatus)) missingData.push('Current wind / weather verification');
    if (endpointSelected === NO_DATA) missingData.push('AEGL / LOC endpoint');
    if (/planning|insufficient|review|unvalidated/i.test(plumeConfidence)) missingData.push('Plume confidence / field verification');
    const primaryDecision = initialIsolation
      ? `Initial small-spill isolation: ${initialIsolation} in all directions${largeSpillIsolation ? `; large-spill isolation: ${largeSpillIsolation} in all directions` : ''}.`
      : protectiveAction !== NO_DATA
        ? `Use the verified protective action values: ${protectiveAction}.`
        : NO_DATA;
    const directGuidance = primaryDecision === NO_DATA
      ? 'No chemical-specific isolation or protective action value is verified in the current record.'
      : `${primaryDecision} ${protectiveAction !== NO_DATA ? `Protective action: ${protectiveAction}.` : 'Protective Action: No Current Data Exists.'} ${endpointSelected === NO_DATA ? 'No AEGL toxic endpoint is available.' : `Use ${endpointSelected} zones as planning estimates only.`} Verify wind direction and adjust the perimeter using field monitoring and Incident Command.`;

    return directDecision({
      status: primaryDecision,
      primaryDecision,
      directGuidance,
      tacticalActions: [
        primaryDecision === NO_DATA ? 'Verify approved-source distances before establishing a chemical-specific perimeter.' : 'Establish the verified perimeter and control access.',
        'Confirm the perimeter with air monitoring and visual conditions.',
      ],
      specificValues: {
        ergGuide: ergGuide || NO_DATA,
        initialIsolation: initialIsolation || NO_DATA,
        largeSpillIsolation: largeSpillIsolation || NO_DATA,
        protectiveAction,
        dayNightProtectiveAction,
        evacuationShelter,
        weatherStatus,
        plumeStatus,
        plumeConfidence,
        endpointSelected,
        zoneMeaning,
        fieldMonitoringRequirement: 'Required — confirm and adjust the perimeter using air monitoring and visual conditions.',
      },
      missingData,
      sourceSummary: sourceSummary(sources, ['Chemical Companion', 'ERG', 'CAMEO']),
      limitations: missingData.map((field) => `${field}: ${NO_DATA}`),
      requiresICApprovalForExecution: true,
    });
  }

  function buildMitigation(linkedSources, lifeSafety, plumeState, weatherState, sources) {
    const profile = linkedSources.profile || {};
    const spillFacts = unique([profile.spillResponse, profile.releaseControl, linkedSources.responderGuide?.emergencyResponse?.spillOrLeak]);
    const fireFacts = unique([profile.vaporControl, profile.fire?.firefightingPrecautions, linkedSources.responderGuide?.emergencyResponse?.fire]);
    const neutralizationFacts = unique(profile.neutralization);
    const runoffFacts = unique([
      profile.decon?.runoffContainment,
      spillFacts.filter((value) => /runoff|waterway|sewer|drain|environment/i.test(value)),
    ]);
    const vaporFacts = unique(spillFacts.filter((value) => /vapor|spray|fog|cloud|dispers/i.test(value)));
    const nonInterventionFacts = unique([
      profile.fire?.explosionHazards,
      spillFacts.filter((value) => /without risk|withdraw|do not|non-intervention/i.test(value)),
      fireFacts.filter((value) => /withdraw|do not|impossible|explode|rupture/i.test(value)),
    ]);
    const missingData = [];
    if (!spillFacts.length) missingData.push('Spill / release control');
    if (!neutralizationFacts.length) missingData.push('Neutralization');
    if (!fireFacts.length) missingData.push('Vapor / fire control');
    if (!runoffFacts.length) missingData.push('Environmental / runoff control');
    const defensiveTriggers = unique([
      missingData.length ? 'mitigation source data is incomplete' : '',
      lifeSafety.specificValues.scbaDecision === 'SCBA MANDATED' ? 'SCBA is mandated' : '',
      values(plumeState?.missingInputs).length ? 'plume inputs are incomplete' : '',
      /(?:requires|needs) verification|manual|stale|recent/i.test(text(weatherState?.status)) ? 'wind / weather is not verified' : '',
      !text(plumeState?.endpointSelected) ? 'AEGL / LOC endpoint is missing' : '',
      /planning|insufficient|review|unvalidated/i.test(text(plumeState?.confidenceLevel || plumeState?.confidenceStatus))
        ? 'plume confidence requires field verification' : '',
      lifeSafety.missingData.includes('Suit compatibility') ? 'suit compatibility is not verified' : '',
    ]);
    const tacticalPosture = defensiveTriggers.length ? 'Defensive' : REVIEW;
    const spillReleaseControl = spillFacts.length ? spillFacts.join(' · ') : NO_DATA;
    const neutralization = neutralizationFacts.length ? neutralizationFacts.join(' · ') : 'Neutralization Requires Source-Backed Verification';
    const vaporFireControl = unique([vaporFacts, fireFacts]).length ? unique([vaporFacts, fireFacts]).join(' · ') : NO_DATA;
    const environmentalRunoff = runoffFacts.length ? runoffFacts.join(' · ') : NO_DATA;
    const entryDecision = lifeSafety.specificValues.scbaDecision === 'SCBA MANDATED'
      ? `Entry only with ${lifeSafety.specificValues.protectionLevel === NO_DATA ? 'verified respiratory and chemical protection' : lifeSafety.specificValues.protectionLevel}; otherwise remain non-entry.`
      : REVIEW;
    const directGuidance = tacticalPosture === 'Defensive'
      ? `Operate defensively until ${defensiveTriggers.join(', ')} are resolved through approved-source review and field verification.`
      : 'Select the final tactical posture from the displayed source guidance, field conditions, and specialist review.';
    const requiredVerification = unique([
      missingData,
      values(plumeState?.missingInputs),
      'Field monitoring',
      'Current wind and weather observation time',
      'Suit compatibility for the assigned task',
      'Agency SOP',
      'Incident Command approval',
    ]);

    return {
      decision: directDecision({
        status: tacticalPosture,
        primaryDecision: tacticalPosture,
        directGuidance,
        tacticalActions: [
          spillFacts.length ? 'Use only the displayed source-backed spill / release controls.' : 'Do not select a spill / release tactic until approved-source guidance is verified.',
          neutralizationFacts.length ? 'Use only the displayed source-backed neutralization direction.' : 'Do not neutralize without verified source guidance.',
          nonInterventionFacts.length ? 'Consider non-intervention where the displayed source hazards make responder risk excessive.' : '',
        ],
        specificValues: {
          tacticalPosture,
          entryDecision,
          spillReleaseControl,
          neutralization,
          vaporFireControl,
          environmentalRunoff,
          nonInterventionConsiderations: join(nonInterventionFacts),
          requiredVerification,
        },
        missingData,
        sourceSummary: sourceSummary(sources, ['Chemical Companion', 'ERG', 'CAMEO']),
        limitations: missingData.map((field) => `${field}: ${NO_DATA}`),
        requiresICApprovalForExecution: true,
      }),
      support: {
        tacticalPosture,
        entryDecision,
        spillReleaseControl,
        neutralization,
        vaporFireControl,
        environmentalRunoff,
        nonInterventionConsiderations: join(nonInterventionFacts),
        requiredVerification,
        executionNote: MITIGATION_EXECUTION_NOTE,
      },
    };
  }

  function sourceDetails(profile, sources, basis = '') {
    const records = Array.isArray(profile?.safetyCritical?.records) ? profile.safetyCritical.records : [];
    return unique(sources).map((source) => {
      const record = records.find((item) => canonicalSource(item?.sourceName) === source && text(item?.value));
      const label = source === 'ERG' ? 'ERG 2024' : source;
      const title = source === 'Chemical Companion'
        ? 'Chemical Companion master record'
        : source === 'ERG'
          ? 'Emergency Response Guidebook 2024'
          : source === 'NIOSH'
            ? 'NIOSH Pocket Guide'
            : source === 'CAMEO'
              ? 'CAMEO Chemicals'
              : source;
      return {
        label,
        title,
        basis: basis || (record?.field ? `Approved ${record.field} record` : 'Source listed in the linked chemical record'),
        reference: record?.sourceLocator || record?.sourceRecordId || (source === 'ERG' && text(profile?.isolationErg?.ergGuide) ? `ERG Guide ${profile.isolationErg.ergGuide}` : ''),
        available: Boolean(record || source === 'ERG' || source === 'Chemical Companion'),
      };
    });
  }

  function derivedSource(basis) {
    return [{
      label: 'Derived rule',
      title: 'Guided Response command workflow',
      basis,
      reference: 'Decision-support presentation rule; not a chemical-specific source fact.',
      available: true,
    }];
  }

  function itemList(valuesToUse, fallback = NO_DATA) {
    const items = unique(valuesToUse);
    return items.length ? items : [fallback];
  }

  function checkItems(valuesToUse, fallback = 'No Current Data Exists') {
    const items = unique(valuesToUse);
    return (items.length ? items : [fallback]).map((value) => ({
      label: value,
      state: value === fallback ? 'UNKNOWN' : 'REQUIRES_VERIFICATION',
    }));
  }

  function sectionFacts(facts, headingPattern, nextHeadingPattern = /^(?:small|large|fire involving|massive|spill|notes?|general)/i) {
    const items = unique(facts);
    const start = items.findIndex((item) => headingPattern.test(item));
    if (start < 0) return [];
    const body = [];
    for (const item of items.slice(start + 1)) {
      if (nextHeadingPattern.test(item) && body.length) break;
      body.push(item);
    }
    return body;
  }

  function factRows(valuesToUse, label = 'Source fact') {
    return itemList(valuesToUse).map((value) => ({ label, value }));
  }

  function operationalFact(value, source, field) {
    const normalized = text(value);
    return normalized ? { text: normalized, source, field } : null;
  }

  function operationalFacts(valuesToUse, source, field) {
    return unique(valuesToUse).map((value) => operationalFact(value, source, field)).filter(Boolean);
  }

  function factTexts(facts) {
    return (Array.isArray(facts) ? facts : []).map((fact) => fact.text).filter(Boolean);
  }

  function recommendationSource(source, basis) {
    return {
      label: source || 'Needs Verification',
      title: source === 'ERG' ? 'Emergency Response Guidebook 2024' : `${source || 'Guided Response'} source record`,
      basis: basis || 'Source-backed fact promoted to an operational recommendation.',
      available: Boolean(source),
    };
  }

  function operationalRecommendation(value, source, field, rule = '') {
    const fact = operationalFact(value, source, field);
    return fact ? { ...fact, rule } : null;
  }

  function uniqueRecommendations(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((item) => {
      if (!item?.text || seen.has(item.text)) return false;
      seen.add(item.text);
      return true;
    });
  }

  function buildOperationalRecommendations(selectedChemical, linkedSources, decisions) {
    const profile = linkedSources.profile || {};
    const incident = linkedSources.incidentConditions || {};
    const response = profile.response || {};
    const fire = profile.fire || {};
    const reactivity = profile.reactivity || {};
    const decon = profile.decon || {};
    const ppe = profile.ppeRecommendation || {};
    const incidentSize = text(incident.spillSize || incident.releaseSize)
      || (text(incident.quantity) ? `Quantity entered: ${text(incident.quantity)}` : 'UNKNOWN — confirm small / large spill');
    const activeLeak = incident.activeLeak === true || /active|leak|release/i.test(text(incident.releaseStatus));
    const firePresent = incident.firePresent === true || /fire|involved|burning/i.test(text(incident.fireStatus));
    const releasePhase = text(incident.releasePhase || incident.containerReleasePhase || profile.properties?.physicalState);
    const sourceFacts = [
      ...operationalFacts(profile.response?.publicSafety, 'ERG', 'publicSafety'),
      ...operationalFacts(profile.response?.protectiveClothing, 'ERG', 'protectiveClothing'),
      ...operationalFacts(profile.response?.evacuation, 'ERG', 'evacuation'),
      ...operationalFacts(response.spillOrLeak, 'ERG', 'spillOrLeak'),
      ...operationalFacts(response.fire, 'ERG', 'fire'),
      ...operationalFacts(fire.extinguishingMedia, 'Chemical Companion', 'extinguishingMedia'),
      ...operationalFacts(fire.firefightingPrecautions, 'Chemical Companion', 'firefightingPrecautions'),
      ...operationalFacts(profile.spillResponse, 'Chemical Companion', 'spillResponse'),
      ...operationalFacts(profile.releaseControl, 'Chemical Companion', 'releaseControl'),
      ...operationalFacts(profile.detectors?.items, 'Chemical Companion', 'detectors'),
      ...operationalFacts(profile.detectors?.lelMeterRelevance, 'Chemical Companion', 'lelMeterRelevance'),
      ...operationalFacts(profile.exposures?.monitoringConcerns, 'NIOSH', 'monitoringConcerns'),
      ...operationalFacts(profile.exposures?.routes, 'NIOSH', 'exposureRoutes'),
      ...operationalFacts(profile.decon?.preferredMethod, 'Chemical Companion', 'preferredMethod'),
      ...operationalFacts(profile.decon?.hazmatPersonnelProcedure, 'Chemical Companion', 'hazmatPersonnelProcedure'),
      ...operationalFacts(profile.decon?.waterReactiveCautions, 'Chemical Companion', 'waterReactiveCautions'),
      ...operationalFacts(profile.decon?.runoffContainment, 'Chemical Companion', 'runoffContainment'),
      ...operationalFacts(profile.medical?.firstAid, 'CHEMM / NIOSH', 'firstAid'),
      ...operationalFacts(profile.medical?.treatmentNotes, 'CHEMM / NIOSH', 'treatmentNotes'),
      ...operationalFacts(reactivity.incompatibilities, 'Chemical Companion', 'incompatibilities'),
      ...operationalFacts(reactivity.oxidizerReducerConcerns, 'Chemical Companion', 'oxidizerReducerConcerns'),
      ...operationalFacts(reactivity.stabilityNotes, 'Chemical Companion', 'stabilityNotes'),
      ...operationalFacts(reactivity.chemicalMixtureReactivity, 'CAMEO / Chemical Companion', 'chemicalMixtureReactivity'),
      ...operationalFacts(profile.properties?.waterSolubility, 'Chemical Companion', 'waterSolubility'),
      ...operationalFacts([profile.header?.hazard, profile.properties?.physicalState, fire.flammability, profile.properties?.lelUel], 'Chemical Companion', 'hazardClassification'),
    ];
    const evaluatedFacts = uniqueRecommendations(sourceFacts);
    const isolateAction = decisions.verifyIsolate?.primaryDecision && decisions.verifyIsolate.primaryDecision !== NO_DATA
      ? operationalRecommendation(decisions.verifyIsolate.primaryDecision, 'ERG', 'isolationErg', 'ERG isolation/protective-action values are promoted directly.')
      : null;
    const ppeAction = decisions.lifeSafety?.primaryDecision && decisions.lifeSafety.primaryDecision !== NO_DATA
      ? operationalRecommendation(decisions.lifeSafety.primaryDecision, 'Chemical Companion / NIOSH', 'ppeRecommendation', 'The approved PPE recommendation object is promoted directly.')
      : null;
    const publicSafety = evaluatedFacts.filter((fact) => /upwind|uphill|upstream|evacuat|shelter|isolate|protective action/i.test(fact.text));
    const monitors = evaluatedFacts.filter((fact) => /monitor|detector|sensor|tube|exposure|idlh|lel|limit/i.test(`${fact.text} ${fact.field}`));
    const spill = evaluatedFacts.filter((fact) => /stop leak|contain|dike|dyke|absorb|collect|cover|recover|release|spill|leak/i.test(fact.text));
    const vapor = evaluatedFacts.filter((fact) => /vapor|vapour|mist|fog|spray|cloud|ventilat|dispers/i.test(fact.text));
    const fireFacts = evaluatedFacts.filter((fact) => /fire|flame|ignit|extinguish|foam|water spray|fog/i.test(`${fact.text} ${fact.field}`));
    const deconFacts = evaluatedFacts.filter((fact) => /decon|contamin|remove.*cloth|cloth.*remove|flush|wash|rinse|shower|skin|eye/i.test(`${fact.text} ${fact.field}`));
    const reactivityFacts = [
      ...operationalFacts(reactivity.waterReactivity, 'Chemical Companion', 'waterReactivity'),
      ...operationalFacts(decon.waterReactiveCautions, 'Chemical Companion', 'waterReactiveCautions'),
      ...operationalFacts(reactivity.incompatibilities, 'Chemical Companion', 'incompatibilities'),
      ...operationalFacts(reactivity.oxidizerReducerConcerns, 'Chemical Companion', 'oxidizerReducerConcerns'),
      ...operationalFacts(reactivity.stabilityNotes, 'Chemical Companion', 'stabilityNotes'),
      ...operationalFacts(reactivity.chemicalMixtureReactivity, 'CAMEO / Chemical Companion', 'chemicalMixtureReactivity'),
      ...operationalFacts(profile.properties?.waterSolubility, 'Chemical Companion', 'waterSolubility'),
    ];
    const waterFacts = reactivityFacts.filter((fact) => /(?:react\w*|decompos\w*|violent\w*|incompat\w*|avoid|do not|caution).{0,60}\b(?:water|moisture|wet)\b|\b(?:water|moisture|wet)\b.{0,60}(?:react\w*|decompos\w*|violent\w*|incompat\w*)/i.test(fact.text));
    const oxidizerFacts = reactivityFacts.filter((fact) => /oxidizer|oxidising|oxidizing|combustible absorbent/i.test(fact.text));
    const acidFacts = reactivityFacts.filter((fact) => /incompatib|react|acid/i.test(fact.text) && /acid/i.test(fact.text));
    const flammabilitySupported = Boolean(
      fireFacts.length
      || /flammab|combust|ignit/i.test(`${profile.header?.hazard || ''} ${fire.flammability || ''}`)
      || /(?:\d+(?:\.\d+)?%|not available)/i.test(text(profile.properties?.lelUel)) && !/not available/i.test(text(profile.properties?.lelUel)),
    );
    const foamSupported = fireFacts.some((fact) => /foam/i.test(fact.text));
    const warnings = uniqueRecommendations([
      waterFacts.length ? operationalRecommendation('WATER REACTIVE / DO NOT APPLY WATER', 'Chemical Companion', 'waterReactivity', 'Actionable warning derived from source-backed water-reactivity language.') : null,
      oxidizerFacts.length ? operationalRecommendation('OXIDIZER / KEEP AWAY FROM COMBUSTIBLE ABSORBENTS', 'Chemical Companion', 'oxidizerReducerConcerns', 'Actionable warning derived from source-backed oxidizer language.') : null,
      acidFacts.length ? operationalRecommendation('INCOMPATIBLE WITH ACIDS — VERIFY MATERIAL COMPATIBILITY', 'Chemical Companion', 'incompatibilities', 'Actionable warning derived from source-backed incompatibility language.') : null,
    ]);
    const protectActions = uniqueRecommendations([
      isolateAction,
      ppeAction,
      ...publicSafety.slice(0, 3).map((fact) => operationalRecommendation(fact.text, fact.source, fact.field, 'Direct public-safety fact promoted to PROTECT.')),
    ]);
    const protectMonitoring = uniqueRecommendations([
      ...monitors.slice(0, 3).map((fact) => operationalRecommendation(fact.text, fact.source, fact.field, 'Direct exposure or detector fact promoted to monitoring.')),
      operationalRecommendation('Confirm atmosphere and perimeter with field monitoring before entry or adjustment.', 'Derived rule', 'fieldMonitoring', 'Unknown conditions remain unknown until measured.'),
    ]);
    const controlActions = uniqueRecommendations([
      operationalRecommendation(decisions.mitigationDecisionSupport?.tacticalPosture, 'Derived rule', 'tacticalPosture', 'Defensive posture is retained when source or incident verification is incomplete.'),
      ...spill.slice(0, 4).map((fact) => operationalRecommendation(fact.text, fact.source, fact.field, 'Direct source-backed release-control fact promoted to CONTROL.')),
    ]);
    const sizeBranchFacts = /\blarge\b/i.test(incidentSize)
      ? spill.filter((fact) => /large spill|large release/i.test(fact.text))
      : /\bsmall\b/i.test(incidentSize)
        ? spill.filter((fact) => /small spill|small release/i.test(fact.text))
        : [];
    const incidentBranch = uniqueRecommendations([
      ...sizeBranchFacts.slice(0, 3).map((fact) => operationalRecommendation(fact.text, fact.source, fact.field, 'Incident size selects the matching source branch.')),
      activeLeak
        ? operationalRecommendation('ACTIVE LEAK — select source control only after task, PPE, monitoring, and IC approval are confirmed.', 'Derived rule', 'activeLeak', 'The incident record identifies an active leak; execution remains gated.')
        : operationalRecommendation('ACTIVE LEAK STATUS UNKNOWN — verify release status before selecting source-control tactics.', 'Derived rule', 'activeLeak', 'A missing incident condition cannot be treated as a closed release.'),
      !sizeBranchFacts.length ? operationalRecommendation('CONFIRM SMALL / LARGE SPILL BRANCH BEFORE CONTROL ACTION.', 'Derived rule', 'incidentSize', 'Control tactics are branched by incident size only when the incident condition is known.') : null,
    ]);
    const controlFire = uniqueRecommendations([
      ...(firePresent
        ? fireFacts.slice(0, 3).map((fact) => operationalRecommendation(fact.text, fact.source, fact.field, 'Direct source-backed fire-control fact promoted only when the fire branch is selected.'))
        : [operationalRecommendation('FIRE STATUS UNKNOWN — verify fire involvement before selecting the source-backed fire branch.', 'Derived rule', 'firePresent', 'No fire tactic is inferred when the incident condition is absent or unknown.')]),
      firePresent ? operationalRecommendation('FIRE PRESENT — use the source-backed fire branch and verify container condition.', 'Derived rule', 'firePresent', 'Incident fire condition selects the fire branch; no fire tactic is inferred when absent.') : null,
    ]);
    const prohibitedActions = uniqueRecommendations([
      ...warnings,
      !foamSupported ? operationalRecommendation('FOAM SELECTION REQUIRES PRODUCT-SPECIFIC VERIFICATION', 'Derived rule', 'foamSelection', 'No product-specific foam support was found in the selected source record.') : null,
    ]);
    const flammabilityMonitoring = flammabilitySupported
      ? [operationalRecommendation('FLAMMABILITY MONITORING REQUIRED', 'Derived rule', 'flammabilityMonitoring', 'Source-backed flammability or LEL evidence activates this monitoring requirement.')]
      : [];
    const measuredLel = text(incident.measuredLel || incident.percentLel || incident.lelReading);
    const controlMonitoring = uniqueRecommendations([
      ...flammabilityMonitoring,
      measuredLel ? operationalRecommendation(`Measured LEL / %LEL: ${measuredLel}`, 'Incident record', 'measuredLel', 'Operator-entered measurement is displayed as incident data; it is not a universal threshold.') : null,
      ...monitors.slice(0, 3).map((fact) => operationalRecommendation(fact.text, fact.source, fact.field, 'Direct source-backed monitoring capability.')),
    ]);
    const deconActions = uniqueRecommendations([
      ...deconFacts.slice(0, 5).map((fact) => operationalRecommendation(fact.text, fact.source, fact.field, 'Direct source-backed contamination-control or decon fact.')),
    ]);
    const notifyRegulatory = profile.regulatory || profile.regulatoryData || profile.reportableQuantity || {};
    const rq = notifyRegulatory.rq ?? notifyRegulatory.reportableQuantity ?? notifyRegulatory.cercla?.rq ?? notifyRegulatory.cercla?.RQ;
    const releaseQuantity = text(incident.quantity);
    const rqNumber = Number(String(rq ?? '').replace(/[^0-9.]+/g, ''));
    const releaseMatch = releaseQuantity.match(/([0-9]+(?:\.[0-9]+)?)\s*(lb|lbs|pounds|kg|kilograms)?/i);
    const releaseNumber = releaseMatch ? Number(releaseMatch[1]) * (/kg|kilogram/i.test(releaseMatch[2] || '') ? 2.2046226218 : 1) : Number.NaN;
    const regulatory = Number.isFinite(rqNumber) && rqNumber > 0
      ? operationalRecommendation(
        `RQ REVIEW: ${Number.isFinite(releaseNumber) ? (releaseNumber >= rqNumber ? 'RELEASE APPEARS AT OR ABOVE DISPLAYED RQ' : 'RELEASE BELOW DISPLAYED RQ') : 'RELEASE QUANTITY UNKNOWN'}`,
        'EPA regulatory data',
        'reportableQuantity',
        'Compare the incident quantity to the displayed source RQ; confirm jurisdictional notification requirements.',
      )
      : operationalRecommendation('RQ / notification status: NO CURRENT SOURCE DATA — review applicable agency requirements.', 'Derived rule', 'reportableQuantity', 'No RQ was present in the active profile; no threshold comparison is invented.');
    const notifyActions = uniqueRecommendations([
      regulatory,
      operationalRecommendation('Document the chemical identity, quantity, conditions, monitoring, actions, and unresolved gaps for Command and agency coordination.', 'Derived rule', 'commandRecord', 'Operational record continuity rule; it does not name an agency without a source trigger.'),
    ]);
    const resources = uniqueRecommendations([
      operationalRecommendation('Incident Command approval before entry or mitigation.', 'Derived rule', 'icApproval', 'Execution gate retained from the tactical decision record.'),
      ...(decisions.mitigationDecisionSupport?.requiredVerification || []).slice(0, 3).map((item) => operationalRecommendation(item, 'Derived rule', 'requiredVerification', 'Required verification promoted as a resource/checkpoint need.')),
    ]);
    const promoted = uniqueRecommendations([
      ...protectActions, ...protectMonitoring, ...controlActions, ...controlFire, ...prohibitedActions,
      ...controlMonitoring, ...deconActions, ...notifyActions, ...resources,
    ]);
    const promotedTexts = new Set(promoted.map((fact) => fact.text));
    const omitted = evaluatedFacts.filter((fact) => !promotedTexts.has(fact.text));
    const ratio = evaluatedFacts.length ? Number((promoted.length / evaluatedFacts.length).toFixed(2)) : 0;
    const sourcesFor = (facts) => [...new Set(facts.map((fact) => fact.source).filter((source) => source && source !== 'Derived rule'))]
      .map((source) => recommendationSource(source, 'Source facts promoted into this operational module.'));
    const why = {
      protect: 'PROTECT promotes only verified isolation, PPE, public-safety, and exposure-monitoring facts. Plume output remains planning support and cannot downgrade PPE.',
      control: `CONTROL branches on the available incident conditions (${incidentSize}${releasePhase ? ` · ${releasePhase}` : ''}${activeLeak ? ' · active leak' : ''}${firePresent ? ' · fire present' : ''}). Missing conditions remain verification items; generic mitigation is not inferred.`,
      decon: 'DECON promotes only the selected chemical’s method matrix, contamination-control, first-aid, and runoff facts. Water use is not assumed.',
      notify: 'NOTIFY / REQUEST compares quantity to an RQ only when an RQ is present. Otherwise notification status remains unknown and is not assigned to an agency by assumption.',
    };
    return {
      version: '3.0',
      sourcePrecedence: {
        protect: ['ERG', 'NIOSH', 'Chemical Companion'],
        control: ['CAMEO', 'ERG', 'Chemical Companion'],
        decon: ['CHEMM', 'Chemical Companion', 'ERG'],
        notify: ['EPA regulatory data', 'Derived rule'],
      },
      incidentConditions: { incidentSize, activeLeak, firePresent, releasePhase: releasePhase || NO_DATA, measuredLel: measuredLel || NO_DATA },
      protect: {
        priority: protectActions[0]?.text || NO_DATA,
        actions: protectActions.slice(0, 8),
        warnings: warnings.slice(0, 5),
        monitoring: protectMonitoring.slice(0, 5),
        sources: sourcesFor([...protectActions, ...protectMonitoring, ...warnings]),
        why: why.protect,
      },
      control: {
        incidentSize,
        tacticalPosture: decisions.mitigationDecisionSupport?.tacticalPosture || REVIEW,
        recommendedAction: controlActions[0]?.text || NO_DATA,
        sourceControl: [...incidentBranch, ...controlActions].slice(0, 8),
        confinement: spill.filter((fact) => /contain|dike|dyke|collect|recover|absorb/i.test(fact.text)).slice(0, 5),
        vaporControl: vapor.slice(0, 5),
        fireControl: controlFire.slice(0, 5),
        prohibitedActions: prohibitedActions.slice(0, 6),
        monitoring: controlMonitoring.slice(0, 6),
        resourcesNeeded: resources.slice(0, 6),
        sources: sourcesFor([...controlActions, ...controlFire, ...controlMonitoring, ...prohibitedActions]),
        why: why.control,
      },
      decon: {
        method: deconActions[0]?.text || NO_DATA,
        actions: deconActions.slice(0, 8),
        warnings: warnings.filter((fact) => /water|oxidizer|acid/i.test(fact.text)).slice(0, 5),
        runoffControl: operationalFacts(decon.runoffContainment, 'Chemical Companion', 'runoffContainment'),
        sources: sourcesFor([...deconActions, ...warnings, ...operationalFacts(decon.runoffContainment, 'Chemical Companion', 'runoffContainment')]),
        why: why.decon,
      },
      notify: {
        recommendedAction: notifyActions[0]?.text || NO_DATA,
        regulatory: regulatory ? [regulatory] : [],
        operationalResources: resources.slice(0, 6),
        emergencyManagement: [],
        actions: notifyActions.slice(0, 6),
        sources: sourcesFor(notifyActions),
        why: why.notify,
      },
      supporting: {
        medical: operationalFacts(profile.medical?.firstAid || profile.medical?.treatmentNotes, 'CHEMM / NIOSH', 'medical'),
        monitoring: controlMonitoring.slice(0, 6),
        checkpoints: resources.slice(0, 6),
      },
      factTrace: {
        evaluated: evaluatedFacts,
        promoted,
        omitted,
        evaluatedCount: evaluatedFacts.length,
        promotedCount: promoted.length,
        promotedRatio: ratio,
      },
    };
  }

  function stage({ id, number, title, action, status, criticalFacts, verificationItems, sources: stageSources, why, requiresICApproval = false, branches = [] }) {
    return {
      id,
      number,
      title,
      status,
      action,
      criticalFacts: criticalFacts || [],
      verificationItems: verificationItems || [],
      sources: stageSources || [],
      why: why || '',
      requiresICApproval,
      branches,
    };
  }

  function buildCanonicalGuidedResponseModel(selectedChemical, linkedSources, plumeState, weatherState, decisions, sources) {
    const profile = linkedSources.profile || {};
    const response = profile.response || {};
    const responderGuide = linkedSources.responderGuide || {};
    const ergPublicSafety = responderGuide.publicSafety || {};
    const ergEmergency = responderGuide.emergencyResponse || {};
    const ppe = profile.ppeRecommendation || {};
    const recommendationSources = unique(ppe.sourcesReviewed || decisions.lifeSafety.sourceSummary || sources);
    const ergSources = sourceDetails(profile, sourceSummary(sources, ['ERG', 'Chemical Companion']), `ERG Guide ${profile.isolationErg?.ergGuide || 'not available'} response data`);
    const companionSources = sourceDetails(profile, sourceSummary(sources, ['Chemical Companion', 'NIOSH', 'CAMEO']), 'Chemical-specific master record and linked safety facts');
    const ppeSources = sourceDetails(profile, recommendationSources.length ? recommendationSources : sources, 'Source-backed PPE recommendation and verification requirements');
    const profileSources = sourceDetails(profile, sources, 'Linked source record for the selected chemical');

    const fireFacts = unique([
      response.fire,
      profile.fire?.extinguishingMedia,
      profile.fire?.firefightingPrecautions,
      ergEmergency.fire,
    ]);
    const spillFacts = unique([
      response.spillOrLeak,
      linkedSources.responderGuide?.emergencyResponse?.spillOrLeak,
      profile.spillResponse,
      profile.releaseControl,
    ]);
    const fireBranches = [
      ['SMALL FIRE', /small fire/i],
      ['LARGE FIRE', /large fire/i],
      ['TANK / CONTAINER FIRE', /fire involving tanks?|tank.*fire/i],
    ].map(([title, pattern]) => ({
      title,
      facts: sectionFacts(fireFacts, pattern),
    })).filter((branch) => branch.facts.length);
    const spillBranches = [
      ['GENERAL RELEASE', /^(?!small spill|large spill|general release|notes?)/i],
      ['SMALL SPILL', /small spill/i],
      ['LARGE SPILL', /large spill/i],
    ].map(([title, pattern]) => ({
      title,
      facts: title === 'GENERAL RELEASE'
        ? spillFacts.filter((item) => pattern.test(item))
        : sectionFacts(spillFacts, pattern),
    })).filter((branch) => branch.facts.length);

    const monitoringItems = unique([
      profile.detectors?.items,
      profile.detectors?.pidRelevance,
      profile.detectors?.lelMeterRelevance,
      profile.detectors?.colorimetricTubes,
      profile.detectors?.electrochemicalSensors,
    ]);
    const monitoringTargets = unique([
      profile.exposures?.monitoringConcerns,
      profile.exposures?.idlh ? `IDLH: ${profile.exposures.idlh}` : '',
      profile.properties?.lelUel ? `LEL / UEL: ${profile.properties.lelUel}` : '',
    ]);
    const medicalFacts = unique([
      profile.medical?.firstAid,
      profile.medical?.treatmentNotes,
      profile.medical?.emsConsiderations,
      ergEmergency.firstAid,
    ]);
    const firstAidFacts = unique([profile.medical?.firstAid, ergEmergency.firstAid]);
    const publicSafetyFacts = unique([profile.response?.publicSafety, ergPublicSafety.general]);
    const clothingFacts = unique([profile.response?.protectiveClothing, ergPublicSafety.protectiveClothing]);
    const evacuationFacts = unique([profile.response?.evacuation, ergPublicSafety.evacuation]);
    const deconPreferredMethods = unique(profile.decon?.preferredMethod);
    const deconSourceBasis = unique(profile.decon?.sourceBasis);
    const antidotes = unique(profile.medical?.antidotes);
    const plumeFacts = plumeState?.endpointSelected
      ? [`${plumeState.endpointSelected} · ${plumeState.zoneMeaning || 'Planning zones available'}`, plumeState.status]
      : ['No current plume estimate is available.'];

    const isolationFacts = decisions.verifyIsolate.specificValues;
    const isolationMissing = decisions.verifyIsolate.missingData;
    const lifeFacts = decisions.lifeSafety.specificValues;
    const ppeMissing = decisions.lifeSafety.missingData;
    const mitigation = decisions.mitigationDecisionSupport;
    const mitigationFacts = unique([
      publicSafetyFacts,
      spillBranches.flatMap((branch) => branch.facts),
      clothingFacts,
    ]);
    const transitionConditions = unique([
      mitigation.requiredVerification,
      ppe.verificationRequirements,
      'Incident Command approval',
    ]);

    const stages = [
      stage({
        id: 'identification', number: 1, title: 'IDENTIFY / ANALYZE',
        status: 'SOURCE-BACKED',
        action: 'Confirm the verified chemical identity and hazard picture before selecting tactics.',
        criticalFacts: [
          { label: 'Chemical', value: text(profile.header?.name) || NO_DATA, emphasis: true },
          { label: 'UN / NA', value: text(profile.header?.un) || NO_DATA, emphasis: true },
          { label: 'Hazards', value: text(profile.header?.hazard) || NO_DATA, emphasis: true },
          { label: 'ERG Guide', value: text(profile.header?.ergGuide) || NO_DATA, emphasis: true },
          { label: 'IDLH', value: text(profile.exposures?.idlh) || NO_DATA, emphasis: true },
        ],
        verificationItems: checkItems([
          text(profile.header?.name) ? 'Master record identity confirmed' : 'Confirm chemical identity',
          text(profile.header?.un) ? 'Transportation identifier confirmed' : 'Confirm UN / NA identifier',
        ]),
        sources: profileSources,
        why: 'Chemical-specific response guidance is enabled only for a verified Chemical Companion master link.',
      }),
      stage({
        id: 'isolation', number: 2, title: 'ISOLATE / ESTABLISH ZONES',
        status: isolationMissing.length ? 'VERIFY' : 'SOURCE-BACKED',
        action: isolationFacts.initialIsolation !== NO_DATA
          ? `Establish initial isolation: ${isolationFacts.initialIsolation}.`
          : 'Verify approved-source isolation distances before establishing a chemical-specific perimeter.',
        criticalFacts: [
          { label: 'Initial isolation', value: isolationFacts.initialIsolation || NO_DATA, emphasis: true },
          { label: 'Large spill isolation', value: isolationFacts.largeSpillIsolation || NO_DATA, emphasis: true },
          { label: 'Protective action', value: isolationFacts.protectiveAction || NO_DATA, emphasis: true },
          { label: 'ERG guide', value: isolationFacts.ergGuide || NO_DATA },
          { label: 'Approach / position', value: itemList(publicSafetyFacts.filter((item) => /upwind|uphill|upstream/i.test(item))).join(' · ') },
        ],
        verificationItems: checkItems([
          ...isolationMissing,
          'Confirm perimeter with field monitoring and visual conditions',
        ]),
        sources: ergSources,
        why: 'ERG isolation and protective-action values remain separate from plume modeling and must not be replaced by model output.',
        requiresICApproval: true,
      }),
      stage({
        id: 'life-safety-ppe', number: 3, title: 'LIFE SAFETY / PPE',
        status: lifeFacts.scbaDecision === 'SCBA MANDATED' ? 'ACTION REQUIRED' : (ppeMissing.length ? 'VERIFY' : 'SOURCE-BACKED'),
        action: lifeFacts.protectionLevel || NO_DATA,
        criticalFacts: [
          { label: 'Entry posture', value: lifeFacts.protectionLevel || NO_DATA, emphasis: true },
          { label: 'Respiratory protection', value: ppe.respiratoryProtection || NO_DATA, emphasis: true },
          { label: 'Chemical protection', value: ppe.skinProtection || NO_DATA, emphasis: true },
          { label: 'IDLH', value: profile.exposures?.idlh || NO_DATA, emphasis: true },
          { label: 'Respiratory downgrade', value: lifeFacts.levelCAllowed ? 'CONDITIONAL — verify all Level C conditions' : 'BLOCKED PENDING VERIFICATION', emphasis: true },
        ],
        verificationItems: checkItems([
          ...lifeFacts.requiredVerification,
          'Verify oxygen concentration and air monitoring before entry',
          'Verify concentration below applicable limit',
          'Verify respirator and suit compatibility',
        ]),
        sources: ppeSources,
        why: itemList(lifeFacts.whySelected, 'PPE level is limited to the source-backed recommendation object.').join(' · '),
        requiresICApproval: true,
      }),
      stage({
        id: 'monitor-verify', number: 4, title: 'MONITOR / VERIFY',
        status: monitoringItems.length || monitoringTargets.length ? 'VERIFY' : 'NO CURRENT DATA',
        action: monitoringItems.length ? 'Use only the listed source-supported monitoring capability and verify conditions before entry.' : 'Obtain technically appropriate monitoring guidance before entry.',
        criticalFacts: [
          { label: 'Instruments / methods', value: itemList(monitoringItems).join(' · '), emphasis: true },
          { label: 'Exposure targets', value: itemList(monitoringTargets).join(' · '), emphasis: true },
          { label: 'Current atmosphere', value: 'NOT VERIFIED', emphasis: true },
          { label: 'Source capability', value: monitoringItems.length ? 'VERIFIED · listed in selected chemical record' : 'NOT VERIFIED' },
          { label: 'Weather status', value: decisions.verifyIsolate.specificValues.weatherStatus || NO_DATA },
          { label: 'Plume status', value: decisions.verifyIsolate.specificValues.plumeStatus || NO_DATA },
        ],
        verificationItems: checkItems([
          ...(Array.isArray(ppe.verificationRequirements) ? ppe.verificationRequirements : []),
          monitoringItems.length ? 'Instrument suitability and calibration confirmed' : 'Technically appropriate instrument not identified in current source data',
          'Unknown atmospheric conditions remain unknown until measured',
        ]),
        sources: companionSources,
        why: 'Monitoring recommendations are restricted to detector and exposure fields present in the selected chemical record.',
      }),
      stage({
        id: 'tactical-mode', number: 5, title: 'TACTICAL MODE',
        status: mitigation.tacticalPosture ? 'ACTION REQUIRED' : 'VERIFY',
        action: mitigation.tacticalPosture ? mitigation.tacticalPosture.toUpperCase() : 'VERIFY TACTICAL MODE',
        criticalFacts: [
          { label: 'Mode', value: mitigation.tacticalPosture || NO_DATA, emphasis: true },
          { label: 'Mode set', value: 'DEFENSIVE · OFFENSIVE · NON-INTERVENTION · TRANSITION / LIMITED OFFENSIVE' },
          { label: 'Entry posture', value: mitigation.entryDecision || NO_DATA, emphasis: true },
          { label: 'Initial actions', value: itemList(mitigationFacts).join(' · ') },
          { label: 'Transition condition', value: itemList(transitionConditions).join(' · ') },
        ],
        verificationItems: checkItems(transitionConditions),
        sources: sourceDetails(profile, sourceSummary(sources, ['Chemical Companion', 'ERG', 'CAMEO']), 'Tactical posture derived from source completeness and verified incident conditions'),
        why: 'Derived decision rule: incomplete source data, mandated SCBA, or unverified field conditions keep the initial posture defensive.',
        requiresICApproval: true,
      }),
      stage({
        id: 'control-mitigation', number: 6, title: 'CONTROL / MITIGATION',
        status: fireBranches.length || spillBranches.length ? 'SOURCE-BACKED' : 'NO CURRENT DATA',
        action: fireBranches.length || spillBranches.length
          ? 'Select the source-backed fire or non-fire release branch that matches current conditions.'
          : 'Do not select a control tactic until source-backed guidance is verified.',
        criticalFacts: [
          { label: 'Spill / release control', value: mitigation.spillReleaseControl || NO_DATA, emphasis: true },
          { label: 'Neutralization', value: mitigation.neutralization || NO_DATA },
          { label: 'Runoff / environment', value: mitigation.environmentalRunoff || NO_DATA },
          { label: 'Non-intervention', value: mitigation.nonInterventionConsiderations || NO_DATA },
        ],
        verificationItems: checkItems([
          ...mitigation.requiredVerification,
          fireBranches.length ? 'Confirm fire branch and container condition' : 'Fire branch not available from current source data',
          spillBranches.length ? 'Confirm spill branch and release conditions' : 'Spill branch not available from current source data',
        ]),
        sources: sourceDetails(profile, sourceSummary(sources, ['ERG', 'Chemical Companion', 'CAMEO']), 'Source-backed emergency response branch'),
        why: 'No fire, spill, vapor-control, neutralization, or runoff tactic is inferred when the current source record does not provide it.',
        requiresICApproval: true,
        branches: [
          ...fireBranches.map((branch) => ({ type: 'fire', title: branch.title, facts: branch.facts, sources: ergSources })),
          ...spillBranches.map((branch) => ({ type: 'spill', title: branch.title, facts: branch.facts, sources: ergSources })),
        ],
      }),
      stage({
        id: 'decontamination', number: 7, title: 'DECONTAMINATION',
        status: deconPreferredMethods.length ? 'SOURCE-BACKED' : 'VERIFY',
        action: deconPreferredMethods.length ? deconPreferredMethods.join(' · ') : 'Verify a chemical-compatible decontamination method before use.',
        criticalFacts: [
          { label: 'Initial decon method', value: itemList(deconPreferredMethods).join(' · '), emphasis: true },
          { label: 'Water reactivity warning', value: itemList(profile.decon?.waterReactiveCautions) },
          { label: 'Remove clothing?', value: itemList(firstAidFacts.filter((item) => /remove.*clothing|clothing.*remove/i.test(item))) },
          { label: 'Skin / eye flush', value: itemList(firstAidFacts.filter((item) => /flush|wash|eye|skin/i.test(item))) },
          { label: 'Runoff control', value: itemList(profile.decon?.runoffContainment) },
        ],
        verificationItems: checkItems([
          ...profile.decon?.waterReactiveCautions || [],
          deconPreferredMethods.length ? 'Confirm method matches chemical, physical state, PPE, and runoff controls' : 'Chemical-compatible method not available',
        ]),
        sources: sourceDetails(profile, deconSourceBasis.length ? ['Chemical Companion', 'ERG'] : sources, 'Decontamination method and contamination-control records'),
        why: 'Decontamination remains tied to the physical-state method matrix and source first-aid contamination-control guidance; water use is not assumed.',
        requiresICApproval: true,
      }),
      stage({
        id: 'medical', number: 8, title: 'MEDICAL',
        status: medicalFacts.length ? 'SOURCE-BACKED' : 'NO CURRENT DATA',
        action: medicalFacts.length ? 'Protect responders and patients, then use the displayed source-backed medical direction.' : 'Obtain medical direction; no current medical facts are available.',
        criticalFacts: [
          { label: 'Primary exposure routes', value: itemList(profile.exposures?.routes).join(' · '), emphasis: true },
          { label: 'Expected acute effects', value: itemList(profile.medical?.signsSymptoms || profile.exposures?.symptoms).join(' · '), emphasis: true },
          { label: 'Source-backed treatment', value: itemList(profile.medical?.treatmentNotes) },
          { label: 'Supportive care', value: itemList(profile.medical?.firstAid) },
          { label: 'Treatment status', value: antidotes.length ? 'SOURCE-BACKED TREATMENT · MEDICAL-DIRECTION REQUIRED' : 'SUPPORTIVE CARE · MEDICAL-DIRECTION REQUIRED' },
          { label: 'Antidote status', value: antidotes.length ? antidotes.join(' · ') : 'No source-backed antidote listed' },
          { label: 'Transport priority', value: itemList(profile.medical?.emsConsiderations).join(' · ') },
        ],
        verificationItems: checkItems([
          antidotes.length ? 'Confirm treatment with medical direction' : 'Medical-direction required; no antidote is inferred',
          'Protect receiving medical personnel from contamination',
        ]),
        sources: companionSources,
        why: 'Medical labels distinguish source-backed treatment, supportive care, and medical-direction requirements without inventing an antidote.',
      }),
      stage({
        id: 'protective-actions', number: 9, title: 'PROTECTIVE ACTIONS',
        status: isolationFacts.protectiveAction !== NO_DATA || evacuationFacts.length ? 'SOURCE-BACKED' : 'VERIFY',
        action: 'Keep ERG published distances separate from the incident-specific plume estimate.',
        criticalFacts: [
          { label: 'ERG initial isolation', value: isolationFacts.initialIsolation || NO_DATA, emphasis: true },
          { label: 'ERG protective action', value: isolationFacts.protectiveAction || NO_DATA, emphasis: true },
          { label: 'ERG public safety', value: itemList(publicSafetyFacts).join(' · ') },
          { label: 'ERG evacuation', value: itemList(evacuationFacts).join(' · ') },
          { label: 'EMERGENZ plume estimate', value: itemList(plumeFacts).join(' · '), emphasis: true },
        ],
        verificationItems: checkItems([
          'Confirm wind direction and current weather',
          'Adjust perimeter with field monitoring and Incident Command',
          plumeState?.endpointSelected ? 'Treat plume zones as planning estimates only' : 'Plume output not available for the current incident',
        ]),
        sources: [...ergSources, ...sourceDetails(profile, ['Chemical Companion'], 'Incident-specific plume planning estimate; does not replace ERG values')],
        why: 'ERG is published emergency guidance. Plume Model is an incident-specific planning estimate. Both remain separately labeled for Command.',
        requiresICApproval: true,
      }),
      stage({
        id: 'termination-documentation', number: 10, title: 'TERMINATION / DOCUMENTATION',
        status: 'VERIFY',
        action: 'Document verified facts, unresolved items, monitoring results, and approvals before transfer or demobilization.',
        criticalFacts: [
          { label: 'Record', value: 'Chemical identity, zones, PPE, monitoring, control branch, decon, medical, and protective actions' },
          { label: 'Open items', value: itemList(decisions.missingDataWarnings).join(' · '), emphasis: true },
          { label: 'Approval', value: 'Incident Command approval required before operational action', emphasis: true },
        ],
        verificationItems: checkItems([
          'Source and reference captured for each decision',
          'Field monitoring results recorded',
          'PPE / decon / medical handoff recorded',
          'Unresolved data gaps explicitly documented',
        ]),
        sources: derivedSource('Derived command workflow: preserve source traceability and unresolved verification items in the tactical record.'),
        why: 'This is a derived documentation rule for decision-support continuity, not a chemical-specific tactical recommendation.',
        requiresICApproval: true,
      }),
    ];

    const firstPendingIndex = stages.findIndex((item) => item.status === 'VERIFY' || item.status === 'ACTION REQUIRED' || item.status === 'NO CURRENT DATA');
    const currentIndex = firstPendingIndex < 0 ? stages.length - 1 : firstPendingIndex;
    stages.forEach((item, index) => {
      item.stepState = index < currentIndex ? 'COMPLETE' : index === currentIndex ? 'CURRENT' : 'UPCOMING';
    });

    const sourceCatalog = {};
    stages.flatMap((item) => item.sources).forEach((source) => {
      if (source?.label) sourceCatalog[source.label] = source;
    });
    return {
      identification: stages[0],
      isolation: stages[1],
      ppe: stages[2],
      monitoring: stages[3],
      tacticalMode: stages[4],
      fireControl: {
        available: fireBranches.length > 0,
        branches: fireBranches.map((branch) => ({ ...branch, sources: ergSources })),
      },
      spillControl: {
        available: spillBranches.length > 0,
        branches: spillBranches.map((branch) => ({ ...branch, sources: ergSources })),
      },
      decon: stages[6],
      medical: stages[7],
      protectiveActions: stages[8],
      termination: stages[9],
      controlMitigation: stages[5],
      sequence: stages,
      sources: sourceCatalog,
      currentStep: stages[currentIndex]?.title || stages[0].title,
    };
  }

  function buildGuidedResponseDecisions(selectedChemical, linkedSources = {}, plumeState = {}, weatherState = {}) {
    if (!selectedChemical?.masterLinked || !selectedChemical?.masterChemicalId) {
      return {
        blocked: true,
        blockReason: 'Chemical-specific response guidance requires a verified Chemical Companion master link.',
      };
    }
    const sources = approvedSources(linkedSources);
    const lifeSafetyResult = buildLifeSafety(selectedChemical, linkedSources, sources);
    const verifyIsolate = buildVerifyIsolate(linkedSources, plumeState, weatherState, sources);
    const mitigationResult = buildMitigation(linkedSources, lifeSafetyResult.decision, plumeState, weatherState, sources);
    lifeSafetyResult.decision.specificValues.plumePlanningImpact = text(plumeState?.endpointSelected)
      ? `${text(plumeState.endpointSelected)} indicates a modeled downwind AEGL planning concern; it does not select or downgrade PPE.`
      : 'No AEGL plume endpoint is available; plume output cannot determine PPE.';
    lifeSafetyResult.decision.limitations = unique([
      ...lifeSafetyResult.decision.limitations,
      'Plume output alone cannot downgrade PPE or respiratory protection.',
    ]);
    const profile = linkedSources.profile || {};
    const identityMissing = unique([
      text(profile.header?.name) ? '' : 'Chemical name',
      selectedChemical.masterChemicalId ? '' : 'Chemical Companion master ID',
    ]);
    const identifyAnalyze = directDecision({
      status: 'Verified Chemical Companion Master Record',
      primaryDecision: `Use Chemical Companion master record ${selectedChemical.masterChemicalId} for ${text(selectedChemical.chemicalName) || 'the selected chemical'}.`,
      directGuidance: 'Chemical-specific guidance is enabled only for this verified master link; supporting ERG, NIOSH, and CAMEO facts remain subordinate and source-attributed.',
      tacticalActions: ['Review the direct isolation, life-safety, and mitigation decisions below.'],
      specificValues: {
        chemicalName: text(selectedChemical.chemicalName) || NO_DATA,
        masterChemicalId: selectedChemical.masterChemicalId,
        transportationIdentifier: text(selectedChemical.transportationIdentifier) || NO_DATA,
        majorHazardClass: text(profile.header?.hazard) || NO_DATA,
      },
      missingData: identityMissing,
      sourceSummary: sources,
      limitations: identityMissing.map((field) => `${field}: ${NO_DATA}`),
    });
    const evidenceObjects = { lifeSafetyDecisionEvidence: lifeSafetyResult.evidence };
    const decisions = {
      identifyAnalyze,
      verifyIsolate,
      lifeSafety: lifeSafetyResult.decision,
      mitigation: mitigationResult.decision,
    };
    const guidedResponse = buildCanonicalGuidedResponseModel(
      selectedChemical,
      linkedSources,
      plumeState,
      weatherState,
      {
        ...decisions,
        mitigationDecisionSupport: mitigationResult.support,
        missingDataWarnings: unique(Object.values(decisions).flatMap((decision) => decision.missingData.map((field) => `${field}: ${NO_DATA}`))),
      },
      sources,
    );
    const operationalRecommendations = buildOperationalRecommendations(selectedChemical, linkedSources, {
      ...decisions,
      mitigationDecisionSupport: mitigationResult.support,
    });
    guidedResponse.operationalRecommendations = operationalRecommendations;
    return {
      blocked: false,
      ...decisions,
      guidedResponse,
      operationalRecommendations,
      mitigationDecisionSupport: mitigationResult.support,
      evidenceObjects,
      missingDataWarnings: unique(Object.values(decisions).flatMap((decision) => decision.missingData.map((field) => `${field}: ${NO_DATA}`))),
      sourceSummaries: Object.fromEntries(Object.entries(decisions).map(([key, decision]) => [key, decision.sourceSummary])),
      executionNotes: [EXECUTION_NOTE, MITIGATION_EXECUTION_NOTE],
    };
  }

  global.HazMatIQGuidedResponse = Object.freeze({
    NO_DATA,
    REVIEW,
    APPROVED_SOURCES: Object.freeze([...APPROVED_SOURCES]),
    buildCanonicalGuidedResponseModel,
    buildGuidedResponseDecisions,
  });
})(globalThis);
