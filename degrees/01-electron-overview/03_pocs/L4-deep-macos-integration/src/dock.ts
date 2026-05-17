/**
 * Dock service for L4 (macOS).
 *
 * `app.dock` is undefined on non-darwin; every method guards platform first.
 * Provides `setBadge`, `getBadge`, `addRecentDocument`, `clearRecentDocuments`.
 *
 * RED commit: setBadge throws so BT-L4-10/11 fail.
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

export function installDock(_opts: InstallDockOptions): DockService {
  void app
  throw new Error('installDock: not implemented (RED)')
}
