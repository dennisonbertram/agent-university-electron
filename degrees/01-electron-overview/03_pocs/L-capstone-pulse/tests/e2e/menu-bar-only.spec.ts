/**
 * BT-C-10: app.dock.hide() called BEFORE first window creation; isVisible()=false.
 *          Info.plist.template carries LSUIElement=true (asserted statically here too).
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import plist from 'plist'
import { launchApp, waitForEvent, callApi, POC_ROOT } from './helpers'

test.describe.serial('Pulse menu-bar-only', () => {
  test('BT-C-10: dock.hide() pre-window + LSUIElement=true in Info.plist.template', async () => {
    const { app, logFile } = await launchApp()
    try {
      const win = await app.firstWindow()
      await waitForEvent(logFile, 'app:install-complete', 15_000)

      // Boot summary records whether the dock-hide call landed.
      const summary = await callApi<{ dockHidden: boolean }>(win, 'testGetBootSummary')
      // On darwin the dock should be hidden; on other platforms `dock.hide()`
      // is a no-op and `dockHidden` is false (documented in poc-report).
      if (process.platform === 'darwin') {
        expect(summary.dockHidden).toBe(true)
      }

      // Info.plist.template has LSUIElement=true.
      const templatePath = path.join(POC_ROOT, 'Info.plist.template')
      expect(existsSync(templatePath)).toBe(true)
      const obj = plist.parse(readFileSync(templatePath, 'utf8')) as Record<string, unknown>
      // LSUIElement decision: capstone keeps it true. If a future commit
      // toggles it off, the assertion below should be updated and the
      // poc-report must document the deviation.
      expect(obj.LSUIElement).toBe(true)
    } finally {
      await app.close()
    }
  })
})
