/**
 * Dock service for L4 (macOS).
 *
 * `app.dock` is undefined on non-darwin; every method guards platform first.
 * Provides `setBadge` and `addRecentDocument`.
 */
import { app } from 'electron'
import type { Logger } from './log'

export interface DockService {
  setBadge(badge: string): { ok: boolean; badge: string }
  addRecentDocument(filePath: string): { ok: boolean }
}

export interface InstallDockOptions {
  readonly logger: Logger
}

export function installDock(opts: InstallDockOptions): DockService {
  const { logger } = opts

  return {
    setBadge(badge: string): { ok: boolean; badge: string } {
      if (process.platform !== 'darwin') {
        logger.warn('dock:set-badge:not-darwin', { badge })
        return { ok: false, badge }
      }
      const dock = app.dock
      if (!dock) {
        logger.warn('dock:set-badge:no-dock', { badge })
        return { ok: false, badge }
      }
      try {
        dock.setBadge(badge)
        logger.info(`dock:badge-set:${badge}`, { badge })
        return { ok: true, badge }
      } catch (err) {
        logger.error('dock:set-badge:threw', {
          badge,
          message: err instanceof Error ? err.message : String(err),
        })
        return { ok: false, badge }
      }
    },
    addRecentDocument(filePath: string): { ok: boolean } {
      try {
        app.addRecentDocument(filePath)
        logger.info('recent:added', { filePath })
        return { ok: true }
      } catch (err) {
        logger.error('recent:add:threw', {
          filePath,
          message: err instanceof Error ? err.message : String(err),
        })
        return { ok: false }
      }
    },
  }
}
