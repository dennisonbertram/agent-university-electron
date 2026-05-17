/**
 * BT-L4-10: dock:set-badge("3") → app.dock.getBadge() returns "3"; log fires.
 *           dock:set-badge("") clears it.
 * BT-L4-11: app:add-recent calls succeed and are logged. We cannot assert the
 *           OS actually surfaced the recent-document entry, so the test
 *           limitation is documented (the call returns ok + log fires).
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, type LaunchedApp } from './helpers'

let launched: LaunchedApp | null = null

test.afterEach(async () => {
  if (launched) {
    try {
      // Clear the dock badge before exit.
      const win = await launched.app.firstWindow().catch(() => null)
      if (win) {
        await win
          .evaluate(async () => {
            await (
              window as unknown as {
                api: { dockSetBadge: (v: unknown) => Promise<unknown> }
              }
            ).api.dockSetBadge({ badge: '' })
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

test('BT-L4-10: dock:set-badge("3") sets the dock badge; clearing with "" works', async () => {
  test.skip(process.platform !== 'darwin', 'dock badge is macOS-only')
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const setResult = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { dockSetBadge: (v: unknown) => Promise<{ ok: boolean; badge: string }> }
    }).api.dockSetBadge({ badge: '3' })
  })) as { ok: boolean; badge: string }
  expect(setResult.ok).toBe(true)
  expect(setResult.badge).toBe('3')

  // app.dock.getBadge() should report "3".
  const reported = await app.evaluate(async ({ app: appModule }) => {
    return process.platform === 'darwin' ? appModule.dock?.getBadge() : ''
  })
  expect(reported).toBe('3')
  await waitForEvent(logFile, 'dock:badge-set:3')

  // Clear.
  const clearResult = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { dockSetBadge: (v: unknown) => Promise<{ ok: boolean; badge: string }> }
    }).api.dockSetBadge({ badge: '' })
  })) as { ok: boolean; badge: string }
  expect(clearResult.ok).toBe(true)
  expect(clearResult.badge).toBe('')
  const afterClear = await app.evaluate(async ({ app: appModule }) => {
    return process.platform === 'darwin' ? appModule.dock?.getBadge() : ''
  })
  expect(afterClear).toBe('')
})

test('BT-L4-11: app:add-recent succeeds and is logged (OS-side recent-list NOT asserted)', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const result = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { appAddRecent: (v: unknown) => Promise<{ ok: boolean }> }
    }).api.appAddRecent({ filePath: '/tmp/sample.md' })
  })) as { ok: boolean }
  expect(result.ok).toBe(true)
  await waitForEvent(logFile, 'recent:added')
})
