/**
 * BT-L4-8: app:set-autolaunch flips openAtLogin; a structured log of each
 *          change is written.
 *
 * NOTE (macOS 13+ caveat): for unsigned dev apps, `setLoginItemSettings`
 * may not stick. We assert the *invocation* + *log* always — and assert
 * the OS-observed state only when the platform reports it as expected.
 * See expectation-gap ledger Entry 5 (added during GREEN if observed).
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, type LaunchedApp } from './helpers'

let launched: LaunchedApp | null = null

test.afterEach(async () => {
  if (launched) {
    try {
      // Reset autolaunch to false before exit so the developer's machine
      // isn't left with a login-item registration that would re-launch us.
      const win = await launched.app.firstWindow().catch(() => null)
      if (win) {
        await win
          .evaluate(async () => {
            await (
              window as unknown as {
                api: { appSetAutoLaunch: (v: unknown) => Promise<unknown> }
              }
            ).api.appSetAutoLaunch({ enabled: false })
          })
          .catch(() => undefined)
      }
      await launched.app.close()
    } catch {
      // best-effort
    }
    launched = null
  }
})

test('BT-L4-8: app:set-autolaunch flips openAtLogin (best-effort) and logs each transition', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const enableResult = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { appSetAutoLaunch: (v: unknown) => Promise<{ requested: boolean; observed: boolean }> }
    }).api.appSetAutoLaunch({ enabled: true })
  })) as { requested: boolean; observed: boolean }
  expect(enableResult.requested).toBe(true)

  await waitForEvent(logFile, 'autolaunch:set:requested')

  const disableResult = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { appSetAutoLaunch: (v: unknown) => Promise<{ requested: boolean; observed: boolean }> }
    }).api.appSetAutoLaunch({ enabled: false })
  })) as { requested: boolean; observed: boolean }
  expect(disableResult.requested).toBe(false)
  // After disabling, the OS should report it as off.
  expect(disableResult.observed).toBe(false)
})
