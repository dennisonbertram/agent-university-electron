/**
 * electron-updater wiring (RED stub).
 *
 * The real (GREEN) implementation will:
 *   - Configure `autoUpdater.autoDownload = false` (L5 only tests "check",
 *     not "download/install").
 *   - Wire `provider: 'generic'` with a URL from `process.env.UPDATE_URL`
 *     (the local-fixture pattern; R-L5-3 enforces this provider).
 *   - Emit structured log events for every state transition:
 *       updater:configured, updater:checking, updater:update-available:<v>,
 *       updater:update-not-available, updater:update-downloaded:<v>,
 *       updater:error:<msg>.
 *   - Expose a programmatic `checkForUpdates()` for the IPC test seam
 *     (BT-L5-6, BT-L5-7).
 *
 * This stub throws so the RED commit observably fails the GREEN behavioral
 * tests. The IPC `test:check-for-updates` channel is registered in `ipc.ts`
 * but the underlying service is missing — calls will reject with the message
 * below, which is what the failing-test trace surfaces.
 */
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

export function installUpdater(_opts: InstallUpdaterOptions): UpdaterService {
  throw new Error(
    'installUpdater: not implemented (RED). The GREEN commit replaces this stub with the real electron-updater wiring (provider:generic, autoDownload:false, structured logs).',
  )
}
