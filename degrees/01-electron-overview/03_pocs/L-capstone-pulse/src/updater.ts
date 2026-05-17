/**
 * electron-updater wiring — carry-forward from L5 (Entry 7 + 9 still apply:
 * strip the query string before path matching on the update server side;
 * `forceDevUpdateConfig = true` is required for unpackaged checks).
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

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

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
    state = { ...state, lastEvent, ...overrides }
  }

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
    percent?: number; bytesPerSecond?: number; transferred?: number; total?: number
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
      const settled = new Promise<UpdaterStateSnapshot>((resolve) => {
        pendingResolver = resolve
      })
      try {
        await autoUpdater.checkForUpdates()
      } catch (err) {
        logger.warn('updater:check-call-rejected', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
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
