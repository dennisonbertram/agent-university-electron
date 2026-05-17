/**
 * App lifecycle wiring for Pulse — carry-forward from L5, scheme renamed
 * to `pulse://`. Routes `pulse://start`, `pulse://stop`, `pulse://log?text=...`
 * to the appropriate adapters.
 */
import { app, type BrowserWindow } from 'electron'
import type { Logger } from './log'
import { parseDeepLink, type ParsedDeepLink, DEEP_LINK_SCHEME } from './protocol'

export interface InstallLifecycleOptions {
  readonly logger: Logger
  readonly getMainWindow: () => BrowserWindow | null
  readonly onDeepLink: (link: ParsedDeepLink, origin: 'second-instance' | 'open-url') => void
  readonly onWillQuit: () => void
}

export interface LifecycleController {
  dispatchArgs(args: readonly string[], origin: 'second-instance' | 'open-url'): void
  dispatchUrl(url: string, origin: 'second-instance' | 'open-url'): void
}

export function installLifecycle(opts: InstallLifecycleOptions): LifecycleController {
  const { logger, getMainWindow, onDeepLink, onWillQuit } = opts

  app.on('will-quit', () => {
    try {
      onWillQuit()
    } catch (err) {
      logger.error('lifecycle:will-quit:hook-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })

  const focusMain = (): void => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    try {
      win.show()
      win.focus()
    } catch (err) {
      logger.warn('lifecycle:focus-main:failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  function handleUrl(url: string, origin: 'second-instance' | 'open-url'): void {
    const logEvent = origin === 'open-url' ? 'lifecycle:open-url' : 'lifecycle:second-instance'
    const [parsed, err] = parseDeepLink(url)
    if (err || !parsed) {
      logger.warn(logEvent, { url, error: err?.message ?? 'unknown' })
      focusMain()
      return
    }
    logger.info(logEvent, {
      url, scheme: parsed.scheme, action: parsed.action, params: parsed.params,
    })
    focusMain()
    try {
      onDeepLink(parsed, origin)
    } catch (handlerErr) {
      logger.error('lifecycle:deeplink:handler-failed', {
        message: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
      })
    }
  }

  return {
    dispatchArgs(args: readonly string[], origin): void {
      const url = args.find((a) => typeof a === 'string' && a.startsWith(`${DEEP_LINK_SCHEME}://`))
      if (!url) {
        const logEvent = origin === 'open-url' ? 'lifecycle:open-url' : 'lifecycle:second-instance'
        logger.info(logEvent, { args, deepLink: null })
        focusMain()
        return
      }
      handleUrl(url, origin)
    },
    dispatchUrl(url: string, origin): void {
      handleUrl(url, origin)
    },
  }
}
