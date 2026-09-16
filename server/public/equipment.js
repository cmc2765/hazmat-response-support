/* Equipment page ownership. Monitor inventory CRUD remains in
   monitor-inventory.js; this module owns page activation and tab state. */
(() => {
  let initialized = false;

  function showMonitorPanel(targetId) {
    const root = document.getElementById('monitor');
    const targetPanel = document.getElementById(targetId);
    if (!root || !targetPanel?.classList.contains('monitor-tab-panel')) return;

    root.querySelectorAll('#monitor-tabs [data-monitor-tab]').forEach((tab) => {
      const active = tab.dataset.monitorTab === targetId;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    root.querySelectorAll('.monitor-tab-panel').forEach((panel) => {
      const active = panel === targetPanel;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  }

  function initializeEquipmentPage(context = {}) {
    const root = document.getElementById('monitor');
    if (!root) return;

    if (!initialized) {
      root.querySelector('#monitor-tabs')?.addEventListener('click', (event) => {
        const tab = event.target.closest('[data-monitor-tab]');
        if (tab) showMonitorPanel(tab.dataset.monitorTab);
      });
      initialized = true;
      root.dataset.lifecycleInitialized = 'true';
    }

    root.dataset.lifecycleContext = context.sourcePage || 'navigation';
    const activePanel = root.querySelector('.monitor-tab-panel.active')?.id || 'monitor-live';
    showMonitorPanel(activePanel);
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.initializeEquipmentPage = initializeEquipmentPage;
  if (document.getElementById('monitor')?.classList.contains('active')) initializeEquipmentPage();
})();
