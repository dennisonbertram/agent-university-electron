/**
 * Journal append behavioral test (BT-C-5).
 *
 * Drives the deep-link `pulse://log?text=hello world` via the test seam, then
 * asserts:
 *   - A SQLite row is inserted with ciphertext (NOT plaintext when encryption
 *     is available).
 *   - The log marker `journal:append:1-row` is written.
 *   - A confirmation notification is queued (either shown OR failed-unsigned).
 */
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { launchApp, waitForEvent, callApi, findEvents } from './helpers'
import Database from 'better-sqlite3'

test.describe.serial('Pulse journal — deep-link append', () => {
  test('BT-C-5: pulse://log?text=hello world ⇒ SQLite row inserted, encrypted, notification queued', async () => {
    const { app, logFile, userDataDir } = await launchApp()
    try {
      const win = await app.firstWindow()
      await waitForEvent(logFile, 'app:install-complete', 15_000)

      await callApi(win, 'testFireDeepLink', { url: 'pulse://log?text=hello%20world' })
      await waitForEvent(logFile, 'journal:append:1-row', 5_000)

      // Inspect the DB directly.
      const dbPath = path.join(userDataDir, 'journal.db')
      const db = new Database(dbPath, { readonly: true })
      try {
        const rows = db
          .prepare('SELECT id, ts, ciphertext, length FROM journal ORDER BY id ASC')
          .all() as Array<{ id: number; ts: string; ciphertext: Buffer; length: number }>
        expect(rows.length).toBeGreaterThanOrEqual(1)
        const row = rows[0]!
        expect(row.length).toBe('hello world'.length)
        // The ciphertext column is a Buffer. If safeStorage is available
        // (the typical macOS case under Playwright), it must NOT equal the
        // plaintext; if not available, the fallback writes plaintext bytes
        // and a `journal:encryption-unavailable:fallback-plaintext` log was
        // emitted at boot. Either is acceptable, but exactly one branch.
        const fallbacks = findEvents(logFile, 'journal:encryption-unavailable:fallback-plaintext')
        if (fallbacks.length === 0) {
          expect(row.ciphertext.toString('utf8')).not.toBe('hello world')
        } else {
          expect(row.ciphertext.toString('utf8')).toBe('hello world')
        }
      } finally {
        db.close()
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
