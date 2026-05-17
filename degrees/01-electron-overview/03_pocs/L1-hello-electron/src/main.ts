/**
 * STUB — implemented in GREEN commit.
 *
 * Intentionally minimal so that:
 *   - Electron can launch (so Playwright `_electron` can attach).
 *   - No BrowserWindow is created → BT-L1-1 fails.
 *   - No IPC handlers are registered → BT-L1-2, BT-L1-3 fail.
 *   - No structured log entries are emitted → BT-L1-4 fails.
 */
import { app } from 'electron'

app.whenReady().then(() => {
  // Deliberately do nothing in RED.
}).catch((err: unknown) => {
  // Best-effort: surface unexpected boot failures.
  console.error('[main:stub] whenReady rejected', err)
})
