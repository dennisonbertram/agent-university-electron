/**
 * crashReporter wrapper — carry-forward from L5 (R-L5-1 / R-C-5 invariant).
 * `startCrashReporter` runs at module-load time in main.ts, BEFORE
 * `app.whenReady()`.
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
