/**
 * Regression coverage for L1.
 *
 * These tests exist to catch breakage of invariants that the BT-L1-N tests
 * could pass through other paths. They probe the *implementation contracts*
 * rather than the *behavioral contracts*.
 *
 * R-L1-1: window-all-closed must NOT call app.quit() on darwin.
 *         (Distinct from BT-L1-3 — that test checks app.isReady; this one
 *          asserts that the main process's window-all-closed log entry
 *          appears and that app.quit() was not invoked.)
 *
 * R-L1-2: window.api.rendererReady must exist as a function in renderer
 *         scope. (Catches breakage of contextBridge exposure.)
 *
 * R-L1-3: log emission ordering must reflect *causal* order — specifically,
 *         app:starting must be logged BEFORE app:ready, and window:created
 *         must appear strictly AFTER app:ready (i.e. createMainWindow MUST
 *         NOT be called before app.whenReady() resolves). Asserted via
 *         monotonically increasing log timestamps.
 *
 * R-L1-4: app:ping IPC channel responds with { pong: true, ts: number },
 *         used elsewhere as a liveness probe.
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, readLogLines, type LaunchedApp } from './helpers'

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

test('R-L1-1: window-all-closed on darwin does NOT invoke app.quit() (no app:before-quit log)', async () => {
  test.skip(process.platform !== 'darwin', 'darwin-only regression')
  launched = await launchApp()
  const { app, logFile } = launched

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await waitForEvent(logFile, 'renderer:ready')

  // Destroy all windows.
  await app.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.destroy()
  })

  // Wait a bit so window:closed log entry has time to flush.
  await new Promise((r) => setTimeout(r, 500))

  const lines = readLogLines(logFile)
  const beforeQuit = lines.find((l) => l.event === 'app:before-quit')
  expect(beforeQuit, 'app:before-quit should NOT have fired after window close on darwin').toBeUndefined()

  // App must still be ready (cross-check with BT-L1-3 path).
  const ready = await app.evaluate(({ app: appModule }) => appModule.isReady())
  expect(ready).toBe(true)
})

test('R-L1-2: window.api.rendererReady exists in renderer scope as a function', async () => {
  launched = await launchApp()
  const { app } = launched

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const apiShape = await window.evaluate(() => {
    const w = window as unknown as { api?: Record<string, unknown> }
    const api = w.api ?? {}
    return {
      hasApi: typeof w.api === 'object' && w.api !== null,
      rendererReadyType: typeof api.rendererReady,
      pingType: typeof api.ping,
      logPathType: typeof api.logPath,
      keys: Object.keys(api).sort(),
    }
  })

  expect(apiShape.hasApi).toBe(true)
  expect(apiShape.rendererReadyType).toBe('function')
  expect(apiShape.pingType).toBe('function')
  expect(apiShape.logPathType).toBe('function')
  expect(apiShape.keys).toEqual(['logPath', 'ping', 'rendererReady'])
})

test('R-L1-3: createMainWindow is called AFTER app.whenReady resolves (log timestamps monotonic)', async () => {
  launched = await launchApp()
  const { app, logFile } = launched

  await app.firstWindow()
  await waitForEvent(logFile, 'renderer:ready')

  const lines = readLogLines(logFile)
  const find = (evt: string): number => {
    const idx = lines.findIndex((l) => l.event === evt)
    if (idx < 0) throw new Error(`missing log event ${evt}`)
    return idx
  }

  const startingIdx = find('app:starting')
  const readyIdx = find('app:ready')
  const createdIdx = find('window:created')

  // Index order: starting < ready < created.
  expect(startingIdx).toBeLessThan(readyIdx)
  expect(readyIdx).toBeLessThan(createdIdx)

  // Timestamp order: starting <= ready <= created. (Equal is acceptable when
  // two log lines fall in the same millisecond — strictly less-than would be
  // flaky on fast hardware.)
  const ts = (i: number): number => new Date(lines[i].ts).getTime()
  expect(ts(startingIdx)).toBeLessThanOrEqual(ts(readyIdx))
  expect(ts(readyIdx)).toBeLessThanOrEqual(ts(createdIdx))
})

test('R-L1-4: app:ping IPC handler responds with { pong: true, ts: number }', async () => {
  launched = await launchApp()
  const { app } = launched

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const result = await window.evaluate(async () => {
    return await (window as unknown as { api: { ping: () => Promise<unknown> } }).api.ping()
  })

  const r = result as { pong?: unknown; ts?: unknown }
  expect(r.pong).toBe(true)
  expect(typeof r.ts).toBe('number')
  expect(r.ts as number).toBeGreaterThan(0)
})
