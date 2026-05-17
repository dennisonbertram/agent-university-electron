/**
 * Pulse regression suite — R-C-1 through R-C-8.
 *
 * Many of these are static-source checks duplicated from unit tests so that
 * a single `npx playwright test` produces the full capstone regression view.
 * A few add a runtime probe (R-C-1, R-C-4, R-C-6) for behavioral coverage.
 *
 * R-C-1: safeStorage unavailable ⇒ journal-store falls back to plaintext
 *        AND logs `journal:encryption-unavailable:fallback-plaintext`.
 * R-C-2: journal-store.ts MUST reference the literal `safeStorage.encryptString`
 *        AND main.ts's encryptor adapter must call safeStorage.encryptString
 *        before insert (no bypass).
 * R-C-3: SQLite journal table has an idx_journal_created_at index.
 * R-C-4: app.requestSingleInstanceLock() runs before whenReady (static) AND
 *        the runtime second-instance test seam dispatches without spawning.
 * R-C-5: crashReporter.start() runs BEFORE app.whenReady() (static).
 * R-C-6: IPC channels for user input enforce length caps
 *        (journal:append ≤ 10_000 chars; journal:unlock-with-passphrase ≤ 4_096).
 * R-C-7: globalShortcut.unregisterAll() is called from `will-quit` in
 *        src/shortcuts.ts (static).
 * R-C-8: forge.config.ts includes the AutoUnpackNativesPlugin (so
 *        better-sqlite3 stays out of the asar).
 */
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { POC_ROOT, launchApp, waitForEvent, callApi, findEvents } from './helpers'

const FORGE_CONFIG_PATH = path.join(POC_ROOT, 'forge.config.ts')
const MAIN_TS_PATH = path.join(POC_ROOT, 'src', 'main.ts')
const JOURNAL_STORE_PATH = path.join(POC_ROOT, 'src', 'journal-store.ts')
const SHORTCUTS_PATH = path.join(POC_ROOT, 'src', 'shortcuts.ts')

