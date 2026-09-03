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
    const spillFacts = unique([
      profile.spillResponse,
      profile.releaseControl,
      profile.response?.spillOrLeak,
      linkedSources.responderGuide?.emergencyResponse?.spillOrLeak,
    ]);
    const fireFacts = unique([profile.vaporControl, profile.fire?.firefightingPrecautions, linkedSources.responderGuide?.emergencyResponse?.fire]);
    const neutralizationFacts = unique(profile.neutralization);
    const runoffFacts = unique([
      profile.decon?.runoffContainment,
      spillFacts.filter((value) => /runoff|waterway|sewer|drain|environment/i.test(value)),
    ]);
    const vaporFacts = unique(spillFacts.filter((value) => /vapor|spray|fog|cloud|dispers/i.test(value)));
    const sourceControlFacts = unique(spillFacts.filter((value) => /stop (?:the )?leak|shut[ -]?off|close (?:the )?valve|plug|patch|overpack|upright|transfer|recover product/i.test(value)));
    const confinementFacts = unique([
      spillFacts.filter((value) => /dike|berm|dam|absorb|contain|divert|drain|sewer|waterway|runoff/i.test(value)),
      runoffFacts,
    ]);
    const nonInterventionFacts = unique([
      values(profile.fire?.explosionHazards).filter((value) => /withdraw immediately|do not approach|do not fight|non-intervention|mass explosion/i.test(value)),
      spillFacts.filter((value) => /withdraw immediately|do not approach|do not touch|non-intervention/i.test(value)),
      fireFacts.filter((value) => /withdraw immediately|do not fight|impossible|mass explosion|non-intervention/i.test(value)),
    ]);
    const missingData = [];
    if (!spillFacts.length) missingData.push('Spill / release control');
    if (!neutralizationFacts.length) missingData.push('Neutralization');
    if (!fireFacts.length) missingData.push('Vapor / fire control');
    if (!runoffFacts.length) missingData.push('Environmental / runoff control');
    const hazardText = unique([
      profile.header?.hazard,
      profile.header?.hazardClass,
      profile.fire?.explosionHazards,
      profile.fire?.vaporBehavior,
      profile.reactivity?.waterReactivity,
      profile.reactivity?.polymerizationRisk,
    ]).join(' ');
    const hazardEscalationCues = unique([
      /toxic gas|toxic by inhalation|inhalation hazard|\bTIH\b/i.test(hazardText) ? 'toxic inhalation or gas hazard' : '',
      /explos|detonat|rupture|polymeri[sz]|water[- ]react/i.test(hazardText) ? 'explosion, pressure, polymerization, or water-reactivity hazard' : '',
      nonInterventionFacts.length ? 'source guidance includes withdrawal or non-intervention cues' : '',
    ]);
    const chemicalIdentity = `${text(profile.header?.name)} ${text(profile.header?.cas)}`;
    const isChlorine = /\bchlorine\b|7782-50-5/i.test(chemicalIdentity);
    const isTicTih = /toxic industrial chemical|toxic inhalation|toxic gas|poison gas|\bTIH\b|\bTIC\b|6\.1\s*\(toxic/i.test(`${chemicalIdentity} ${hazardText}`);
    const leakControlEquipmentRequirement = isChlorine
      ? 'Select and stage the correct Chlorine Institute emergency kit for the verified container: Kit A for cylinders, Kit B for one-ton containers, or Kit C for tank cars / cargo tanks; follow the current kit instructions and agency SOP.'
      : isTicTih
        ? 'Identify, verify compatibility, and stage the product- and container-specific manufacturer or industry leak-control kit, tools, plugs, patches, capping device, or approved overpack required for the defined task; follow current instructions and agency SOP.'
        : '';
    const sourceControlPlan = unique([leakControlEquipmentRequirement, sourceControlFacts]);
    const ppeSourceBacked = lifeSafety.status === 'SOURCE_BACKED_RECOMMENDATION'
      && lifeSafety.specificValues.protectionLevel !== NO_DATA;
    const offensiveAvailable = sourceControlFacts.length > 0
      && ppeSourceBacked
      && (isTicTih || nonInterventionFacts.length === 0);
    const tacticalPosture = nonInterventionFacts.length && !sourceControlFacts.length
      ? 'Non-Intervention — Isolate and Protect Exposures'
      : offensiveAvailable
        ? 'Offensive — Conditional Source Control'
        : confinementFacts.length
          ? 'Defensive — Contain and Protect'
          : 'Defensive — Isolate and Monitor';
    const postureReason = offensiveAvailable
      ? `${isTicTih ? `${isChlorine ? 'Chlorine' : 'TIC/TIH'} source control is a valid technician-level offensive option when the correct product- and container-specific leak-control equipment and procedure are confirmed. ` : ''}Verified source-control direction and source-backed PPE support a technician entry after every listed prerequisite is confirmed.`
      : tacticalPosture.startsWith('Non-Intervention')
        ? 'Source hazards indicate withdrawal or non-intervention; protect exposures and allow the incident to stabilize under command control.'
        : hazardEscalationCues.length
          ? `A defensive posture is recommended because source-control conditions are incomplete while ${hazardEscalationCues.join(', ')} remain active concerns.`
          : 'Direct source-control conditions are not fully established; contain, confine, monitor, and reassess for a controlled transition.';
    const spillReleaseControl = spillFacts.length ? spillFacts.join(' · ') : NO_DATA;
    const neutralization = neutralizationFacts.length ? neutralizationFacts.join(' · ') : 'Neutralization Requires Source-Backed Verification';
    const vaporFireControl = unique([vaporFacts, fireFacts]).length ? unique([vaporFacts, fireFacts]).join(' · ') : NO_DATA;
    const environmentalRunoff = runoffFacts.length ? runoffFacts.join(' · ') : NO_DATA;
    const entryDecision = offensiveAvailable
      ? `Technician entry may be considered for the defined source-control task using ${lifeSafety.specificValues.protectionLevel}; maintain backup, rescue, decon, and continuous monitoring.`
      : `Remain non-entry unless Incident Command authorizes a defined task after ${lifeSafety.specificValues.protectionLevel === NO_DATA ? 'respiratory and chemical protection' : lifeSafety.specificValues.protectionLevel} and all entry conditions are verified.`;
    const directGuidance = `${tacticalPosture}. ${postureReason}`;
    const entryPrerequisites = unique([
      'Positive chemical and container identification',
      'Defined task, entry objective, and termination point',
      lifeSafety.specificValues.protectionLevel === NO_DATA ? 'Verified task-specific PPE and respiratory protection' : lifeSafety.specificValues.protectionLevel,
      'Field monitoring',
      'Current wind, weather, and upwind/uphill approach',
      'Suit compatibility for the assigned task',
      leakControlEquipmentRequirement,
      'Backup team, rapid intervention / rescue, and technical decon ready',
      'Agency SOP',
      'Incident Command approval',
    ]);
    const requiredVerification = unique([missingData, values(plumeState?.missingInputs), entryPrerequisites]);
    const abortCriteria = unique([
      'Unexpected pressure, bulging, violent reaction, flame impingement, or container instability',
      'Monitoring reaches an action level or changes outside the entry plan',
      'Loss of communications, water supply, backup team, rescue capability, or decon',
      'PPE breach, heat stress, low-air alarm, responder distress, or changing wind',
      nonInterventionFacts,
    ]);
    const recommendedRoute = unique([
      'Confirm the product, container, release point, physical state, and current hazards from an upwind/uphill position.',
      'Establish ERG isolation, hot/warm/cold zones, access control, and downwind protective actions; verify with monitoring.',
      `Implement ${lifeSafety.specificValues.protectionLevel === NO_DATA ? 'verified task-specific PPE' : lifeSafety.specificValues.protectionLevel}, entry control, backup/rescue, and technical decon.`,
      offensiveAvailable
        ? `Conduct the defined source-control task: ${sourceControlPlan.join(' · ')}`
        : confinementFacts.length
          ? `Confine migration without entering the release point: ${confinementFacts.join(' · ')}`
          : 'Maintain isolation, protect exposures, monitor conditions, and obtain chemical-specific control guidance.',
      vaporFireControl !== NO_DATA ? `Apply only verified vapor/fire controls: ${vaporFireControl}` : '',
      environmentalRunoff !== NO_DATA ? `Protect drains, waterways, and runoff paths: ${environmentalRunoff}` : '',
      'Confirm control effectiveness with monitoring, terminate before conditions exceed the plan, and complete technical decon.',
    ]);

    return {
      decision: directDecision({
        status: tacticalPosture,
        primaryDecision: tacticalPosture,
        directGuidance,
        tacticalActions: [
          ...recommendedRoute,
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
          recommendedRoute,
          sourceControlOptions: sourceControlPlan.length ? sourceControlPlan : [NO_DATA],
          confinementOptions: confinementFacts.length ? confinementFacts : [NO_DATA],
          entryPrerequisites,
          abortCriteria,
          postureReason,
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
        recommendedRoute,
        sourceControlOptions: sourceControlPlan.length ? sourceControlPlan : [NO_DATA],
        confinementOptions: confinementFacts.length ? confinementFacts : [NO_DATA],
        entryPrerequisites,
        abortCriteria,
        postureReason,
        requiredVerification,
        executionNote: MITIGATION_EXECUTION_NOTE,
      },
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
    return {
      blocked: false,
      ...decisions,
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
    buildGuidedResponseDecisions,
  });
})(globalThis);
