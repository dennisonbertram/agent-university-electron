/**
 * BT-L4-9: app:set-theme flips nativeTheme.themeSource; the renderer is
 *          notified via theme:changed and a structured log fires.
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, type LaunchedApp } from './helpers'

let launched: LaunchedApp | null = null

test.afterEach(async () => {
  if (launched) {
    try {
      // Reset to system so we don't leave the test theme stuck.
      const win = await launched.app.firstWindow().catch(() => null)
      if (win) {
        await win
          .evaluate(async () => {
            await (
              window as unknown as {
                api: { appSetTheme: (v: unknown) => Promise<unknown> }
              }
            ).api.appSetTheme({ source: 'system' })
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

test('BT-L4-9: app:set-theme({ source: "dark" }) → shouldUseDarkColors true; theme:changed pushed', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // Subscribe to the renderer push BEFORE setting the theme.
  const pushPromise = win.evaluate(() => {
    return new Promise<{ source: string; isDark: boolean }>((resolve) => {
      const stop = (window as unknown as {
        api: {
          onThemeChanged: (cb: (p: { source: string; isDark: boolean }) => void) => () => void
        }
      }).api.onThemeChanged((payload) => {
        stop()
        resolve(payload)
      })
    })
  })

  const setResult = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { appSetTheme: (v: unknown) => Promise<{ source: string; isDark: boolean }> }
    }).api.appSetTheme({ source: 'dark' })
  })) as { source: string; isDark: boolean }

  expect(setResult.source).toBe('dark')
  expect(setResult.isDark).toBe(true)

  await waitForEvent(logFile, 'theme:source-set:dark')

  const pushed = (await pushPromise) as { source: string; isDark: boolean }
  expect(pushed.source).toBe('dark')
  expect(pushed.isDark).toBe(true)

  // Flip back to light.
  const backResult = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { appSetTheme: (v: unknown) => Promise<{ source: string; isDark: boolean }> }
    }).api.appSetTheme({ source: 'light' })
  })) as { source: string; isDark: boolean }
  expect(backResult.source).toBe('light')
  expect(backResult.isDark).toBe(false)
})
