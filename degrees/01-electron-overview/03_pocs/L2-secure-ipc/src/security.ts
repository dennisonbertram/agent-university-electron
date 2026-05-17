/**
 * Navigation + window-open guards + permission-handler registration.
 *
 * Registered once per BrowserWindow's `webContents`. The expected origin is
 * derived from the file:// URL the window was loaded with (captured by
 * `main.ts` and passed in here). Any navigation to a different origin OR any
 * `window.open` is logged and blocked.
 *
 * SKELETON (RED commit): registerSecurityGuards is a no-op stub so the
 * navigation/window-open e2e tests fail on real assertions.
 */
import type { Session, WebContents } from 'electron'
import type { Logger } from './log'

export interface SecurityGuardOptions {
  /** The origin the window is "supposed" to be on. Anything else is denied. */
  expectedOrigin: string
  logger: Logger
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerSecurityGuards(_contents: WebContents, _opts: SecurityGuardOptions): void {
  // RED skeleton — no-op. GREEN implements will-navigate, setWindowOpenHandler,
  // and a defensive will-redirect guard.
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerSessionPermissionHandler(_session: Session, _logger: Logger): void {
  // RED skeleton — no-op. GREEN denies every permission request (none are
  // needed for L2's local renderer).
}
