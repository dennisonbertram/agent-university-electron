/**
 * Global-shortcut service for L4.
 *
 * Registers `CmdOrCtrl+Shift+P` on installation. The corresponding handler is
 * stored so test seams (`fireForTest`) can invoke it directly without an OS
 * key event.
 *
 * INVARIANT (R-L4-2): `app.on('will-quit', ...)` MUST be present in this file
 * and call `globalShortcut.unregisterAll()`. The static-source regression test
 * asserts both.
 */
import { app, globalShortcut } from 'electron'
import type { Logger } from './log'

export const FOCUS_TOGGLE_ACCELERATOR = 'CmdOrCtrl+Shift+P'

export interface InstallShortcutsOptions {
  readonly logger: Logger
  /** Invoked when the registered shortcut handler runs. */
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

  // R-L4-2: cleanup hook so leftover registrations cannot become zombie
  // accelerators. The literal string `app.on('will-quit'` and the literal
  // `globalShortcut.unregisterAll()` are required by the static-source test.
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
