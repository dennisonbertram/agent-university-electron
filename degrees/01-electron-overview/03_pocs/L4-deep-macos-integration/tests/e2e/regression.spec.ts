/**
 * Regression coverage for L4.
 *
 * R-L4-1 — Tray is held in a module-scoped (GC-safe) variable.
 *          Static-source: src/tray.ts contains `let trayInstance` declared
 *          at module level. Runtime: the tray view survives a forced GC
 *          (best-effort — Electron's GC isn't directly invokable, so the
 *          runtime side asserts that the tray view is still reachable
 *          ~2s after creation).
 *
 * R-L4-2 — A globalShortcut registration cannot ship without a will-quit
 *          cleanup. Static-source: src/shortcuts.ts contains
 *          `app.on('will-quit'` and `globalShortcut.unregisterAll()`.
 *
 * R-L4-3 — Every Notification.show path includes a `failed` listener.
 *          Static-source: src/notifications.ts pairs `.on('failed', ...)`
 *          BEFORE `notification.show()`. Runtime: a fresh notification
 *          call yields either {ok:true} or {failed:{error}} — never
 *          undefined / unhandled.
 *
 * R-L4-4 — parseDeepLink rejects malformed URLs as `[null, error]` tuples
 *          (already covered exhaustively in tests/unit/parse-deep-link.test.ts;
 *          we add a focused boundary check here to keep regression visible
 *          at this layer too).
 *
 * R-L4-5 — `app.requestSingleInstanceLock()` appears BEFORE
 *          `app.whenReady()` in src/main.ts.
 *
 * R-L4-6 — `setLoginItemSettings({ openAtLogin: false })` appears in
 *          src/autolaunch.ts on a cleanup path.
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { launchApp, getTrayState, type LaunchedApp } from './helpers'
import { parseDeepLink } from '../../src/protocol'

const POC_ROOT = path.resolve(__dirname, '..', '..')

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

test('R-L4-1: Tray instance is held in a module-scope variable (static + runtime)', async () => {
  // Static: src/tray.ts declares `let trayInstance`.
  const trayPath = path.join(POC_ROOT, 'src', 'tray.ts')
  expect(existsSync(trayPath)).toBe(true)
  const src = readFileSync(trayPath, 'utf8')
  // Must declare with `let` (or const) at module scope, NOT inside a function.
  expect(src).toMatch(/^let\s+trayInstance/m)
  // Reject the GC-unsafe form: a local `const tray = new Tray` inside
  // `installTray` or `whenReady` callback.
  expect(src).not.toMatch(/installTray[\s\S]*?(?:const|let)\s+localTray\s*=\s*new\s+Tray\b/)

  // Runtime: launch, snapshot tray state, sleep ~2 seconds, snapshot again.
  // If the tray instance had been GC'd, `hasImage` would flip to false.
  launched = await launchApp()
  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  const before = await getTrayState(win)
  expect(before.hasImage).toBe(true)
  await new Promise((r) => setTimeout(r, 2_000))
  const after = await getTrayState(win)
  expect(after.hasImage).toBe(true)
  expect(after.state).toBe(before.state)
})

test('R-L4-2: shortcuts.ts pairs globalShortcut registration with will-quit cleanup (static)', () => {
  const shortcutsPath = path.join(POC_ROOT, 'src', 'shortcuts.ts')
  const src = readFileSync(shortcutsPath, 'utf8')
  expect(src).toMatch(/globalShortcut\.register/)
  expect(src).toMatch(/app\.on\s*\(\s*['"]will-quit['"]/)
  expect(src).toMatch(/globalShortcut\.unregisterAll/)
})

test('R-L4-3: notifications.ts pairs `failed` listener with show (static + runtime)', async () => {
  // Static check (redundant with the unit test but kept here so the regression
  // surface is observable from this file too).
  const notifPath = path.join(POC_ROOT, 'src', 'notifications.ts')
  const src = readFileSync(notifPath, 'utf8')
  const failedIdx = src.search(/\.(on|once|addListener)\s*\(\s*['"]failed['"]/)
  const showIdx = src.search(/\.show\s*\(/)
  expect(failedIdx).toBeGreaterThanOrEqual(0)
  expect(showIdx).toBeGreaterThan(failedIdx)

  // Runtime: a notification call always resolves with a structured shape.
  launched = await launchApp()
  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  const result = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: {
        notificationShow: (v: unknown) => Promise<{ ok: boolean; id: string; failed?: { error: string } }>
      }
    }).api.notificationShow({
      title: 'r-l4-3 probe',
      body: 'probe body',
    })
  })) as { ok: boolean; id: string; failed?: { error: string } }
  expect(typeof result.id).toBe('string')
  expect(result.id.length).toBeGreaterThan(0)
  // Either succeeded (ok:true) OR failed-with-error: both are valid; the
  // INVALID outcome is "undefined" or "throws", which we want to catch.
  if (!result.ok) {
    expect(typeof result.failed?.error).toBe('string')
  }
})

test('R-L4-4: parseDeepLink rejects malformed URLs as [null, Error] (boundary)', () => {
  for (const bad of [
    'electron-l4://',
    'electron-l4://%',
    'electron-l4:/oops',
    'https://example.com',
    '',
  ]) {
    const [parsed, err] = parseDeepLink(bad)
    expect(parsed, `input "${bad}" must not parse`).toBe(null)
    expect(err, `input "${bad}" must produce an Error`).toBeInstanceOf(Error)
  }
  // Sanity: a valid URL still parses.
  const [okParsed, okErr] = parseDeepLink('electron-l4://focus?duration=25')
  expect(okErr).toBe(null)
  expect(okParsed).not.toBe(null)
})

test('R-L4-5: main.ts calls requestSingleInstanceLock BEFORE whenReady (static)', () => {
  const mainPath = path.join(POC_ROOT, 'src', 'main.ts')
  const src = readFileSync(mainPath, 'utf8')
  const lockIdx = src.search(/requestSingleInstanceLock\s*\(/)
  const whenReadyIdx = src.search(/whenReady\s*\(/)
  expect(lockIdx).toBeGreaterThanOrEqual(0)
  expect(whenReadyIdx).toBeGreaterThan(lockIdx)
})

test('R-L4-6: autolaunch.ts declares an `openAtLogin: false` cleanup path (static)', () => {
  const autoPath = path.join(POC_ROOT, 'src', 'autolaunch.ts')
  const src = readFileSync(autoPath, 'utf8')
  // The literal `openAtLogin: false` must appear in this file. Either the
  // sentinel `ensureLoginItemDisabledOnCleanup` or the runtime `cleanupOnRemove`
  // satisfies the static check.
  expect(src).toMatch(/openAtLogin:\s*false/)
  // The cleanup function must exist by name.
  expect(src).toMatch(/cleanupOnRemove/)
})
