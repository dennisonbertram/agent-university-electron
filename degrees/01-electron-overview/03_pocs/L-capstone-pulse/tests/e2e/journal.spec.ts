/**
 * Journal append behavioral test (BT-C-5).
 *
 * Drives the deep-link `pulse://log?text=hello world` via the test seam, then
 * asserts via the test IPC `test:get-raw-journal-rows` (NOT a direct
 * better-sqlite3 load from the test process — the binary is ABI-pinned to
 * Electron's V8 and would NODE_MODULE_VERSION-mismatch under system Node) that:
 *   - A SQLite row exists with ciphertext (NOT plaintext when encryption is
 *     available).
 *   - The log marker `journal:append:1-row` is written.
 *   - A confirmation notification is queued (either shown OR failed-unsigned).
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, callApi, findEvents } from './helpers'

test.describe.serial('Pulse journal — deep-link append', () => {
  test('BT-C-5: pulse://log?text=hello world ⇒ SQLite row inserted, encrypted, notification queued', async () => {
    const { app, logFile } = await launchApp()
    try {
      const win = await app.firstWindow()
      await waitForEvent(logFile, 'app:install-complete', 15_000)

      await callApi(win, 'testFireDeepLink', { url: 'pulse://log?text=hello%20world' })
      await waitForEvent(logFile, 'journal:append:1-row', 5_000)

      // Inspect the DB through the in-process test IPC.
      const rows = await callApi<ReadonlyArray<{
        id: number; ts: string; ciphertextBase64: string; length: number
      }>>(win, 'testGetRawJournalRows')
      expect(rows.length).toBeGreaterThanOrEqual(1)
      const row = rows[0]!
      expect(row.length).toBe('hello world'.length)
      const ciphertext = Buffer.from(row.ciphertextBase64, 'base64')
      // The ciphertext column is a Buffer. If safeStorage is available
      // (the typical macOS case under Playwright), it must NOT equal the
      // plaintext; if not available, the fallback writes plaintext bytes
      // and a `journal:encryption-unavailable:fallback-plaintext` log was
      // emitted at boot.
      const fallbacks = findEvents(logFile, 'journal:encryption-unavailable:fallback-plaintext')
      if (fallbacks.length === 0) {
        expect(ciphertext.toString('utf8')).not.toBe('hello world')
      } else {
        expect(ciphertext.toString('utf8')).toBe('hello world')
      }

      // Confirmation notification — observable via shown OR failed-unsigned.
      const shown = findEvents(logFile, 'notification:shown')
      const failed = findEvents(logFile, 'notification:failed:unsigned')
      expect(shown.length + failed.length).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })
})
