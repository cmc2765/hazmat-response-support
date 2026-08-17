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

  function explicitProtectionLevels(sourceValues) {
    const levels = new Set();
    sourceValues.forEach((value) => {
      if (/\blevel\s*a\b/i.test(value)) levels.add('Level A Vapor Protective Suit + SCBA');
      if (/\blevel\s*b\b/i.test(value)) levels.add('Level B Chemical Protective Suit + SCBA');
      if (/\blevel\s*c\b/i.test(value)) levels.add('Level C Chemical Protective Suit + APR/PAPR verification required');
      if (/\blevel\s*d\b/i.test(value)) levels.add('Level D / No chemical protective ensemble required');
    });
    return [...levels];
  }

  function buildLifeSafety(selectedChemical, linkedSources, sources) {
    const profile = linkedSources.profile || {};
    const ergPpe = unique(linkedSources.responderGuide?.publicSafety?.protectiveClothing);
    const nioshPpe = unique([
      linkedSources.ppeComponents?.niosh?.respiratory,
      linkedSources.ppeComponents?.niosh?.skin,
      linkedSources.ppeComponents?.niosh?.eye,
    ]);
    const mappedPpe = unique(linkedSources.ppeReference);
    const companionPpe = unique([
      profile.ppeRespiratory?.aprPaprScba,
      profile.ppeRespiratory?.recommendedPpe,
      profile.ppeRespiratory?.gloveSuitMaterial,
    ]);
    const decisionFacts = unique([ergPpe, nioshPpe, mappedPpe, companionPpe]);
    const scbaFacts = decisionFacts.filter((value) => /\bSCBA\b|self-contained breathing apparatus/i.test(value));
    const negativeScba = scbaFacts.filter((value) => /\b(?:no|not)\b[^.]{0,30}\bSCBA\b|\bSCBA\b[^.]{0,20}\bnot\b/i.test(value));
    const conditionalScba = scbaFacts.filter((value) => /\b(?:if|when|escape only|strongly indicated|strongly recommended)\b/i.test(value));
    const mandatoryScba = scbaFacts.filter((value) => !negativeScba.includes(value) && !conditionalScba.includes(value));
    const scbaConflict = negativeScba.length > 0 && (mandatoryScba.length > 0 || conditionalScba.length > 0);
    const scbaDecision = scbaConflict
      ? REVIEW
      : mandatoryScba.length
        ? 'SCBA MANDATED'
        : conditionalScba.length
          ? 'SCBA STRONGLY INDICATED'
          : decisionFacts.some((value) => /\b(?:respirator|APR|PAPR|cartridge|canister)\b/i.test(value))
            ? 'RESPIRATOR / CARTRIDGE SELECTION REQUIRES VERIFICATION'
            : NO_DATA;

    const levels = explicitProtectionLevels(decisionFacts);
    const protectionConflict = levels.length > 1
      || (scbaDecision === 'SCBA MANDATED' && levels.some((level) => /Level C|Level D/.test(level)))
      || (levels.some((level) => /Level A|Level B/.test(level))
        && !/^SCBA (?:MANDATED|STRONGLY INDICATED)$/.test(scbaDecision));
    const protectionLevel = protectionConflict
      ? REVIEW
      : levels.length === 1
        ? levels[0]
        : NO_DATA;
    const cartridgeStatus = scbaDecision === 'SCBA MANDATED'
      ? 'Not displayed — SCBA is mandated.'
      : /Level C/.test(protectionLevel)
        ? 'Cartridge selection requires verification with approved source data and agency SOP.'
        : NO_DATA;
    const downgradeConditions = scbaDecision === 'SCBA MANDATED'
      ? ['Air monitoring', 'Verified concentration', 'Oxygen verification', 'Suit compatibility', 'Agency SOP', 'Incident Command approval']
      : [];
    const missingData = [];
    if (scbaDecision === NO_DATA) missingData.push('SCBA / respiratory decision');
    if (protectionLevel === NO_DATA) missingData.push('OSHA protection level');
    if (!unique(profile.ppeRespiratory?.gloveSuitMaterial).length) missingData.push('Suit compatibility');
    const conflicts = [
      ...(scbaConflict ? ['Conflicting SCBA source facts'] : []),
      ...(protectionConflict ? [`Conflicting protection levels: ${levels.join(', ')}`] : []),
    ];
    const supportingSources = sourceSummary(sources, [
      mappedPpe.length || companionPpe.length ? 'Chemical Companion' : '',
      ergPpe.length ? 'ERG' : '',
      nioshPpe.length ? 'NIOSH' : '',
      values(linkedSources.approvedSources).some((source) => canonicalSource(source) === 'CAMEO') && mappedPpe.length ? 'CAMEO' : '',
    ]);
    const entryGuidance = scbaDecision === 'SCBA MANDATED'
      ? `Entry requires ${protectionLevel === NO_DATA ? 'a verified chemical protective ensemble' : protectionLevel}. Downgrade only after ${downgradeConditions.join(', ').toLowerCase()} support downgrade.`
      : scbaDecision === NO_DATA
        ? 'Do not select entry respiratory protection until approved-source data is verified.'
        : 'Verify contaminant, concentration, oxygen, respiratory equipment, suit compatibility, agency SOP, and Incident Command approval before entry.';
    const directGuidance = conflicts.length
      ? `${REVIEW}: ${conflicts.join('; ')}.`
      : `${scbaDecision}. ${protectionLevel === NO_DATA ? 'Protection Level: No Current Data Exists.' : `Protection Level: ${protectionLevel}.`} ${entryGuidance}`;

    const evidence = {
      chemicalName: text(selectedChemical.chemicalName) || NO_DATA,
      masterChemicalId: selectedChemical.masterChemicalId ?? null,
      scbaDecision,
      protectionLevel,
      sourceBacked: decisionFacts.length > 0 && !conflicts.length,
      supportingSources,
      sourceFactsUsed: decisionFacts,
      triggerReasons: unique([
        mandatoryScba.length ? 'Explicit approved-source SCBA direction' : '',
        conditionalScba.length ? 'Conditional approved-source SCBA direction' : '',
        levels.length ? 'Explicit approved-source protection-level direction' : '',
        ...conflicts,
      ]),
      idlhValue: text(profile.exposures?.idlh) || NO_DATA,
      idlhSource: text(profile.exposures?.idlh) ? 'Chemical Companion / linked NIOSH data' : NO_DATA,
      respiratoryBasis: join(scbaFacts),
      skinVaporBasis: join(decisionFacts.filter((value) => /skin|vapor|encapsulat|suit/i.test(value))),
      cwaOrCbrnBasis: join(decisionFacts.filter((value) => /CWA|CBRN|chemical warfare/i.test(value))),
      unknownConcentrationBasis: join(decisionFacts.filter((value) => /unknown (?:release|concentration)|IDLH/i.test(value))),
      downgradeConditions,
      limitations: unique([missingData.map((field) => `${field}: ${NO_DATA}`), ...conflicts]),
      executionNote: EXECUTION_NOTE,
      generatedAt: new Date().toISOString(),
    };

    return {
      decision: directDecision({
        status: conflicts.length ? REVIEW : scbaDecision,
        primaryDecision: scbaDecision,
        directGuidance,
        tacticalActions: [entryGuidance],
        specificValues: { scbaDecision, protectionLevel, cartridgeStatus, downgradeConditions },
        missingData,
        sourceSummary: supportingSources,
        limitations: evidence.limitations,
        confidence: conflicts.length ? 'Conflicting source facts — specialist review required' : (decisionFacts.length ? 'Source-backed' : 'No verified decision data'),
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
    const missingData = [];
    if (!ergGuide) missingData.push('ERG guide');
    if (!initialIsolation) missingData.push('Initial isolation distance');
    if (protectiveAction === NO_DATA) missingData.push('Protective action distance');
    if (evacuationShelter === NO_DATA) missingData.push('Evacuation / shelter-in-place guidance');
    if (/(?:requires|needs) verification|manual|stale|recent/i.test(weatherStatus)) missingData.push('Current wind / weather verification');
    if (endpointSelected === NO_DATA) missingData.push('AEGL / LOC endpoint');
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
