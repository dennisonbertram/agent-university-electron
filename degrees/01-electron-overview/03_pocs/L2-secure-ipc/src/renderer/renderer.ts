/**
 * L2 renderer entry. Minimal — the L2 behavioral surface is exercised by
 * Playwright's `window.evaluate` calls into the contextBridge api, so the
 * renderer doesn't need to do much beyond proving it loaded.
 */

function paint(): void {
  const status = document.getElementById('status')
  if (status) status.textContent = 'L2 renderer loaded — call window.api.* from tests'
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', paint, { once: true })
} else {
  paint()
}
