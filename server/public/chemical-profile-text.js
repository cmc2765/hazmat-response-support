(() => {
  const NO_DATA = 'No Current Data Exists';
  const emptyPlaceholder = /^(?:none|n\/?a|not available|no data|null|undefined|unknown)$/i;
  const continuation = /^(?:and|or|then|with|when|as|if appropriate)\b/i;
  const conditional = /^(?:If|When|For|During|After|Before)\b/;
  const action = /^(?:remove|move|add|use|place|flush|wash|rinse|decontaminate|ventilate|isolate|evacuate|shelter|monitor|verify|contact|call|provide|administer|maintain|avoid|keep|wear|don|doff|establish|collect|contain|control|treat|support|perform|discontinue|begin|continue|ensure)\b/i;
  const protectedDetail = /(?:\d|\b(?:CAS|UN\/?NA|ERG|AEGL|IDLH|REL|PEL|TLV|ERPG|TEEL|ppm|mg\/m[³3]|feet|foot|ft|meter|mile|km|source|warning|caution|danger|limitation)\b)/i;

  function normalizeChemicalProfileText(text) {
    const value = String(text ?? '')
      .normalize('NFKC')
      .replace(/\\(?:r\\n|[nrt])/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/^\s*(?:#{1,6}|[-*•]+)\s*/, '')
      .replace(/([.!?])["']\s*\.\s*$/, '$1')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!value) return '';
    return /^No Current Data Exists\.?$/i.test(value) ? NO_DATA : value;
  }

  function isEmpty(value) {
    const normalized = normalizeChemicalProfileText(value);
    return !normalized || emptyPlaceholder.test(normalized) || /^No Current Data Exists\.?$/i.test(normalized);
  }

  function normalizeEmptyState(value) {
    const normalized = normalizeChemicalProfileText(value);
    return !normalized || emptyPlaceholder.test(normalized) ? NO_DATA : normalized;
  }

  function comparisonKey(value) {
    return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function finishGuidanceSentence(value) {
    let result = value.trim();
    if (action.test(result) && /^[a-z]/.test(result)) result = result[0].toUpperCase() + result.slice(1);
    if ((action.test(result) || conditional.test(result)) && !protectedDetail.test(result) && !/[.!?;:]$/.test(result)) result += '.';
    return result;
  }

  function mergeBrokenGuidanceFragments(items) {
    const normalized = items.flat(Infinity).map(normalizeChemicalProfileText).filter((item) => !isEmpty(item));
    const merged = [];
    normalized.forEach((current) => {
      const currentKey = comparisonKey(current);
      if (!currentKey || merged.some((item) => comparisonKey(item) === currentKey)) return;
      const words = currentKey.split(' ');
      if (words.length <= 2 && action.test(current) && merged.some((item) => {
        const priorWords = comparisonKey(item).split(' ');
        return words.every((word) => priorWords.includes(word));
      })) return;
      const previous = merged.at(-1);
      if (previous && continuation.test(current) && !protectedDetail.test(current)) {
        merged[merged.length - 1] = `${previous.replace(/[.;:]$/, '')} ${current}`;
      } else if (previous && conditional.test(previous) && !/[.!?:;]$/.test(previous)
        && action.test(current) && /^[a-z]/.test(current) && !protectedDetail.test(current)) {
        merged[merged.length - 1] = `${previous}, ${current}`;
      } else merged.push(current);
    });
    return merged.map(finishGuidanceSentence);
  }

  function removeContradictoryEmptyStates(items) {
    const meaningful = items.flat(Infinity).map(normalizeChemicalProfileText).filter((item) => !isEmpty(item));
    return meaningful.length ? meaningful : [NO_DATA];
  }

  function normalizeGuidanceItems(items) {
    return removeContradictoryEmptyStates(mergeBrokenGuidanceFragments(items));
  }

  const aeglTimeframes = [
    { label: '< 1 Hour', includes: (minutes) => minutes < 60 },
    { label: '1-4 Hours', includes: (minutes) => minutes >= 60 && minutes <= 240 },
    { label: '4-8 Hours', includes: (minutes) => minutes > 240 && minutes <= 480 },
    { label: '8-12 Hours', includes: (minutes) => minutes > 480 && minutes <= 720 },
  ];

  function parseAeglConcern(value) {
    const [rawKey, ...valueParts] = String(value ?? '').split(':');
    const match = rawKey.trim().match(/^AEGL([123])[_\s-]?(\d+(?:\.\d+)?)(min|hr|hour|hours)$/i);
    const displayValue = valueParts.join(':').trim();
    if (!match || !displayValue || isEmpty(displayValue)) return null;
    const duration = Number(match[2]);
    const minutes = /^min$/i.test(match[3]) ? duration : duration * 60;
    const numeric = displayValue.match(/(\d+(?:\.\d+)?)(?:\s*[x×]\s*10\^?\s*([+-]?\d+))?/i);
    const concentration = numeric
      ? Number(numeric[1]) * (numeric[2] ? 10 ** Number(numeric[2]) : 1)
      : Number.NaN;
    return { level: Number(match[1]), minutes, value: displayValue, concentration };
  }

  function groupAeglByTimeframe(values) {
    const entries = (Array.isArray(values) ? values : [values]).map(parseAeglConcern).filter(Boolean);
    if (!entries.length) return [];
    return aeglTimeframes.map((timeframe) => {
      const levels = [1, 2, 3].map((level) => {
        const candidates = entries.filter((entry) => entry.level === level && timeframe.includes(entry.minutes));
        const comparable = candidates.filter((entry) => Number.isFinite(entry.concentration));
        const selected = comparable.length
          ? comparable.reduce((lowest, entry) => entry.concentration < lowest.concentration ? entry : lowest)
          : candidates[0];
        return `AEGL-${level}: ${selected?.value || NO_DATA}`;
      });
      return { label: timeframe.label, value: levels.join(' · ') };
    });
  }

  window.HazMatChemicalProfileText = {
    NO_DATA,
    isEmpty,
    normalizeChemicalProfileText,
    normalizeGuidanceItems,
    mergeBrokenGuidanceFragments,
    removeContradictoryEmptyStates,
    normalizeEmptyState,
    groupAeglByTimeframe,
    normalizeHeading: (text) => normalizeChemicalProfileText(text).replace(/[:.]+$/, ''),
    normalizeSourceLabel: (text) => normalizeEmptyState(normalizeChemicalProfileText(text)
      .replace(/^Linked\s+/i, '')
      .replace(/^Chemical Companion Master$/i, 'Chemical Companion')),
  };
})();
