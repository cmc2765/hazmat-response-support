/* Settings workspace ownership: application-wide theme selection and source
   registry disclosure live here instead of inside the responsive nav drawer. */
(() => {
  let initialized = false;

  function initializeSettingsPage() {
    if (!initialized) {
      document.querySelectorAll('[data-theme-choice]').forEach((button) => {
        button.addEventListener('click', () => window.HazMatIQ.applyApplicationTheme?.(button.dataset.themeChoice));
      });
      document.getElementById('settings-sources-toggle')?.addEventListener('click', (event) => {
        const button = event.currentTarget;
        const panel = document.getElementById('settings-sources-panel');
        if (!panel) return;
        const open = panel.hidden;
        panel.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        button.textContent = open ? 'Close Sources' : 'Open Sources';
      });
      initialized = true;
    }
    const theme = document.documentElement.dataset.theme || 'dark';
    window.HazMatIQ.applyApplicationTheme?.(theme, { persist: false });
  }

  window.HazMatIQ ||= {};
  window.HazMatIQ.initializeSettingsPage = initializeSettingsPage;
})();
