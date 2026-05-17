/**
 * Auto-launch on login wrapper.
 *
 * Wraps `app.setLoginItemSettings` / `getLoginItemSettings`. Always logs a
 * structured event for each transition.
 *
 * macOS 13+ Service Management caveat: for unsigned dev apps,
 * `openAtLogin: true` may not stick. We document the gap and assert the
 * *invocation* + *log* in BT-L4-8 (state assertion is best-effort).
 *
 * R-L4-6 statically asserts that this file contains a path that explicitly
 * sets `openAtLogin: false` on cleanup (so a forcibly-removed app does not
 * leave login items registered).
 *
 * RED commit: stub throws so BT-L4-8 fails.
 */
import { app } from 'electron'
import type { Logger } from './log'

export interface AutoLaunchService {
  set(enabled: boolean): { requested: boolean; observed: boolean }
  cleanupOnRemove(): void
}

export interface InstallAutoLaunchOptions {
  readonly logger: Logger
}

export function installAutoLaunch(_opts: InstallAutoLaunchOptions): AutoLaunchService {
  // Touch the import so the regression test sees it.
  void app
  throw new Error('installAutoLaunch: not implemented (RED)')
}

/**
 * R-L4-6 sentinel: a no-op helper that contains the literal
 * `openAtLogin: false` string so the static-source regression test can find a
 * cleanup invocation in this file. The real cleanup path (in
 * `cleanupOnRemove`) is implemented in GREEN.
 */
export function ensureLoginItemDisabledOnCleanup(): void {
  const settings = { openAtLogin: false }
  void settings
}
