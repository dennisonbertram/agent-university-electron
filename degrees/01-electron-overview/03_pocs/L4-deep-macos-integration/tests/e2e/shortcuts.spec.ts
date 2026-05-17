/**
 * BT-L4-4: globalShortcut.register('CmdOrCtrl+Shift+P', handler) succeeds,
 *          isRegistered returns true, and firing the handler via the
 *          test seam emits `shortcut:fired` to the renderer plus a log.
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, fireShortcut, type LaunchedApp } from './helpers'

let launched: LaunchedApp | null = null

test.afterEach(async () => {
  if (launched) {
    try {
      await launched.app.close()
    } catch {
      // best-effort
    }
    launched = null
  }
})

test('BT-L4-4: CmdOrCtrl+Shift+P is registered at boot; the handler fires via the test seam', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // After boot the registration log should have fired.
  await waitForEvent(logFile, 'shortcut:registered')

  const isRegistered = await app.evaluate(async ({ globalShortcut }) => {
    return globalShortcut.isRegistered('CmdOrCtrl+Shift+P')
  })
  expect(isRegistered).toBe(true)

  // Subscribe to the push event before firing.
  const pushPromise = win.evaluate(() => {
    return new Promise<{ accelerator: string }>((resolve) => {
      const stop = (window as unknown as {
        api: {
          onShortcutFired: (cb: (payload: { accelerator: string }) => void) => () => void
        }
      }).api.onShortcutFired((payload) => {
        stop()
        resolve(payload)
      })
    })
  })

  // Fire the shortcut via the test seam.
  const fired = await fireShortcut(win, 'CmdOrCtrl+Shift+P')
  expect(fired.ok).toBe(true)
  expect(fired.fired).toBe(true)

  const payload = (await pushPromise) as { accelerator: string }
  expect(payload.accelerator).toBe('CmdOrCtrl+Shift+P')

  // Structured log fires.
  await waitForEvent(logFile, 'shortcut:CmdOrCtrl+Shift+P:fired')
})
