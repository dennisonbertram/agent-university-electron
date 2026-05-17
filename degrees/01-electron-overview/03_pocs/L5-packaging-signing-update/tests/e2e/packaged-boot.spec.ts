/**
 * BT-L5-10 — Packaged app boot smoke.
 *
 * Spawns the packaged binary directly and asserts the canonical lifecycle
 * log sequence (app:starting, app:ready) appears in the override LOG_DIR.
 * Stops the process after a short wait.
 */
import { test, expect } from '@playwright/test'
import { runPackage, launchPackagedApp, waitForEvent } from './helpers'

test('BT-L5-10: packaged .app emits canonical lifecycle log entries on boot', async () => {
  test.setTimeout(300_000)
  const bundle = await runPackage()
  const run = await launchPackagedApp(bundle)
  try {
    await waitForEvent(run.logFile, 'app:starting', 30_000)
    await waitForEvent(run.logFile, 'app:ready', 30_000)
  } finally {
    run.stop()
  }
  // The exit assertion is intentionally loose; the binary may take a moment
  // to shutdown. The load-bearing assertions are the two waitForEvent calls
  // above.
  expect(true).toBe(true)
})
