/**
 * Theme service — wraps `nativeTheme.themeSource`. Carry-forward from L5.
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
      onChange?.(snapshot)
      return snapshot
    },
    snapshot(): ThemeSnapshot {
      return readSnapshot()
    },
  }
}
