(() => {
  const acronyms = ['PPE', 'SCBA', 'APR', 'PAPR', 'IDLH', 'AEGL', 'ERG', 'NIOSH', 'CAMEO', 'ALOHA', 'EPA', 'OSHA', 'ICS', 'NIMS'];
  const conditionalStart = /^(?:If|When|For|During|Unless|After|Before)\b/i;
  const lowercaseAction = /^(?:remove|move|add|use|place|flush|wash|rinse|decontaminate|ventilate|isolate|evacuate|shelter|monitor|verify|contact|call|provide|administer|maintain|avoid|keep|wear|don|doff|establish|collect|contain|control|treat|support|perform|discontinue|begin|continue|ensure)\b/;
  const independentWarning = /^(?:warning|caution|danger|note|source|limitation|do not|never|stop)\b/i;

  function normalizeResponderText(text) {
    const value = String(text ?? '')
      .replace(/\\(?:r\\n|[nrt])/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/^\s*\*\*(.*?)\*\*\s*$/, '$1')
      .replace(/^\s*__(.*?)__\s*$/, '$1')
      .replace(/^\s*(?:[-*•]+|#{1,6})\s*/, '')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!value || /^No Current Data Exists\.?$/i.test(value)) return value;
    return acronyms.reduce((result, acronym) => result.replace(new RegExp(`\\b${acronym}\\b`, 'gi'), acronym), value);
  }

  function normalizeSectionHeading(text) {
    return normalizeResponderText(text).replace(/[:.]+$/, '');
  }

  function canMergeConditionalFragment(current, next) {
    return conditionalStart.test(current)
      && !/[.!?:;]$/.test(current)
      && current.length <= 160
      && next.length <= 160
      && /^[a-z]/.test(next)
      && lowercaseAction.test(next)
      && !independentWarning.test(next)
      && !/\d/.test(next)
      && !/^\(?source\b|\bsource\s*:/i.test(next);
  }

  function normalizeBulletList(items) {
    const normalized = items.flat(Infinity).map(normalizeResponderText).filter(Boolean);
    const merged = [];
    for (let index = 0; index < normalized.length; index += 1) {
      const current = normalized[index];
      const next = normalized[index + 1];
      if (next && canMergeConditionalFragment(current, next)) {
        merged.push(`${current}, ${next}`);
        index += 1;
      } else merged.push(current);
    }
    return [...new Set(merged)];
  }

  window.HazMatResponderText = {
    normalizeResponderText,
    normalizeBulletList,
    normalizeSectionHeading,
    formatResponderGuidance: normalizeBulletList,
  };
})();
