/**
 * App lifecycle wiring for L4.
 *
 * Responsibilities:
 *   - `requestSingleInstanceLock()` BEFORE `whenReady()` (R-L4-5). The actual
 *     call is in `main.ts` at module-top so the static-source ordering check
 *     passes.
 *   - `second-instance` handler: focus the existing window, parse any deep
 *     link arg, dispatch to the shared deep-link handler, log
 *     `lifecycle:second-instance`.
 *   - `open-url` handler (macOS): parse + dispatch + log `lifecycle:open-url`.
 *   - `activate` handler (macOS): re-create a window when none exist.
 *   - `before-quit` carry-forward from L3 (storage flush) — handled in main.ts.
 *   - `will-quit`: tear down globalShortcut registrations + cleanup
 *     autolaunch (R-L4-6) + log `lifecycle:will-quit:cleanup`.
 *
 * RED commit: installLifecycle returns immediately without wiring anything,
 * so BT-L4-6/7/12 fail.
 */
import type { BrowserWindow } from 'electron'
import type { Logger } from './log'
import type { ParsedDeepLink } from './protocol'

export interface InstallLifecycleOptions {
  readonly logger: Logger
  readonly getMainWindow: () => BrowserWindow | null
  readonly onDeepLink: (link: ParsedDeepLink, origin: 'second-instance' | 'open-url') => void
  /** Hook for shortcut cleanup. */
  readonly onWillQuit: () => void
}

export interface LifecycleController {
  /** Dispatch a deep-link arg list (e.g. from `second-instance`). */
  dispatchArgs(args: readonly string[], origin: 'second-instance' | 'open-url'): void
}

export function installLifecycle(_opts: InstallLifecycleOptions): LifecycleController {
  return {
    dispatchArgs: (_args: readonly string[], _origin): void => {
      // STUB — RED.
    },
  }
}
