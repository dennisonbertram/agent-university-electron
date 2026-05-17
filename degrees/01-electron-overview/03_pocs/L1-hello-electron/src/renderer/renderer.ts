/**
 * Renderer entry. Calls window.api.rendererReady on DOMContentLoaded so main
 * can log it (BT-L1-2 and log point #3 in observability-strategy.md L1 list).
 */

function announce(): void {
  const status = document.getElementById('status')
  try {
    window.api.rendererReady(navigator.userAgent)
    if (status) status.textContent = 'Renderer reported ready'
  } catch (err) {
    if (status) {
      status.textContent =
        'Failed to announce renderer-ready: ' +
        (err instanceof Error ? err.message : String(err))
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', announce, { once: true })
} else {
  announce()
}
