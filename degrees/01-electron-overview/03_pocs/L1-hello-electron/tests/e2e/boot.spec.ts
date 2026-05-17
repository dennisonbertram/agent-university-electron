/**
 * Behavioral tests for L1.
 *
 * BT-L1-1: app boots, exactly one BrowserWindow exists, renderer DOMContentLoaded fires.
 * BT-L1-2: renderer announces ready via IPC; main logs a `renderer:ready` entry with userAgent.
 * BT-L1-3: on darwin, closing the only window does NOT quit the app (main still responds).
 * BT-L1-4: structured log entries appear in order: app:starting → app:ready → window:created → renderer:ready.
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

test('BT-L1-1: app launches with exactly one BrowserWindow and renderer DOMContentLoaded fires', async () => {
  launched = await launchApp()
  const { app } = launched

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const windowCount = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().length,
  )
  expect(windowCount).toBe(1)

  const loaded = await window.evaluate(() => document.readyState !== 'loading')
  expect(loaded).toBe(true)
})

test('BT-L1-2: renderer announces ready via IPC and main logs renderer:ready with userAgent', async () => {
  launched = await launchApp()
  const { app, logFile } = launched

  await app.firstWindow()
  const entry = await waitForEvent(logFile, 'renderer:ready')

  expect(entry.module).toBe('ipc')
  expect(entry.level).toBe('info')
  const payload = entry.payload as { userAgent?: unknown } | undefined
  expect(payload).toBeDefined()
  expect(typeof payload?.userAgent).toBe('string')
  expect(String(payload?.userAgent).length).toBeGreaterThan(0)
})

test('BT-L1-3: on darwin, closing the only window does NOT quit the app', async () => {
  test.skip(process.platform !== 'darwin', 'darwin-only behavior')
  launched = await launchApp()
  const { app } = launched

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Close the single BrowserWindow.
  await app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows()
    for (const w of wins) w.destroy()
  })

  // Wait until all windows are gone.
  await expect
    .poll(
      () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      { timeout: 10_000 },
    )
    .toBe(0)

  // App should still be alive. Call into main; it must respond.
  const stillReady = await app.evaluate(({ app: appModule }) => appModule.isReady())
  expect(stillReady).toBe(true)

  // And the app should NOT be in the middle of quitting.
  const quitting = await app.evaluate(
    () => (globalThis as { __l1Quitting?: boolean }).__l1Quitting === true,
  )
  expect(quitting).toBe(false)
})

test('BT-L1-4: structured log emits app:starting → app:ready → window:created → renderer:ready in order', async () => {
  launched = await launchApp()
  const { app, logFile } = launched

  await app.firstWindow()
  await waitForEvent(logFile, 'renderer:ready')

  const lines = readLogLines(logFile)
  const sequence = ['app:starting', 'app:ready', 'window:created', 'renderer:ready']

  // Each event must be present.
  for (const evt of sequence) {
    expect(lines.find((l) => l.event === evt), `missing event ${evt}`).toBeTruthy()
  }

  // Each event's first occurrence must appear in the documented order.
  const indexOf = (evt: string): number => lines.findIndex((l) => l.event === evt)
  const indices = sequence.map(indexOf)
  for (let i = 1; i < indices.length; i++) {
    expect(
      indices[i],
      `event ${sequence[i]} (idx ${indices[i]}) must come after ${sequence[i - 1]} (idx ${indices[i - 1]})`,
    ).toBeGreaterThan(indices[i - 1])
  }

  // Every entry must satisfy the log contract (ts, level, process, module, event).
  for (const entry of lines) {
    expect(typeof entry.ts).toBe('string')
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(['debug', 'info', 'warn', 'error']).toContain(entry.level)
    expect(['main', 'renderer', 'preload', 'utility']).toContain(entry.process)
    expect(typeof entry.module).toBe('string')
    expect(typeof entry.event).toBe('string')
  }
})
