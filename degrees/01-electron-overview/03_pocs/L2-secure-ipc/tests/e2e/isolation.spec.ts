/**
 * BT-L2-2: contextIsolation = true and nodeIntegration = false in the renderer.
 *
 * Strategy: evaluate `typeof require` inside the renderer page. Under the
 * mandatory secure defaults this must be `'undefined'` — the renderer has no
 * Node API surface, only the `window.api` exposed by preload.
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

test('BT-L2-2: typeof require in the renderer is undefined (nodeIntegration:false + contextIsolation:true)', async () => {
  launched = await launchApp()
  const { app } = launched
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const requireType = await window.evaluate(() => typeof (window as unknown as { require?: unknown }).require)
  expect(requireType).toBe('undefined')

  // process is also not exposed in the renderer.
  const processType = await window.evaluate(() => typeof (window as unknown as { process?: unknown }).process)
  expect(processType).toBe('undefined')

  // window.api is present (proves contextBridge worked) but exposes ONLY the
  // documented functions, not the whole ipcRenderer module.
  const apiShape = await window.evaluate(() => {
    const api = (window as unknown as { api?: Record<string, unknown> }).api ?? {}
    return {
      hasApi: typeof (window as unknown as { api?: unknown }).api === 'object',
      keys: Object.keys(api).sort(),
      hasIpcRenderer:
        'ipcRenderer' in (api as Record<string, unknown>) ||
        typeof (api as { ipcRenderer?: unknown }).ipcRenderer !== 'undefined',
    }
  })
  expect(apiShape.hasApi).toBe(true)
  expect(apiShape.hasIpcRenderer).toBe(false)
  expect(apiShape.keys).toContain('ping')
  expect(apiShape.keys).toContain('echo')
  expect(apiShape.keys).toContain('journalAppend')
  expect(apiShape.keys).toContain('onTick')
})
