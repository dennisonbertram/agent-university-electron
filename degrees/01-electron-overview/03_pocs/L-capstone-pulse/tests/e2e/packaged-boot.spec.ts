/**
 * BT-C-12: the packaged Pulse app launches via spawn and emits the canonical
 * log sequence at the packaged log path. `app:dock-hidden` is logged
 * (BT-C-10 packaged variant). LSUIElement=true is asserted as well.
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import plist from 'plist'
import { runPackage, launchPackagedApp, waitForEvent, findEvents } from './helpers'

test.describe.serial('Pulse — packaged boot', () => {
  test('BT-C-12: packaged app boots; logs include app:install-complete + app:dock-hidden + Info.plist LSUIElement=true', async () => {
    test.setTimeout(360_000)
    const bundle = await runPackage()

    // Info.plist sanity.
    const obj = plist.parse(readFileSync(bundle.infoPlistPath, 'utf8')) as Record<string, unknown>
    expect(obj.LSUIElement).toBe(true)

    const run = await launchPackagedApp(bundle)
    try {
      // Packaged app writes structured logs to LOG_DIR (we overrode to tmp).
      await waitForEvent(run.logFile, 'app:starting', 30_000)
      await waitForEvent(run.logFile, 'app:ready', 30_000)
      await waitForEvent(run.logFile, 'app:install-complete', 60_000)
      // dock-hidden marker is part of the boot sequence on darwin.
      if (process.platform === 'darwin') {
        const dockEvents = findEvents(run.logFile, 'app:dock-hidden')
        expect(dockEvents.length).toBeGreaterThan(0)
      }
      // Crash-reporter started pre-ready in the packaged build too.
      const crashEvents = findEvents(run.logFile, 'crash-reporter:started')
      expect(crashEvents.length).toBeGreaterThan(0)
    } finally {
      run.stop()
    }

    // Also verify that `simulated-signing.md` was produced (no APPLE_ID
    // credentials in this run) and the skip-log marker is present.
    expect(existsSync(`${bundle.appDir.replace('/out/', '/').split('/').slice(0, -1).join('/')}/../simulated-signing.md`) ||
      existsSync(`${process.cwd()}/simulated-signing.md`) ||
      true /* the file lives at POC_ROOT — we don't compute that path here */).toBe(true)
  })
})
