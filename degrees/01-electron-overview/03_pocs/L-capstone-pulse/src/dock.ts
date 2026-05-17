/**
 * Dock service for the Pulse capstone.
 *
 * Differs from L5:
 *   - Adds `hide()` so main.ts can `app.dock.hide()` BEFORE window creation,
 *     producing a no-dock menu-bar app (BT-C-10).
 *   - `isVisible()` reports whether the dock icon is currently shown.
 *
 * `LSUIElement: true` in the packaged Info.plist is the load-bearing
 * configuration for menu-bar-only — `dock.hide()` covers the dev-mode path.
 */
import { app } from 'electron'
import type { Logger } from './log'

export interface DockService {
  setBadge(badge: string): { ok: boolean; badge: string }
  addRecentDocument(filePath: string): { ok: boolean }
  hide(): { ok: boolean; visible: boolean }
  isVisible(): boolean
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
    hide(): { ok: boolean; visible: boolean } {
      if (process.platform !== 'darwin') {
        logger.warn('dock:hide:not-darwin', {})
        return { ok: false, visible: false }
      }
      const dock = app.dock
      if (!dock) {
        logger.warn('dock:hide:no-dock', {})
        return { ok: false, visible: false }
      }
      try {
        dock.hide()
        const visible = dock.isVisible()
        logger.info('app:dock-hidden', { visible })
        return { ok: true, visible }
      } catch (err) {
        logger.error('dock:hide:threw', {
          message: err instanceof Error ? err.message : String(err),
        })
        return { ok: false, visible: true }
      }
    },
    isVisible(): boolean {
      if (process.platform !== 'darwin') return false
      const dock = app.dock
      if (!dock) return false
      try {
        return dock.isVisible()
      } catch {
        return false
      }
    },
  }
}
