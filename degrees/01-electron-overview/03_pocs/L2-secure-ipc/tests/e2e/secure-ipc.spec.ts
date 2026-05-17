/**
 * Behavioral tests for L2 — secure IPC surface.
 *
 * BT-L2-1: window.api.ping() returns { pong, ts, monotonic } and logs ipc:ping:served.
 * BT-L2-5: window.api.journalAppend({ text: 123 }) rejects with IpcValidationError
 *          and logs ipc:journal:append:validation-failed; no main-process crash.
 * BT-L2-7: window.api.echo(value) returns the input verbatim (string + object cases),
 *          logs ipc:echo:served with payload size.
 * BT-L2-8: window.api.onTick(handler) fires >=4 times within 1s with monotonic n.
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, findEvents, type LaunchedApp } from './helpers'

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

test('BT-L2-1: window.api.ping() returns { pong, ts, monotonic } and logs ipc:ping:served', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const result = (await window.evaluate(async () => {
    return await (
      window as unknown as { api: { ping: () => Promise<unknown> } }
    ).api.ping()
  })) as { pong?: unknown; ts?: unknown; monotonic?: unknown }

  expect(result.pong).toBe(true)
  expect(typeof result.ts).toBe('number')
  expect(result.ts as number).toBeGreaterThan(0)
  expect(typeof result.monotonic).toBe('number')
  expect(result.monotonic as number).toBeGreaterThanOrEqual(0)

  const entry = await waitForEvent(logFile, 'ipc:ping:served')
  expect(entry.process).toBe('main')
  expect(entry.module).toBe('ipc')
})

test('BT-L2-5: journalAppend with malformed payload rejects with IpcValidationError and logs validation-failed', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Renderer sees a rejected Promise with name === 'IpcValidationError'.
  const errInfo = (await window.evaluate(async () => {
    try {
      // Deliberately wrong shape: text is a number.
      await (
        window as unknown as {
          api: { journalAppend: (v: unknown) => Promise<unknown> }
        }
      ).api.journalAppend({ text: 123 })
      return { rejected: false }
    } catch (err) {
      const e = err as { name?: unknown; message?: unknown }
      return {
        rejected: true,
        name: typeof e.name === 'string' ? e.name : null,
        message: typeof e.message === 'string' ? e.message : null,
      }
    }
  })) as { rejected: boolean; name?: string | null; message?: string | null }

  expect(errInfo.rejected).toBe(true)
  expect(errInfo.name).toBe('IpcValidationError')
  expect(typeof errInfo.message).toBe('string')

  // Validation-failed entry was logged.
  const entry = await waitForEvent(logFile, 'ipc:journal:append:validation-failed')
  expect(entry.module).toBe('ipc')
  expect(entry.level).toBe('warn')

  // App is still alive (no uncaught main-process exception).
  const stillReady = await app.evaluate(({ app: appModule }) => appModule.isReady())
  expect(stillReady).toBe(true)
})

test('BT-L2-5b: journalAppend with valid payload resolves and logs ipc:journal:append:served', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const ok = await window.evaluate(async () => {
    const result = await (
      window as unknown as {
        api: { journalAppend: (v: unknown) => Promise<unknown> }
      }
    ).api.journalAppend({ text: 'hello journal' })
    return result as { ok: boolean }
  })
  expect(ok.ok).toBe(true)
  await waitForEvent(logFile, 'ipc:journal:append:served')
})

test('BT-L2-7: window.api.echo round-trips both string and object, logs ipc:echo:served', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const result = (await window.evaluate(async () => {
    const api = (window as unknown as { api: { echo: (v: unknown) => Promise<unknown> } }).api
    const a = await api.echo('hello')
    const b = await api.echo({ x: 1, nested: { y: 'z', arr: [1, 2, 3] } })
    return { a, b }
  })) as { a: unknown; b: unknown }

  expect(result.a).toBe('hello')
  expect(result.b).toEqual({ x: 1, nested: { y: 'z', arr: [1, 2, 3] } })

  // At least two echo log entries (one per call), each with a numeric payloadSize.
  // Allow the test a moment to flush; waitForEvent guarantees first hit.
  await waitForEvent(logFile, 'ipc:echo:served')
  // Poll until at least 2 entries are present (one for each echo call).
  const deadline = Date.now() + 5_000
  let entries = findEvents(logFile, 'ipc:echo:served')
  while (entries.length < 2 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50))
    entries = findEvents(logFile, 'ipc:echo:served')
  }
  expect(entries.length).toBeGreaterThanOrEqual(2)
  for (const e of entries) {
    const payload = e.payload as { payloadSize?: unknown } | undefined
    expect(payload).toBeDefined()
    expect(typeof payload?.payloadSize).toBe('number')
  }
})

test('BT-L2-8: onTick subscription fires >=4 times within 1s with monotonically increasing n', async () => {
  launched = await launchApp()
  const { app } = launched
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const result = (await window.evaluate(async () => {
    const api = (
      window as unknown as {
        api: { onTick: (cb: (n: number) => void) => () => void }
      }
    ).api

    const received: number[] = []
    const cleanup = api.onTick((n) => received.push(n))
    await new Promise<void>((r) => setTimeout(r, 1100))
    cleanup()
    return received
  })) as number[]

  expect(result.length).toBeGreaterThanOrEqual(4)
  for (let i = 1; i < result.length; i++) {
    expect(result[i], `tick ${i} (n=${result[i]}) should be > prev (n=${result[i - 1]})`).toBeGreaterThan(
      result[i - 1],
    )
  }
})
