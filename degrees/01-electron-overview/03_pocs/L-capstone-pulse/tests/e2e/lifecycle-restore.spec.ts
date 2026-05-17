/**
 * BT-C-9: quit + relaunch ⇒ journal entries restored, state machine resets to idle.
 */
import { test, expect } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { launchApp, waitForEvent, callApi, findEvents } from './helpers'

test.describe.serial('Pulse lifecycle restore', () => {
  test('BT-C-9: relaunch restores journal rows; focus state resets to idle', async () => {
    const userDataDir = mkdtempSync(path.join(tmpdir(), 'pulse-lifecycle-'))

    // First launch — write some entries and start a session.
    const first = await launchApp({ userDataDir, extraEnv: { TOUCH_ID_UNAVAILABLE: '1' } })
    try {
      const win = await first.app.firstWindow()
      await waitForEvent(first.logFile, 'app:install-complete', 15_000)
      await callApi(win, 'testFireDeepLink', { url: 'pulse://log?text=first-entry' })
      await waitForEvent(first.logFile, 'journal:append:1-row', 5_000)
      await callApi(win, 'testFireDeepLink', { url: 'pulse://log?text=second-entry' })
      await callApi(win, 'focusStart', { durationMs: 60_000 })
    } finally {
      await first.app.close()
    }

    // Second launch — assert restore.
    const second = await launchApp({ userDataDir, extraEnv: { TOUCH_ID_UNAVAILABLE: '1' } })
    try {
      const win = await second.app.firstWindow()
      await waitForEvent(second.logFile, 'app:install-complete', 15_000)
      // The boot logger emits `boot:restored:N-journal-entries` with N rows present.
      // The boot-summary IPC carries the same number; use it directly so we
      // don't have to encode N (and don't have to grep for a regex).
      const summary = await callApi<{ journalRowsAtBoot: number }>(win, 'testGetBootSummary')
      expect(summary.journalRowsAtBoot).toBeGreaterThanOrEqual(2)

      // The boot-restored log marker is also emitted (substring-match the
      // event family — the exact event includes the count).
      const restoredMarkers = findEvents(second.logFile, `boot:restored:${summary.journalRowsAtBoot}-journal-entries`)
      expect(restoredMarkers.length).toBeGreaterThan(0)

      // Focus state resets to idle.
      const s = await callApi<{ kind: string }>(win, 'focusState')
      expect(s.kind).toBe('idle')
    } finally {
      await second.app.close()
    }
  })
})
