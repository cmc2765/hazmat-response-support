/* Sources page ownership. The source catalog is static markup today, so this
   lifecycle hook records page activation without duplicating rendering logic. */
(() => {
  let initialized = false;

  function initializeSourcesPage(context = {}) {
    const root = document.getElementById('source');
    if (!root) return;

    if (!initialized) {
      initialized = true;
      root.dataset.lifecycleInitialized = 'true';
    }

    root.dataset.lifecycleContext = context.sourcePage || 'navigation';
    root.dataset.sourceStatus = root.querySelector('.detail-list') ? 'available' : 'empty';
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.initializeSourcesPage = initializeSourcesPage;
  if (document.getElementById('source')?.classList.contains('active')) initializeSourcesPage();
})();
