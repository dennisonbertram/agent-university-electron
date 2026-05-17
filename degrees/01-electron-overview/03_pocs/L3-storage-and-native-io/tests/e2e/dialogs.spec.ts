/**
 * BT-L3-3: dialog:open cancel path.
 *   Strategy: launch with DIALOG_STUB=1 + DIALOG_STUB_MODE=cancel. The main
 *   process's dialog adapter returns { canceled: true, filePaths: [] } without
 *   ever surfacing the native dialog. This is the documented test seam — see
 *   `test-plan.md` for the rationale (driving the actual UI dialog from
 *   Playwright on macOS would require --no-sandbox and is out of scope).
 *
 * BT-L3-4: dialog:save pick path.
 *   Strategy: launch with DIALOG_STUB=1 + DIALOG_STUB_MODE=pick +
 *   DIALOG_STUB_PATH=/tmp/sample.txt. The main process's dialog adapter
 *   returns { canceled: false, filePath: '/tmp/sample.txt' }. The renderer
 *   never receives a raw filesystem handle — only the validated path string.
 */
import { test, expect } from '@playwright/test'
import { launchApp, type LaunchedApp } from './helpers'

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

test('BT-L3-3: dialog:open returns { canceled: true, filePaths: [] } when the user cancels', async () => {
  launched = await launchApp({
    extraEnv: { DIALOG_STUB: '1', DIALOG_STUB_MODE: 'cancel' },
  })
  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const result = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { dialogOpen: (v?: unknown) => Promise<{ canceled: boolean; filePaths: readonly string[] }> }
    }).api.dialogOpen({ filters: [{ name: 'Text', extensions: ['txt'] }] })
  })) as { canceled: boolean; filePaths: readonly string[] }

  expect(result.canceled).toBe(true)
  expect(Array.isArray(result.filePaths)).toBe(true)
  expect(result.filePaths.length).toBe(0)
})

test('BT-L3-4: dialog:save returns { canceled: false, filePath: stubbed } for a programmatic pick', async () => {
  launched = await launchApp({
    extraEnv: { DIALOG_STUB: '1', DIALOG_STUB_MODE: 'pick', DIALOG_STUB_PATH: '/tmp/sample.txt' },
  })
  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const result = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { dialogSave: (v?: unknown) => Promise<{ canceled: boolean; filePath: string | null }> }
    }).api.dialogSave({ defaultPath: 'sample.txt' })
  })) as { canceled: boolean; filePath: string | null }

  expect(result.canceled).toBe(false)
  expect(result.filePath).toBe('/tmp/sample.txt')
})
