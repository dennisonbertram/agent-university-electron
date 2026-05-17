/**
 * powerMonitor service for L4.
 *
 * Subscribes to `suspend`, `resume`, `lock-screen`, `unlock-screen`,
 * `on-ac`, `on-battery`. On `suspend`, marks the tray state `paused` and
 * remembers the previous state. On `resume`, restores it.
 *
 * Test seam (BT-L4-5): a `fireForTest(event)` method calls
 * `powerMonitor.emit(event)` so the e2e harness can drive the simulation
 * without putting the laptop to sleep (REF-06).
 *
 * RED commit: stub throws so BT-L4-5 fails.
 */
import { powerMonitor } from 'electron'
import type { Logger } from './log'
import type { TrayController, TrayState } from './tray'

export interface InstallPowerServiceOptions {
  readonly logger: Logger
  readonly tray: TrayController
}

export interface PowerService {
  fireForTest(event: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen' | 'on-ac' | 'on-battery'): void
  /** Snapshot of the state we'll restore on resume. */
  getPreviousState(): TrayState | null
}

export function installPowerService(_opts: InstallPowerServiceOptions): PowerService {
  // Reference the import to keep the dependency surface visible during RED.
  void powerMonitor
  throw new Error('installPowerService: not implemented (RED)')
}
