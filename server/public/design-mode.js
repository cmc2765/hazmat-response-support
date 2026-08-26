(function initializeHazmatIqDesignMode() {
  'use strict';

  const layoutStorageKey = 'hazmatiq_layout_overrides';
  const preferenceStorageKey = 'hazmatiq_design_mode_preferences';
  const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const minimums = {
    default: { width: 260, height: 140 },
    hero: { width: 320, height: 180 },
    map: { width: 420, height: 300 },
    search: { width: 320, height: 180 },
  };

  let activePointer = null;
  let overrides = readJson(layoutStorageKey, {});
  let preferences = { active: false, snap: true, gridSize: 8, ...readJson(preferenceStorageKey, {}) };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(window.localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function savePreferences() {
    window.localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
  }

  function saveOverrides() {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(overrides));
  }

  function snap(value) {
    if (!preferences.snap) return Math.round(value);
    return Math.round(value / preferences.gridSize) * preferences.gridSize;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  }

  function pageLabel(pageId) {
    return ({ home: 'Home Page', lookup: 'Hazard ID', incident: 'Incident Command', plume: 'Plume Model', 'planning-tools': 'Planning Tools' })[pageId] || pageId;
  }

  function activePageId() {
    const id = document.querySelector('.content-area > .view.active')?.id || 'overview';
    return id === 'overview' ? 'home' : id;
  }

  function minimumFor(element) {
    const layoutId = element.dataset.designLayout || '';
    if (layoutId === 'plume.map') return minimums.map;
    if (layoutId.startsWith('home.')) return minimums.hero;
    if (layoutId.endsWith('.hero')) return minimums.hero;
    if (layoutId.startsWith('hazardId.')) return minimums.search;
    return minimums.default;
  }

  function setElementOverride(element, override) {
    element.style.setProperty('--design-x', `${override.x || 0}px`);
    element.style.setProperty('--design-y', `${override.y || 0}px`);
    element.style.width = Number.isFinite(override.width) ? `${override.width}px` : '';
    element.style.height = Number.isFinite(override.height) ? `${override.height}px` : '';
  }

  function clearElementOverride(element) {
    element.style.removeProperty('--design-x');
    element.style.removeProperty('--design-y');
    element.style.width = '';
    element.style.height = '';
  }

  function updateReadout(element, values) {
    const readout = element.querySelector(':scope > .design-size-readout');
    if (!readout) return;
    const rect = element.getBoundingClientRect();
    const data = values || {
      x: overrides[element.dataset.designLayout]?.x || 0,
      y: overrides[element.dataset.designLayout]?.y || 0,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    readout.textContent = `${element.dataset.designLayout}\nx: ${Math.round(data.x)} y: ${Math.round(data.y)}\nw: ${Math.round(data.width)} h: ${Math.round(data.height)}`;
  }

  function applySavedLayout(element) {
    const override = overrides[element.dataset.designLayout];
    if (preferences.active && override) setElementOverride(element, override);
    else clearElementOverride(element);
    window.requestAnimationFrame(() => updateReadout(element));
  }

  function decorate(element) {
    if (element.dataset.designReady === 'true') return;
    element.dataset.designReady = 'true';
    element.classList.add('design-adjustable');

    const dragHandle = document.createElement('span');
    dragHandle.className = 'design-drag-handle';
    dragHandle.textContent = 'DRAG';
    dragHandle.setAttribute('aria-hidden', 'true');
    element.append(dragHandle);

    const readout = document.createElement('output');
    readout.className = 'design-size-readout';
    readout.setAttribute('aria-live', 'off');
    element.append(readout);

    corners.forEach((corner) => {
      const handle = document.createElement('span');
      handle.className = `design-resize-handle ${corner}`;
      handle.dataset.resizeCorner = corner;
      handle.setAttribute('aria-hidden', 'true');
      element.append(handle);
    });
    applySavedLayout(element);
  }

  function syncHazardSearchLayout() {
    const search = document.querySelector('[data-design-hazard-search]');
    if (!search) return;
    const mode = document.querySelector('.hazard-search-tab.active')?.dataset.hazardSearchTab || 'CHEMICAL';
    const layoutId = ({ CHEMICAL: 'hazardId.chemicalSearch', CBRNE_CWA: 'hazardId.cbrneSearch', RADIOLOGICAL: 'hazardId.radiologicalSearch' })[mode];
    if (!layoutId || search.dataset.designLayout === layoutId) return;
    clearElementOverride(search);
    search.dataset.designLayout = layoutId;
    applySavedLayout(search);
  }

  function refreshElements() {
    syncHazardSearchLayout();
    document.querySelectorAll('[data-design-layout]').forEach(decorate);
    document.querySelectorAll('[data-design-layout]').forEach((element) => {
      if (preferences.active) applySavedLayout(element);
      else clearElementOverride(element);
    });
  }

  function beginPointer(event) {
    if (!preferences.active || event.button !== 0) return;
    const element = event.target.closest('[data-design-layout]');
    if (!element || !element.closest('.view.active')) return;
    const resizeHandle = event.target.closest('.design-resize-handle');
    if (!resizeHandle && event.target.closest('.design-size-readout')) return;

    event.preventDefault();
    event.stopPropagation();
    const rect = element.getBoundingClientRect();
    const saved = overrides[element.dataset.designLayout] || {};
    activePointer = {
      pointerId: event.pointerId,
      element,
      layoutId: element.dataset.designLayout,
      mode: resizeHandle ? 'resize' : 'drag',
      corner: resizeHandle?.dataset.resizeCorner || null,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: Number(saved.x) || 0,
      startY: Number(saved.y) || 0,
      startWidth: rect.width,
      startHeight: rect.height,
      startRect: rect,
    };
    document.querySelectorAll('.design-selected').forEach((selected) => selected.classList.remove('design-selected'));
    element.classList.add('design-selected');
    document.body.classList.add('design-pointer-active');
    element.setPointerCapture?.(event.pointerId);
  }

  function movePointer(event) {
    if (!activePointer || event.pointerId !== activePointer.pointerId) return;
    event.preventDefault();
    const state = activePointer;
    const dx = snap(event.clientX - state.startClientX);
    const dy = snap(event.clientY - state.startClientY);
    let x = state.startX;
    let y = state.startY;
    let width = state.startWidth;
    let height = state.startHeight;

    if (state.mode === 'drag') {
      const minDx = 48 - state.startRect.right;
      const maxDx = window.innerWidth - 48 - state.startRect.left;
      const documentTop = state.startRect.top + window.scrollY;
      const minDy = 48 - (documentTop + state.startRect.height);
      const maxDy = Math.max(document.documentElement.scrollHeight, window.innerHeight) - 48 - documentTop;
      x = state.startX + clamp(dx, minDx, maxDx);
      y = state.startY + clamp(dy, minDy, maxDy);
    } else {
      const minimum = minimumFor(state.element);
      const isLeft = state.corner.includes('left');
      const isTop = state.corner.includes('top');
      width = snap(isLeft ? state.startWidth - dx : state.startWidth + dx);
      height = snap(isTop ? state.startHeight - dy : state.startHeight + dy);
      width = clamp(width, minimum.width, Math.max(minimum.width, window.innerWidth - 24));
      height = clamp(height, minimum.height, Math.max(minimum.height, window.innerHeight * 1.5));
      if (isLeft) x = state.startX + (state.startWidth - width);
      if (isTop) y = state.startY + (state.startHeight - height);
      x = clamp(
        x,
        state.startX + 48 - (state.startRect.left + width),
        state.startX + window.innerWidth - 48 - state.startRect.left,
      );
    }

    const next = { x: snap(x), y: snap(y), width: snap(width), height: snap(height) };
    setElementOverride(state.element, next);
    updateReadout(state.element, next);
    state.pending = next;
  }

  function endPointer(event) {
    if (!activePointer || event.pointerId !== activePointer.pointerId) return;
    const state = activePointer;
    if (state.pending) {
      overrides[state.layoutId] = { ...state.pending, updatedAt: new Date().toISOString() };
      saveOverrides();
    }
    state.element.releasePointerCapture?.(event.pointerId);
    document.body.classList.remove('design-pointer-active');
    window.dispatchEvent(new Event('resize'));
    activePointer = null;
  }

  function setActive(active) {
    preferences.active = active;
    savePreferences();
    document.body.classList.toggle('design-mode-active', active);
    document.querySelector('#design-mode-toolbar')?.classList.toggle('active', active);
    const toggle = document.querySelector('#design-mode-toggle');
    if (toggle) {
      toggle.textContent = active ? 'Exit Design Mode' : 'Design Mode';
      toggle.setAttribute('aria-pressed', String(active));
    }
    refreshElements();
  }

  function visiblePageElements() {
    const pageId = activePageId();
    const elements = [...document.querySelectorAll(`[data-design-page="${pageId}"][data-design-layout]`)]
      .filter((element) => !element.hidden && element.getClientRects().length);
    return [...new Map(elements.map((element) => [element.dataset.designLayout, element])).values()];
  }

  function exportLayout() {
    const pageId = activePageId();
    const timestamp = new Date().toISOString();
    const layouts = visiblePageElements().map((element) => {
      const rect = element.getBoundingClientRect();
      const saved = overrides[element.dataset.designLayout] || {};
      return {
        pageId,
        layoutId: element.dataset.designLayout,
        x: Math.round(saved.x || 0),
        y: Math.round(saved.y || 0),
        width: Math.round(saved.width || rect.width),
        height: Math.round(saved.height || rect.height),
        gridSize: preferences.snap ? preferences.gridSize : null,
        viewportWidth: window.innerWidth,
        timestamp,
      };
    });
    const lines = [`Page: ${pageLabel(pageId)}`, ...layouts.map((item) => `${item.layoutId}: x ${item.x}, y ${item.y}, width ${item.width}, height ${item.height}`)];
    return JSON.stringify({ pageId, gridSize: preferences.snap ? preferences.gridSize : null, viewportWidth: window.innerWidth, timestamp, layouts, summary: lines.join('\n') }, null, 2);
  }

  async function copyLayout() {
    const value = exportLayout();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement('textarea');
      input.value = value;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    const status = document.querySelector('#design-mode-status');
    if (status) status.textContent = `${pageLabel(activePageId())} layout JSON copied.`;
  }

  function resetPage() {
    const pageId = activePageId();
    const namespace = ({ home: 'home.', lookup: 'hazardId.', incident: 'incidentCommand.', plume: 'plume.', 'planning-tools': 'planningTools.' })[pageId];
    Object.keys(overrides).filter((id) => namespace && id.startsWith(namespace)).forEach((id) => delete overrides[id]);
    saveOverrides();
    refreshElements();
    const status = document.querySelector('#design-mode-status');
    if (status) status.textContent = `${pageLabel(pageId)} layout overrides reset. App data was not changed.`;
  }

  function resetAll() {
    if (!window.confirm('Reset all HazMatIQ layout overrides? Incident, chemical, CBRNE, plume, and report data will not be changed.')) return;
    overrides = {};
    window.localStorage.removeItem(layoutStorageKey);
    refreshElements();
    const status = document.querySelector('#design-mode-status');
    if (status) status.textContent = 'All layout overrides reset. App data was not changed.';
  }

  function button(label, id) {
    const element = document.createElement('button');
    element.type = 'button';
    element.id = id;
    element.textContent = label;
    return element;
  }

  function createToolbar() {
    const toolbar = document.createElement('aside');
    toolbar.id = 'design-mode-toolbar';
    toolbar.className = 'design-mode-toolbar';
    toolbar.setAttribute('aria-label', 'Prototype Design Mode');

    const toggle = button(preferences.active ? 'Exit Design Mode' : 'Design Mode', 'design-mode-toggle');
    toggle.setAttribute('aria-pressed', String(preferences.active));
    const controls = document.createElement('div');
    controls.className = 'design-mode-controls';
    const title = document.createElement('strong');
    title.textContent = 'DESIGN MODE ACTIVE';

    const snapLabel = document.createElement('label');
    const snapInput = document.createElement('input');
    snapInput.id = 'design-snap-toggle';
    snapInput.type = 'checkbox';
    snapInput.checked = preferences.snap;
    snapLabel.append(snapInput, document.createTextNode(' Snap to Grid'));

    const gridLabel = document.createElement('label');
    gridLabel.append(document.createTextNode('Grid Size '));
    const gridSelect = document.createElement('select');
    gridSelect.id = 'design-grid-size';
    [8, 12, 16].forEach((size) => {
      const option = new Option(`${size}px`, String(size), false, preferences.gridSize === size);
      gridSelect.add(option);
    });
    gridLabel.append(gridSelect);

    const note = document.createElement('p');
    note.textContent = 'Design Mode is for layout editing. Turn it off to test normal buttons.';
    const stabilization = document.createElement('p');
    stabilization.textContent = 'When the layout looks right, copy the layout JSON and ask Codex to stabilize it into CSS.';
    const status = document.createElement('output');
    status.id = 'design-mode-status';
    status.setAttribute('aria-live', 'polite');

    controls.append(title, snapLabel, gridLabel, button('Copy Layout JSON', 'design-copy-layout'), button('Reset This Page', 'design-reset-page'), button('Reset All Layout Overrides', 'design-reset-all'), note, stabilization, status);
    toolbar.append(toggle, controls);
    document.body.append(toolbar);

    toggle.addEventListener('click', () => setActive(!preferences.active));
    snapInput.addEventListener('change', () => { preferences.snap = snapInput.checked; savePreferences(); });
    gridSelect.addEventListener('change', () => { preferences.gridSize = Number(gridSelect.value); savePreferences(); });
    toolbar.querySelector('#design-copy-layout').addEventListener('click', copyLayout);
    toolbar.querySelector('#design-reset-page').addEventListener('click', resetPage);
    toolbar.querySelector('#design-reset-all').addEventListener('click', resetAll);
  }

  createToolbar();
  refreshElements();
  setActive(Boolean(preferences.active));
  document.addEventListener('pointerdown', beginPointer, true);
  document.addEventListener('pointermove', movePointer, { capture: true, passive: false });
  document.addEventListener('pointerup', endPointer, true);
  document.addEventListener('pointercancel', endPointer, true);
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-view], [data-command-view], [data-hazard-search-tab]')) window.setTimeout(refreshElements, 0);
  });

  window.HazMatIQ = window.HazMatIQ || {};
  window.HazMatIQ.designMode = Object.freeze({ exportLayout, refresh: refreshElements });
})();
