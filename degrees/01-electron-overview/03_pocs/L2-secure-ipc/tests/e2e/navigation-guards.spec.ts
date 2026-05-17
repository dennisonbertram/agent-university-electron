/**
 * BT-L2-3 and BT-L2-4 — navigation + window-open guards.
 *
 * BT-L2-3: window.open('https://evil.example') is denied; main logs
 *          security:window-open:blocked with the attempted URL.
 *
 * BT-L2-4: location.href = 'https://evil.example' is prevented by
 *          will-navigate; main logs security:navigation:blocked and the
 *          renderer's location stays on the original file:// URL.
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

test('BT-L2-3: window.open(external) is denied and main logs security:window-open:blocked', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
  expect(before).toBe(1)

  // Trigger the open attempt.
  await window.evaluate(() => {
    // The result of window.open is `null` when the open handler denies.
    ;(globalThis as { __openResult?: unknown }).__openResult = window.open('https://evil.example')
  })

  // setWindowOpenHandler ran and logged.
  const entry = await waitForEvent(logFile, 'security:window-open:blocked')
  const payload = entry.payload as { url?: unknown } | undefined
  expect(typeof payload?.url).toBe('string')
  expect(String(payload?.url)).toContain('evil.example')

  // No new window was created.
  const after = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
  expect(after).toBe(1)

  // window.open returns null when denied.
  const openResult = await window.evaluate(
    () => (globalThis as { __openResult?: unknown }).__openResult,
  )
  expect(openResult).toBeNull()
})

test('BT-L2-4: external navigation via location.href is blocked by will-navigate; renderer stays on file://', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const originalUrl = window.url()
  expect(originalUrl.startsWith('file://')).toBe(true)

  // Trigger a navigation attempt to an external origin. We do not await this
  // navigation because it should be cancelled by `will-navigate`.
  await window.evaluate(() => {
    try {
      // Use assign to keep the script alive even if the cancel happens
      // synchronously.
      window.location.href = 'https://evil.example/'
    } catch {
      /* ignore — navigation is prevented before any error surfaces */
    }
  })

  const entry = await waitForEvent(logFile, 'security:navigation:blocked')
  const payload = entry.payload as { url?: unknown } | undefined
  expect(typeof payload?.url).toBe('string')
  expect(String(payload?.url)).toContain('evil.example')

  // Give the renderer a beat to settle — but the URL must NOT change.
  await new Promise((r) => setTimeout(r, 300))
  const after = window.url()
  expect(after).toBe(originalUrl)
})
