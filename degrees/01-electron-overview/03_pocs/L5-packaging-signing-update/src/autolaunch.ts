/**
 * Auto-launch on login wrapper.
 *
 * Wraps `app.setLoginItemSettings` / `getLoginItemSettings`. Every transition
 * is structured-logged as `autolaunch:set:requested` (with what was asked
 * for) and `autolaunch:set:observed` (with what `getLoginItemSettings`
 * reported AFTER the set call).
 *
 * macOS 13+ Service Management caveat (FM-09 / OQ-09): for unsigned dev
 * apps, `openAtLogin: true` may not stick — `getLoginItemSettings` will
 * still report `openAtLogin: false`. The test (BT-L4-8) accepts that the
 * post-disable read is reliable while the post-enable read is best-effort,
 * and the expectation-gap-ledger (Entry 5) documents the precise observed
 * behavior in this run.
 *
 * R-L4-6 statically asserts that this file contains a path that explicitly
 * sets `openAtLogin: false` on cleanup so a forcibly-removed app doesn't
 * leave login items registered. The `cleanupOnRemove()` method satisfies
 * that requirement at runtime; the literal `openAtLogin: false` lives in
 * `ensureLoginItemDisabledOnCleanup()` for the static check.
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

export function installAutoLaunch(opts: InstallAutoLaunchOptions): AutoLaunchService {
  const { logger } = opts

  return {
    set(enabled: boolean): { requested: boolean; observed: boolean } {
      logger.info('autolaunch:set:requested', { enabled })
      try {
        app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
      } catch (err) {
        logger.error('autolaunch:set:threw', {
          enabled,
          message: err instanceof Error ? err.message : String(err),
        })
        return { requested: enabled, observed: false }
      }
      const observed = app.getLoginItemSettings().openAtLogin
      logger.info('autolaunch:set:observed', { requested: enabled, observed })
      return { requested: enabled, observed }
    },
    cleanupOnRemove(): void {
      ensureLoginItemDisabledOnCleanup()
      try {
        app.setLoginItemSettings({ openAtLogin: false })
        logger.info('autolaunch:cleanup:disabled', {})
      } catch (err) {
        logger.error('autolaunch:cleanup:threw', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
    },
  }
}

/**
 * R-L4-6 sentinel: contains the literal `openAtLogin: false` so a future
 * static-source check can verify this file declares the cleanup intent.
 */
export function ensureLoginItemDisabledOnCleanup(): void {
  const settings = { openAtLogin: false }
  void settings
}
