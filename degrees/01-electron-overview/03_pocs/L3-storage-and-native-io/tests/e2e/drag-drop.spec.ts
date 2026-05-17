/**
 * BT-L3-5: drag-drop via webUtils.getPathForFile.
 *
 * Strategy: we don't dispatch native drag events. Instead we exercise the
 * contractual surface — the renderer calls `window.api.filesDropped(paths)`
 * with a fixture path array, and main logs `files:dropped`. R-L3-3 verifies
 * that `window.api.getPathForFile` is present on the contextBridge surface
 * (so the renderer-side wiring uses the modern `webUtils.getPathForFile`
 * rather than the removed `File.path`).
 *
 * The documented simulation pattern is in `test-plan.md`. A real drag-drop
 * test would require synthesizing OS-level events that Playwright's
 * `_electron` driver cannot synthesize without `--no-sandbox` on macOS.
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, type LaunchedApp } from './helpers'

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

test('BT-L3-5: simulating a drop via api.filesDropped logs files:dropped with the paths', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // First sanity-check: the modern surface is present.
  const hasGetPath = await win.evaluate(() => {
    return typeof (
      window as unknown as { api?: { getPathForFile?: unknown } }
    ).api?.getPathForFile === 'function'
  })
  expect(hasGetPath).toBe(true)

  const result = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { filesDropped: (v: unknown) => Promise<{ ok: boolean; count: number }> }
    }).api.filesDropped(['/tmp/dropped-fixture-a.txt', '/tmp/dropped-fixture-b.md'])
  })) as { ok: boolean; count: number }

  expect(result.ok).toBe(true)
  expect(result.count).toBe(2)

  const entry = await waitForEvent(logFile, 'files:dropped')
  expect(entry.module).toBe('ipc')
  const payload = entry.payload as { paths?: unknown; count?: unknown } | undefined
  expect(payload?.count).toBe(2)
  expect(payload?.paths).toEqual([
    '/tmp/dropped-fixture-a.txt',
    '/tmp/dropped-fixture-b.md',
  ])
})
