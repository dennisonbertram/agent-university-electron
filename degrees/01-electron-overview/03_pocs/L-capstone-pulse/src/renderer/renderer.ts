/**
 * Pulse renderer — minimal popover UI. Playwright drives the behavioral
 * surface via `window.api.*`; the UI is intentionally low-fidelity.
 */
function paint(): void {
  const status = document.getElementById('status')
  if (status) status.textContent = 'Pulse renderer loaded — call window.api.* from tests'
}

interface PulseApi {
  focusStart(arg: { durationMs: number }): Promise<unknown>
  focusStop(): Promise<unknown>
  focusState(): Promise<unknown>
  journalAppend(arg: { text: string }): Promise<unknown>
  journalList(): Promise<unknown>
  journalUnlockWithPassphrase(arg: { passphrase: string }): Promise<unknown>
  onFocusStateChanged(cb: (s: unknown) => void): () => void
}

function wireUi(): void {
  const api = (window as unknown as { api: PulseApi }).api
  const focusState = document.getElementById('focus-state')
  api.onFocusStateChanged((s) => {
    if (focusState && typeof s === 'object' && s !== null) {
      const kind = (s as { kind?: string }).kind ?? 'idle'
      focusState.textContent = kind
    }
  })
  const addBtn = document.getElementById('journal-add')
  const ta = document.getElementById('journal-text') as HTMLTextAreaElement | null
  if (addBtn && ta) {
    addBtn.addEventListener('click', () => {
      const text = ta.value
      if (!text) return
      void api.journalAppend({ text })
      ta.value = ''
    })
  }
  const unlockBtn = document.getElementById('journal-unlock')
  if (unlockBtn) {
    unlockBtn.addEventListener('click', () => {
      void api.journalList()
    })
  }
}

function init(): void {
  paint()
  wireUi()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
