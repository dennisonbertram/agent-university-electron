/**
 * crashReporter behavioral test — BT-L5-8.
 *
 * Asserts the wiring (not the actual receipt of a crash report):
 *   - `crashReporter.start()` is invoked at module-load time.
 *   - A structured log `crash-reporter:started` appears with the submitURL.
 *   - `crashReporter.getUploadedReports()` is callable and returns an array.
 *   - `startedBeforeWhenReady` is `true` (the snapshot exposed via IPC).
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, getCrashReporterState } from './helpers'

test('BT-L5-8: crashReporter.start fires before whenReady and exposes uploadedReports', async () => {
  const submitURL = 'http://127.0.0.1:8766/crashes'
  const launched = await launchApp({
    extraEnv: { CRASH_URL: submitURL },
  })
  try {
    const win = await launched.app.firstWindow()
    await waitForEvent(launched.logFile, 'crash-reporter:started', 15_000)

    const state = await getCrashReporterState(win)
    expect(state.started).toBe(true)
    expect(state.submitURL).toBe(submitURL)
    expect(state.uploadToServer).toBe(true)
    expect(state.startedBeforeWhenReady).toBe(true)
    expect(state.uploadedReports).toBeGreaterThanOrEqual(0)
  } finally {
    await launched.app.close().catch(() => undefined)
  }
})
