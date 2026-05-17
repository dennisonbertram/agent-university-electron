/**
 * Theme service for L4.
 *
 * Wraps `nativeTheme.themeSource`. On change, listens to `updated` and pushes
 * a `theme:changed` IPC event to every BrowserWindow with the current snapshot.
 *
 * RED commit: stub throws so BT-L4-9 fails.
 */
import { nativeTheme } from 'electron'
import type { Logger } from './log'

export type ThemeSource = 'system' | 'light' | 'dark'

export interface ThemeSnapshot {
  readonly source: ThemeSource
  readonly isDark: boolean
}

export interface ThemeService {
  setSource(source: ThemeSource): ThemeSnapshot
  snapshot(): ThemeSnapshot
}

export interface InstallThemeServiceOptions {
  readonly logger: Logger
  /** Called whenever `nativeTheme.updated` fires; the renderer is then
   *  notified through this hook. */
  readonly onChange?: (snapshot: ThemeSnapshot) => void
}

export function installThemeService(_opts: InstallThemeServiceOptions): ThemeService {
  void nativeTheme
  throw new Error('installThemeService: not implemented (RED)')
}
