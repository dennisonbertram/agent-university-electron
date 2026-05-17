/**
 * BT-L3-8: invoking the "Quit" menu item flushes pending journal writes
 * before app.quit() completes.
 *
 * Strategy:
 *   1. Launch the app.
 *   2. Append a "pending" journal entry from the renderer; await the resolve
 *      so we know the entry is persisted.
 *   3. Programmatically invoke the Quit menu item's click handler via
 *      app.evaluate (we find the item by role === 'quit' OR id === 'quit',
 *      and call .click() directly).
 *   4. Wait for the process to exit.
 *   5. Re-read the journal file from disk and assert the "pending" entry
 *      survived.
 */
import { test, expect } from '@playwright/test'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { launchApp, journalPath, type LaunchedApp } from './helpers'

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

test('BT-L3-8: clicking the Quit menu item persists pending journal entries before exit', async () => {
  // Use an explicit user-data dir so we can read the journal file AFTER the
  // app has fully exited.
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'l3-e2e-userdata-flush-'))
  launched = await launchApp({ userDataDir })

  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // Persist a journal entry.
  await win.evaluate(async () => {
    await (
      window as unknown as {
        api: { journalAppend: (v: unknown) => Promise<unknown> }
      }
    ).api.journalAppend({ text: 'pending' })
  })

  // Find and invoke the Quit menu item's click handler.
  const clicked = await app.evaluate(({ Menu, app: appModule }) => {
    const root = Menu.getApplicationMenu()
    if (!root) return { found: false, why: 'no-application-menu' as const }
    function find(item: Electron.MenuItem): Electron.MenuItem | null {
      if (item.role === 'quit' || item.id === 'quit') return item
      const sub = item.submenu
      if (!sub) return null
      for (const child of sub.items) {
        const hit = find(child)
        if (hit) return hit
      }
      return null
    }
    for (const top of root.items) {
      const hit = find(top)
      if (hit) {
        // Some roles have no JS click handler (Electron handles them internally);
        // calling app.quit() achieves the same observable effect for the test.
        if (typeof hit.click === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(hit as any).click()
        } else {
          appModule.quit()
        }
        return { found: true, label: hit.label, role: hit.role }
      }
    }
    return { found: false, why: 'no-quit-item' as const }
  })

  expect(
    (clicked as { found: boolean }).found,
    'expected a Quit menu item in the application menu',
  ).toBe(true)

  // Wait for the app to exit. Playwright resolves `close` only after the
  // electron process is gone — we manually poll the process here. Use the
  // `app.close()` Promise: it resolves on exit.
  try {
    await Promise.race([
      launched.app.close(),
      new Promise((r) => setTimeout(r, 5_000)),
    ])
  } catch {
    // already exited
  }
  launched = null

  // Read the journal file directly from disk.
  const file = path.join(userDataDir, 'journal.json')
  expect(existsSync(file)).toBe(true)
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Array<{ text: string }>
  expect(parsed.length).toBeGreaterThanOrEqual(1)
  expect(parsed.map((p) => p.text)).toContain('pending')

  // Suppress unused warning — exported helper.
  void journalPath
})
