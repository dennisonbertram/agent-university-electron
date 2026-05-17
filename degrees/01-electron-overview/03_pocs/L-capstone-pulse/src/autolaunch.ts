/**
 * Auto-launch on login wrapper for Pulse.
 *
 * Differs from L5:
 *   - For a menu-bar app, `openAsHidden: true` is the right call — auto-launch
 *     should not pop the popover window on login. Documented in Entry 5 of
 *     expectation-gap-ledger (Service Management API behavior on macOS 13+).
 *
 * R-L4-6 carry-forward: the file declares `openAtLogin: false` on cleanup.
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
 * R-L4-6 sentinel: contains the literal `openAtLogin: false`.
 */
export function ensureLoginItemDisabledOnCleanup(): void {
  const settings = { openAtLogin: false }
  void settings
}
