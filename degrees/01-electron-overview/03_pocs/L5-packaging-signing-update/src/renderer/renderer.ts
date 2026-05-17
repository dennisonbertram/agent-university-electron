/**
 * L3 renderer entry. Mostly minimal — Playwright drives the behavioral surface
 * via `window.evaluate` calls into the contextBridge api. The renderer wires
 * a drop-zone listener that uses `window.api.getPathForFile(file)` (the modern
 * replacement for the removed `File.path`, per REF-03 / Electron 32) and
 * forwards the extracted paths to main via `window.api.filesDropped(paths)`.
 */

function paint(): void {
  const status = document.getElementById('status')
  if (status) status.textContent = 'L3 renderer loaded — call window.api.* from tests'
}

function wireDropZone(): void {
  const zone = document.getElementById('drop-zone')
  if (!zone) return

  zone.addEventListener('dragover', (event) => {
    event.preventDefault()
  })

  zone.addEventListener('drop', (event) => {
    event.preventDefault()
    const dt = event.dataTransfer
    if (!dt) return
    const api = (window as unknown as {
      api: {
        getPathForFile: (file: File) => string
        filesDropped: (paths: string[]) => Promise<unknown>
      }
    }).api
    const paths: string[] = []
    for (let i = 0; i < dt.files.length; i++) {
      const file = dt.files.item(i)
      if (file) {
        paths.push(api.getPathForFile(file))
      }
    }
    if (paths.length > 0) {
      void api.filesDropped(paths)
    }
  })
}

function init(): void {
  paint()
  wireDropZone()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
