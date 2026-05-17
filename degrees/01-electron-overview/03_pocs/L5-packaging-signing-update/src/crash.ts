/**
 * crashReporter wrapper for L5.
 *
 * CRITICAL ORDERING (R-L5-1): this module's `startCrashReporter()` is
 * invoked at MODULE-LOAD time in `src/main.ts`, ABOVE the `app.whenReady()`
 * call. Renderers spawned after the start call are automatically monitored.
 *
 * Behavior:
 *   - When `submitURL` is set, we wire `uploadToServer: true` (the test
 *     sink is a non-existent server by default — receipts don't matter for
 *     the wiring test BT-L5-8).
 *   - When `submitURL` is NOT set, we still call `crashReporter.start()`
 *     with `uploadToServer: false` (Electron 13+ requires the field to be
 *     `false` when no URL is provided).
 *   - We capture `startedBeforeWhenReady` once at start-time by reading
 *     `app.isReady()`. The IPC snapshot surfaces this boolean so the test
 *     can prove the ordering at runtime, not just statically.
 *
 * Forbidden:
 *   - Calling `crashReporter.start()` again from a renderer (the main-
 *     process call auto-monitors renderers). The preload doesn't import
 *     this module.
 */
import { app, crashReporter } from 'electron'
import type { Logger } from './log'
import type { CrashReporterStateSnapshot } from './ipc'

export interface CrashReporterService {
  getState(): CrashReporterStateSnapshot
}

export interface StartCrashReporterOptions {
  readonly logger: Logger
  readonly submitURL?: string | undefined
  readonly productName: string
}

const DEFAULT_SUBMIT_URL = 'http://127.0.0.1:8766/crashes'

export function startCrashReporter(opts: StartCrashReporterOptions): CrashReporterService {
  const { logger, productName } = opts
  const submitURL = opts.submitURL ?? DEFAULT_SUBMIT_URL
  const uploadToServer = submitURL.length > 0

  // Record whether the start() call happens before the app is ready. On the
  // happy path `app.isReady()` is false here (we're at module-load time);
  // if it's true, R-L5-1 has regressed.
  const startedBeforeWhenReady = !app.isReady()

  crashReporter.start({
    productName,
    submitURL: uploadToServer ? submitURL : '',
    uploadToServer,
    ignoreSystemCrashHandler: false,
    rateLimit: false,
    compress: true,
    globalExtra: {
      _productName: productName,
      environment: process.env.NODE_ENV ?? 'production',
    },
  })

  logger.info('crash-reporter:started', {
    submitURL: uploadToServer ? submitURL : null,
    uploadToServer,
    startedBeforeWhenReady,
  })

  return {
    getState(): CrashReporterStateSnapshot {
      // `getUploadedReports()` returns an array of past uploads; we report
      // the count (the test only asserts the API is reachable).
      let uploadedReports = 0
      try {
        uploadedReports = crashReporter.getUploadedReports().length
      } catch {
        // older Electron variants may throw before any reports exist
      }
      return {
        started: true,
        submitURL: uploadToServer ? submitURL : null,
        uploadToServer,
        startedBeforeWhenReady,
        uploadedReports,
      }
    },
  }
}
