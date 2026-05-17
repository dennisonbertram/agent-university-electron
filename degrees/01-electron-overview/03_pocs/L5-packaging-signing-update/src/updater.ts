/**
 * electron-updater wiring for L5.
 *
 * Design:
 *   - `provider: 'generic'` ALWAYS. R-L5-3 enforces this in source; the
 *     local fixture pattern (latest-mac.yml served from a Node HTTP server)
 *     is the only update mechanism this POC exercises. Real publishers
 *     (GitHub, S3) are out of scope.
 *   - `autoDownload = false`. L5 only verifies "check"; we never actually
 *     pull the binary.
 *   - The feed URL comes from `process.env.UPDATE_URL` and falls back to
 *     `http://127.0.0.1:8765/updates` (the test default).
 *   - `forceDevUpdateConfig = true` so the updater runs from a dev build
 *     too (electron-updater normally short-circuits the check when the
 *     app is unpackaged; we want to drive it from the Playwright e2e).
 *
 * Logging events (the load-bearing test signal — BT-L5-6 and BT-L5-7):
 *   - updater:configured          { feedUrl, provider, currentVersion }
 *   - updater:checking            {}
 *   - updater:update-available    { version }
 *   - updater:update-not-available { version }
 *   - updater:download-progress   { percent, bytesPerSecond, transferred, total }
 *   - updater:update-downloaded   { version }
 *   - updater:error               { message }
 *
 * The IPC test seam (`test:check-for-updates`) calls `checkForUpdates()`
 * (NOT `checkForUpdatesAndNotify()`) and resolves once the updater fires
 * `update-available` OR `update-not-available` OR `error`. Calling
 * `quitAndInstall()` is intentionally NOT exposed here — that lives in the
 * capstone.
 */
import { autoUpdater } from 'electron-updater'
import type { Logger } from './log'
import type { UpdaterStateSnapshot } from './ipc'

export interface UpdaterService {
  checkForUpdates(): Promise<UpdaterStateSnapshot>
  getState(): UpdaterStateSnapshot
}

export interface InstallUpdaterOptions {
  readonly logger: Logger
  readonly currentVersion: string
  readonly feedUrl: string
  readonly autoCheck: boolean
}

const DEFAULT_FEED_URL = 'http://127.0.0.1:8765/updates'

export function installUpdater(opts: InstallUpdaterOptions): UpdaterService {
  const { logger, currentVersion } = opts
  const feedUrl = opts.feedUrl ?? process.env.UPDATE_URL ?? DEFAULT_FEED_URL

  // We do NOT want electron-updater downloading binaries during the test
  // run. The test only asserts that the check completes and emits the
  // expected event.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  // `forceDevUpdateConfig = true` lets the updater run against the dev
  // build. Without it, electron-updater detects an unpackaged process and
  // refuses to check for updates.
  ;(autoUpdater as unknown as { forceDevUpdateConfig: boolean }).forceDevUpdateConfig = true

  autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })

  let state: UpdaterStateSnapshot = {
    lastEvent: 'idle',
    version: null,
    currentVersion,
    feedUrl,
    provider: 'generic',
    errorMessage: null,
  }

  logger.info('updater:configured', { feedUrl, provider: 'generic', currentVersion })

  function transition(
    lastEvent: UpdaterStateSnapshot['lastEvent'],
    overrides: Partial<UpdaterStateSnapshot> = {},
  ): void {
    state = {
      ...state,
      lastEvent,
      ...overrides,
    }
  }

  // Pending check resolver: when the IPC handler calls `checkForUpdates()`
  // we resolve it on the FIRST observed terminal-or-near-terminal event:
  // update-available, update-not-available, or error.
  let pendingResolver: ((snap: UpdaterStateSnapshot) => void) | null = null

  function resolvePending(): void {
    if (pendingResolver) {
      const r = pendingResolver
      pendingResolver = null
      r(state)
    }
  }

  autoUpdater.on('checking-for-update', () => {
    transition('checking-for-update')
    logger.info('updater:checking', {})
  })

  autoUpdater.on('update-available', (info: { version?: string }) => {
    const version = info?.version ?? null
    transition('update-available', { version })
    logger.info('updater:update-available', { version })
    resolvePending()
  })

  autoUpdater.on('update-not-available', (info: { version?: string }) => {
    const version = info?.version ?? null
    transition('update-not-available', { version })
    logger.info('updater:update-not-available', { version })
    resolvePending()
  })

  autoUpdater.on('download-progress', (progress: {
    percent?: number
    bytesPerSecond?: number
    transferred?: number
    total?: number
  }) => {
    transition('download-progress')
    logger.info('updater:download-progress', {
      percent: progress?.percent ?? 0,
      bytesPerSecond: progress?.bytesPerSecond ?? 0,
      transferred: progress?.transferred ?? 0,
      total: progress?.total ?? 0,
    })
  })

  autoUpdater.on('update-downloaded', (info: { version?: string }) => {
    const version = info?.version ?? null
    transition('update-downloaded', { version })
    logger.info('updater:update-downloaded', { version })
  })

  autoUpdater.on('error', (err: Error) => {
    const message = err instanceof Error ? err.message : String(err)
    transition('error', { errorMessage: message })
    logger.error('updater:error', { message })
    resolvePending()
  })

  if (opts.autoCheck) {
    autoUpdater.checkForUpdates().catch((err: unknown) => {
      logger.error('updater:auto-check-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    })
  }

  return {
    async checkForUpdates(): Promise<UpdaterStateSnapshot> {
      // Set up the resolver BEFORE invoking the check, otherwise a very
      // fast `update-not-available` event could race past us.
      const settled = new Promise<UpdaterStateSnapshot>((resolve) => {
        pendingResolver = resolve
      })
      try {
        await autoUpdater.checkForUpdates()
      } catch (err) {
        // electron-updater's own error event will fire and resolve the
        // promise; we just log the rejection from the API call itself.
        logger.warn('updater:check-call-rejected', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
      // Race the settled promise against a timeout — if neither
      // update-available/not-available/error fires within 10s, surface
      // the current state anyway.
      const TIMEOUT_MS = 10_000
      const timeout = new Promise<UpdaterStateSnapshot>((resolve) => {
        setTimeout(() => resolve(state), TIMEOUT_MS)
      })
      const result = await Promise.race([settled, timeout])
      pendingResolver = null
      return result
    },
    getState(): UpdaterStateSnapshot {
      return state
    },
  }
}
