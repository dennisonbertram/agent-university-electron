/**
 * BT-L4-6: second-instance with a deep-link arg focuses the window,
 *          logs `lifecycle:second-instance`, and dispatches the parsed link.
 * BT-L4-7: open-url emits parsed link + logs `lifecycle:open-url`.
 * BT-L4-12: will-quit unregisters globalShortcut + logs `lifecycle:will-quit:cleanup`.
 */
import { test, expect } from '@playwright/test'
import {
  launchApp,
  waitForEvent,
  simulateDeepLink,
  simulateSecondInstance,
  simulateWillQuit,
  type LaunchedApp,
} from './helpers'

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

test('BT-L4-6: second-instance with `electron-l4://action?x=1` is parsed, dispatched, and logged', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // Subscribe to the renderer-side push BEFORE firing.
  const pushPromise = win.evaluate(() => {
    return new Promise<{ url: string; origin: string }>((resolve) => {
      const stop = (window as unknown as {
        api: {
          onOpenUrl: (cb: (payload: { url: string; origin: string }) => void) => () => void
        }
      }).api.onOpenUrl((payload) => {
        stop()
        resolve(payload)
      })
    })
  })

  await simulateSecondInstance(win, [
    process.execPath,
    'electron-l4://action?x=1',
  ])

  await waitForEvent(logFile, 'lifecycle:second-instance')

  const payload = (await pushPromise) as { url: string; origin: string; params?: Record<string, string> }
  expect(payload.origin).toBe('second-instance')
  expect(payload.url.startsWith('electron-l4://')).toBe(true)
})

test('BT-L4-7: app.emit("open-url", ..., url) parses + logs + dispatches', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const pushPromise = win.evaluate(() => {
    return new Promise<{ url: string; origin: string }>((resolve) => {
      const stop = (window as unknown as {
        api: {
          onOpenUrl: (cb: (payload: { url: string; origin: string }) => void) => () => void
        }
      }).api.onOpenUrl((payload) => {
        stop()
        resolve(payload)
      })
    })
  })

  await simulateDeepLink(win, 'electron-l4://action?y=2')
  await waitForEvent(logFile, 'lifecycle:open-url')

  const payload = (await pushPromise) as { url: string; origin: string }
  expect(payload.origin).toBe('open-url')
  expect(payload.url.startsWith('electron-l4://')).toBe(true)
})

test('BT-L4-12: will-quit unregisters globalShortcut and logs lifecycle:will-quit:cleanup', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // Sanity: registered.
  const beforeRegistered = await app.evaluate(async ({ globalShortcut }) =>
    globalShortcut.isRegistered('CmdOrCtrl+Shift+P'),
  )
  expect(beforeRegistered).toBe(true)

  await simulateWillQuit(win)

  // Cleanup log fires.
  await waitForEvent(logFile, 'lifecycle:will-quit:cleanup')

  // Shortcut is unregistered.
  const afterRegistered = await app.evaluate(async ({ globalShortcut }) =>
    globalShortcut.isRegistered('CmdOrCtrl+Shift+P'),
  )
  expect(afterRegistered).toBe(false)
})
