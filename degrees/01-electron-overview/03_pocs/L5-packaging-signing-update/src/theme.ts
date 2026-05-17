/**
 * Theme service for L4.
 *
 * Wraps `nativeTheme.themeSource`. Subscribes to `updated` and pushes a
 * `theme:changed` snapshot via the `onChange` hook so main can broadcast it
 * to every BrowserWindow.
 *
 * `setSource('dark')` flips the source, then reads `shouldUseDarkColors` for
 * the resolved boolean. The `updated` event fires asynchronously after the
 * source change; we ALSO emit the snapshot synchronously from the setter so
 * BT-L4-9 can observe the push event without racing the event-loop.
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
  readonly onChange?: (snapshot: ThemeSnapshot) => void
}

function readSnapshot(): ThemeSnapshot {
  return {
    source: nativeTheme.themeSource as ThemeSource,
    isDark: nativeTheme.shouldUseDarkColors,
  }
}

export function installThemeService(opts: InstallThemeServiceOptions): ThemeService {
  const { logger, onChange } = opts

  try {
    nativeTheme.on('updated', () => {
      const snapshot = readSnapshot()
      logger.info('theme:updated', { ...snapshot })
      onChange?.(snapshot)
    })
    logger.info('theme:installed', { ...readSnapshot() })
  } catch (err) {
    logger.error('theme:install:threw', {
      message: err instanceof Error ? err.message : String(err),
    })
  }

  return {
    setSource(source: ThemeSource): ThemeSnapshot {
      try {
        nativeTheme.themeSource = source
      } catch (err) {
        logger.error('theme:set:threw', {
          source,
          message: err instanceof Error ? err.message : String(err),
        })
      }
      const snapshot = readSnapshot()
      logger.info(`theme:source-set:${source}`, { ...snapshot })
      // Synchronous broadcast so the renderer push lands without waiting for
      // the `updated` event (which may not fire on some headless test setups).
      onChange?.(snapshot)
      return snapshot
    },
    snapshot(): ThemeSnapshot {
      return readSnapshot()
    },
  }
}
