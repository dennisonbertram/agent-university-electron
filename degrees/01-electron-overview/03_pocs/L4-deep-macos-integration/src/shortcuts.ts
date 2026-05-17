/**
 * Global-shortcut service for L4.
 *
 * Registers `CmdOrCtrl+Shift+P` on installation. The corresponding handler is
 * stored so test seams (`fireForTest`) can invoke it directly without an OS
 * key event.
 *
 * INVARIANT (R-L4-2): `app.on('will-quit', ...)` MUST be present in this file
 * and call `globalShortcut.unregisterAll()`. The static-source regression test
 * asserts both.
 *
 * RED commit: stub returns false / throws so BT-L4-4 fails.
 */
import { app, globalShortcut } from 'electron'
import type { Logger } from './log'

export const FOCUS_TOGGLE_ACCELERATOR = 'CmdOrCtrl+Shift+P'

export interface InstallShortcutsOptions {
  readonly logger: Logger
  /** Invoked when the registered shortcut handler runs. */
  readonly onFire?: (accelerator: string) => void
}

export interface ShortcutsService {
  isRegistered(accelerator: string): boolean
  fireForTest(accelerator: string): boolean
  unregisterAll(): void
}

// Marker assignment for the static-source regression to detect the cleanup hook.
// The GREEN commit replaces this with a real `app.on('will-quit', ...)` block.
void app

export function installShortcuts(_opts: InstallShortcutsOptions): ShortcutsService {
  // STUB — RED.
  throw new Error('installShortcuts: not implemented (RED)')
}

// Touch globalShortcut to keep the import visible to the regression test.
void globalShortcut
