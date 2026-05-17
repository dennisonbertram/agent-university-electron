/**
 * Global-shortcut service for Pulse.
 *
 * Two registered accelerators:
 *   - `CmdOrCtrl+Shift+P` — focus mode toggle (BT-C-1).
 *   - `CmdOrCtrl+Shift+J` — quick journal capture (drives a notification +
 *     a minimal entry — but the deep-link path is the primary capture surface).
 *
 * R-L4-2 invariant carried into capstone (R-C-7): `app.on('will-quit', ...)`
 * MUST be present here and call `globalShortcut.unregisterAll()`.
 */
import { app, globalShortcut } from 'electron'
import type { Logger } from './log'

export const FOCUS_TOGGLE_ACCELERATOR = 'CmdOrCtrl+Shift+P'
export const JOURNAL_QUICK_ACCELERATOR = 'CmdOrCtrl+Shift+J'

export interface InstallShortcutsOptions {
  readonly logger: Logger
  readonly onFire?: (accelerator: string) => void
}

export interface ShortcutsService {
  isRegistered(accelerator: string): boolean
  fireForTest(accelerator: string): boolean
  unregisterAll(): void
}

interface HandlerEntry {
  accelerator: string
  handler: () => void
}

export function installShortcuts(opts: InstallShortcutsOptions): ShortcutsService {
  const { logger } = opts
  const handlers = new Map<string, HandlerEntry>()

  const register = (accelerator: string): void => {
    const handler = (): void => {
      logger.info(`shortcut:${accelerator}:fired`, { accelerator })
      opts.onFire?.(accelerator)
    }
    handlers.set(accelerator, { accelerator, handler })
    let registered = false
    try {
      registered = globalShortcut.register(accelerator, handler)
    } catch (err) {
      logger.error('shortcut:register:threw', {
        accelerator,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    if (registered) {
      logger.info('shortcut:registered', { accelerator })
    } else {
      logger.warn('shortcut:register:failed', {
        accelerator,
        reason: 'register() returned false; OS may hold the accelerator',
      })
    }
  }

  register(FOCUS_TOGGLE_ACCELERATOR)
  register(JOURNAL_QUICK_ACCELERATOR)

  // R-L4-2 / R-C-7 invariant: literal `app.on('will-quit'` and
  // `globalShortcut.unregisterAll()` required by static-source regression tests.
  app.on('will-quit', () => {
    try {
      globalShortcut.unregisterAll()
      logger.info('shortcut:cleanup:will-quit', { count: handlers.size })
    } catch (err) {
      logger.error('shortcut:cleanup:failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })

  return {
    isRegistered(accelerator: string): boolean {
      try {
        return globalShortcut.isRegistered(accelerator)
      } catch {
        return false
      }
    },
    fireForTest(accelerator: string): boolean {
      const entry = handlers.get(accelerator)
      if (!entry) {
        logger.warn('shortcut:fire-for-test:unknown', { accelerator })
        return false
      }
      try {
        entry.handler()
        return true
      } catch (err) {
        logger.error('shortcut:fire-for-test:threw', {
          accelerator,
          message: err instanceof Error ? err.message : String(err),
        })
        return false
      }
    },
    unregisterAll(): void {
      try {
        globalShortcut.unregisterAll()
      } catch (err) {
        logger.error('shortcut:unregister-all:failed', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
      handlers.clear()
    },
  }
}
