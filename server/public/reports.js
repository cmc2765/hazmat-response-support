/* Reports page ownership. Shared incident persistence/rendering remains behind
   the reportsApi bridge exposed by script.js; this module owns lifecycle and
   Reports-only controls. */
(() => {
  let initialized = false;

  function reportsApi() {
    return window.HazMatIQ?.reportsApi;
  }

  function selectReportTab(button) {
    const selected = button?.dataset.reportTab;
    if (!selected) return;
    const root = document.getElementById('report');
    if (!root) return;
    root.querySelectorAll('[data-report-tab]').forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle('primary-btn', active);
      tab.classList.toggle('ghost-btn', !active);
    });
    ['current', 'previous', 'library'].forEach((name) => {
      const section = document.getElementById(`report-${name}-section`);
      if (section) section.hidden = name !== selected;
    });
    reportsApi()?.renderIncidentLists?.();
    if (selected === 'current') document.getElementById('current-incident-options')?.focus();
  }

  function handleReportClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    const api = reportsApi();
    if (!api) return;
    if (target.matches('[data-report-tab]')) {
      selectReportTab(target);
    } else if (target.id === 'open-current-incident-summary-btn') {
      const activeId = api.getActiveIncidentId();
      if (activeId) api.openIncidentSummary(activeId);
    } else if (target.id === 'back-to-incident-reports-btn') {
      api.closeIncidentSummary();
    } else if (target.id === 'edit-incident-summary-btn') {
      const incident = api.getIncidentById(api.getOpenIncidentSummaryId());
      if (incident?.status === 'Completed') api.renderCompletedReportEditor(incident);
    } else if (target.id === 'cancel-incident-summary-edit-btn') {
      if (api.getOpenIncidentSummaryId()) api.openIncidentSummary(api.getOpenIncidentSummaryId());
    } else if (target.id === 'save-incident-summary-btn') {
      api.saveCompletedReportEdits();
    } else if (target.id === 'print-incident-summary-btn') {
      window.print();
    } else if (target.id === 'edit-ics-form-btn') {
      api.setIcsFormEditing(true);
    } else if (target.id === 'save-ics-form-btn') {
      api.saveOpenIcsForm();
    } else if (target.id === 'download-ics-form-btn') {
      void api.openIcsPdf();
    } else if (target.id === 'back-from-ics-form-btn') {
      api.closeOpenIcsForm();
    }
  }

  function initializeReportsPage(context = {}) {
    const root = document.getElementById('report');
    if (!root) return;
    if (!initialized) {
      root.addEventListener('click', handleReportClick);
      document.querySelectorAll('[data-report-shortcut]').forEach((button) => {
        button.addEventListener('click', () => {
          const tab = root.querySelector(`[data-report-tab="${button.dataset.reportShortcut}"]`);
          if (tab) selectReportTab(tab);
        });
      });
      initialized = true;
      root.dataset.lifecycleInitialized = 'true';
    }
    root.dataset.lifecycleContext = context.sourcePage || 'navigation';
    if (context.incidentId) root.dataset.activeIncidentId = context.incidentId;
    const incident = context.incidentId ? reportsApi()?.getIncidentById?.(context.incidentId) : null;
    const prefill = window.HazMatIQ.buildIcsPrefill?.(incident || undefined);
    if (prefill?.incidentId) root.dataset.icsPrefillIncidentId = prefill.incidentId;
    reportsApi()?.renderIncidentLists?.();
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.initializeReportsPage = initializeReportsPage;
  if (document.getElementById('report')?.classList.contains('active')) initializeReportsPage();
})();