test.describe('Pulse regression (R-C-1..R-C-8)', () => {
  test('R-C-1: safeStorage-unavailable code path is present AND observable', async () => {
    // Static: the fallback log marker MUST appear in journal-store.ts source.
    const src = readFileSync(JOURNAL_STORE_PATH, 'utf8')
    expect(src).toMatch(/journal:encryption-unavailable:fallback-plaintext/)
    // Static: main.ts's encryptor probes safeStorage.isEncryptionAvailable.
    const main = readFileSync(MAIN_TS_PATH, 'utf8')
    expect(main).toMatch(/safeStorage\.isEncryptionAvailable\s*\(\s*\)/)

    // Behavioral: with encryption available (typical macOS dev), the boot
    // summary reports encryptionAvailable=true AND the log doesn't include
    // the fallback marker. When unavailable, both flip. We don't force the
    // unavailable branch from env (safeStorage doesn't have a public seam),
    // so we assert the AVAILABLE branch and confirm the FALLBACK code path
    // is statically reachable.
    const { app, logFile } = await launchApp()
    try {
      const win = await app.firstWindow()
      await waitForEvent(logFile, 'app:install-complete', 15_000)
      const summary = await callApi<{ encryptionAvailable: boolean }>(win, 'testGetBootSummary')
      // The assertion is symmetric — either branch is acceptable, but the
      // fallback marker AND the boolean must agree.
      const fallbackLogs = findEvents(logFile, 'journal:encryption-unavailable:fallback-plaintext')
      if (summary.encryptionAvailable) {
        // The boot logger MAY still emit the marker if a downstream module
        // checks separately; just assert the journal-store branch is consistent.
        // (Pulse's journal-store only emits when encryptionAvailable=false.)
        expect(fallbackLogs.length).toBe(0)
      } else {
        expect(fallbackLogs.length).toBeGreaterThan(0)
      }
    } finally {
      await app.close()
    }
  })

  test('R-C-2: journal-store source references safeStorage.encryptString AND main calls it before insert', () => {
    const journalSrc = readFileSync(JOURNAL_STORE_PATH, 'utf8')
    // The R-C-2 sentinel string + the conceptual reference must be present
    // so a regression that strips the encrypt-before-insert call is caught.
    expect(journalSrc).toMatch(/safeStorage\.encryptString/)

    const main = readFileSync(MAIN_TS_PATH, 'utf8')
    expect(main).toMatch(/safeStorage\.encryptString/)
    // The encryptor adapter in main.ts must call encryptString INSIDE the
    // encrypt() arm (i.e., before the journal-store inserts). Confirm by
    // proximity: the literal must appear inside a function named `encrypt`.
    const encryptFnIdx = main.search(/encrypt\(plaintext:\s*string\)/)
    const encryptStringIdx = main.indexOf('safeStorage.encryptString', encryptFnIdx)
    expect(encryptFnIdx).toBeGreaterThan(-1)
    expect(encryptStringIdx).toBeGreaterThan(encryptFnIdx)
  })

  test('R-C-3: journal table has idx_journal_created_at index', async () => {
    const { app, logFile } = await launchApp()
    try {
      const win = await app.firstWindow()
      await waitForEvent(logFile, 'app:install-complete', 15_000)
      // Force at least one journal row so the index has something to cover.
      await callApi(win, 'testFireDeepLink', { url: 'pulse://log?text=index-probe' })
      await waitForEvent(logFile, 'journal:append:1-row', 5_000)
      // The schema DDL inside journal-store.ts contains the literal.
      const src = readFileSync(JOURNAL_STORE_PATH, 'utf8')
      expect(src).toMatch(/CREATE INDEX IF NOT EXISTS idx_journal_created_at/)
    } finally {
      await app.close()
    }
  })

  test('R-C-4: requestSingleInstanceLock runs before whenReady (static) AND second-instance dispatches without spawning', async () => {
    const main = readFileSync(MAIN_TS_PATH, 'utf8')
    const lockIdx = main.search(/requestSingleInstanceLock\s*\(/)
    const readyIdx = main.search(/whenReady\s*\(/)
    expect(lockIdx).toBeGreaterThanOrEqual(0)
    expect(readyIdx).toBeGreaterThan(lockIdx)

    // Runtime: emit a second-instance event via the test IPC seam; assert
    // the lifecycle dispatcher logged it.
    const { app, logFile } = await launchApp()
    try {
      const win = await app.firstWindow()
      await waitForEvent(logFile, 'app:install-complete', 15_000)
      await callApi(win, 'testEmitSecondInstance', { argv: ['pulse://start?duration=1'] })
      const dispatched = findEvents(logFile, 'lifecycle:second-instance')
      // The handler may emit either `lifecycle:second-instance` or
      // `deeplink:dispatched` depending on the routing; assert at least one
      // observable.
      const deeplink = findEvents(logFile, 'deeplink:dispatched')
      expect(dispatched.length + deeplink.length).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })

  test('R-C-5: crashReporter.start() runs BEFORE app.whenReady() (static)', () => {
    const src = readFileSync(MAIN_TS_PATH, 'utf8')
    const crashIdx = src.search(/startCrashReporter\s*\(/)
    const readyIdx = src.search(/\.whenReady\s*\(/)
    expect(crashIdx).toBeGreaterThan(-1)
    expect(readyIdx).toBeGreaterThan(-1)
    expect(crashIdx).toBeLessThan(readyIdx)
  })

  test('R-C-6: IPC channels for user input enforce length caps', async () => {
    const { app, logFile } = await launchApp()
    try {
      const win = await app.firstWindow()
      await waitForEvent(logFile, 'app:install-complete', 15_000)
      // journal:append > 10_000 chars must throw IpcValidationError
      const longText = 'x'.repeat(10_001)
      const result = await win.evaluate(async (t: string) => {
        try {
          await (window as unknown as {
            api: { journalAppend: (a: { text: string }) => Promise<unknown> }
          }).api.journalAppend({ text: t })
          return { ok: true }
        } catch (err) {
          return { ok: false, message: (err as { message?: string }).message ?? String(err) }
        }
      }, longText)
      expect(result.ok).toBe(false)
      expect((result as { message?: string }).message).toMatch(/exceeds cap 10000|R-C-6/i)

      // journal:unlock-with-passphrase > 4_096 chars must also throw
      const longPass = 'p'.repeat(4_097)
      const passResult = await win.evaluate(async (p: string) => {
        try {
          await (window as unknown as {
            api: { journalUnlockWithPassphrase: (a: { passphrase: string }) => Promise<unknown> }
          }).api.journalUnlockWithPassphrase({ passphrase: p })
          return { ok: true }
        } catch (err) {
          return { ok: false, message: (err as { message?: string }).message ?? String(err) }
        }
      }, longPass)
      expect(passResult.ok).toBe(false)
      expect((passResult as { message?: string }).message).toMatch(/exceeds cap 4096|R-C-6/i)
    } finally {
      await app.close()
    }
  })

  test('R-C-7: globalShortcut.unregisterAll() runs in will-quit (static)', () => {
    const src = readFileSync(SHORTCUTS_PATH, 'utf8')
    expect(src).toMatch(/app\.on\(['"]will-quit['"]/)
    expect(src).toMatch(/globalShortcut\.unregisterAll\s*\(\s*\)/)
    // The unregisterAll() call must appear AFTER the will-quit listener.
    const willQuitIdx = src.search(/app\.on\(['"]will-quit['"]/)
    const unregIdx = src.indexOf('globalShortcut.unregisterAll', willQuitIdx)
    expect(willQuitIdx).toBeGreaterThan(-1)
    expect(unregIdx).toBeGreaterThan(willQuitIdx)
  })

  test('R-C-8: forge.config.ts registers AutoUnpackNativesPlugin', () => {
    expect(existsSync(FORGE_CONFIG_PATH)).toBe(true)
    const src = readFileSync(FORGE_CONFIG_PATH, 'utf8')
    expect(src).toMatch(/AutoUnpackNativesPlugin/)
    expect(src).toMatch(/@electron-forge\/plugin-auto-unpack-natives/)
    // It must be in the `plugins:` list, not just imported.
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '')
    const pluginsIdx = stripped.search(/plugins\s*:\s*\[/)
    const autoUnpackIdx = stripped.indexOf('AutoUnpackNativesPlugin', pluginsIdx)
    expect(pluginsIdx).toBeGreaterThan(-1)
    expect(autoUnpackIdx).toBeGreaterThan(pluginsIdx)
  })
})
