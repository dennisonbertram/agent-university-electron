/**
 * App lifecycle wiring for L4.
 *
 * `dispatchArgs(args, origin)` is the single entry point used by both:
 *   - macOS `open-url` event (origin === 'open-url') — args = [url]
 *   - Windows/Linux `second-instance` event (origin === 'second-instance') —
 *     args = the full argv of the second process
 *
 * On each call:
 *   1. Find the first arg that starts with `electron-l4://`.
 *   2. Parse it via `parseDeepLink`.
 *   3. Log either `lifecycle:open-url` or `lifecycle:second-instance` with
 *      the parsed payload OR a `no-link` payload if no URL was present.
 *   4. Focus the existing main window (BT-L4-6 expectation).
 *   5. Invoke `onDeepLink` so main.ts can push the parsed link to the renderer.
 *
 * R-L4-2 cleanup is owned by `shortcuts.ts`; we additionally invoke
 * `onWillQuit` here so main can layer in its own teardown.
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

  return {
    dispatchArgs(args: readonly string[], origin): void {
      const logEvent = origin === 'open-url' ? 'lifecycle:open-url' : 'lifecycle:second-instance'

      // Find the first argument that looks like our deep link.
      const url = args.find((a) => typeof a === 'string' && a.startsWith(`${DEEP_LINK_SCHEME}://`))

      if (!url) {
        logger.info(logEvent, { args, deepLink: null })
        focusMain()
        return
      }

      const [parsed, err] = parseDeepLink(url)
      if (err || !parsed) {
        logger.warn(logEvent, {
          args,
          url,
          error: err?.message ?? 'unknown',
        })
        focusMain()
        return
      }
      logger.info(logEvent, {
        args,
        url,
        scheme: parsed.scheme,
        action: parsed.action,
        params: parsed.params,
      })
      focusMain()
      try {
        onDeepLink(parsed, origin)
      } catch (handlerErr) {
        logger.error('lifecycle:deeplink:handler-failed', {
          message: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
        })
      }
    },
  }
}
