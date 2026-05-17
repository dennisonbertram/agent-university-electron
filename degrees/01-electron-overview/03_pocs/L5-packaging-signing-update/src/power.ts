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
 */
import { powerMonitor } from 'electron'
import type { Logger } from './log'
import type { TrayController, TrayState } from './tray'

export interface InstallPowerServiceOptions {
  readonly logger: Logger
  readonly tray: TrayController
}

export type PowerEventName =
  | 'suspend'
  | 'resume'
  | 'lock-screen'
  | 'unlock-screen'
  | 'on-ac'
  | 'on-battery'

export interface PowerService {
  fireForTest(event: PowerEventName): void
  getPreviousState(): TrayState | null
}

export function installPowerService(opts: InstallPowerServiceOptions): PowerService {
  const { logger, tray } = opts
  let previousState: TrayState | null = null

  const handleSuspend = (): void => {
    const before = tray.getState().state
    if (before !== 'paused') {
      previousState = before
    }
    tray.setState('paused')
    logger.info('power:suspend', { previousState: before })
  }

  const handleResume = (): void => {
    const restoreTo = previousState ?? 'idle'
    tray.setState(restoreTo)
    logger.info('power:resume', { restoredTo: restoreTo })
    previousState = null
  }

  const handleLockScreen = (): void => {
    logger.info('power:lock-screen', {})
  }
  const handleUnlockScreen = (): void => {
    logger.info('power:unlock-screen', {})
  }
  const handleOnAC = (): void => {
    logger.info('power:on-ac', {})
  }
  const handleOnBattery = (): void => {
    logger.info('power:on-battery', {})
  }

  try {
    powerMonitor.on('suspend', handleSuspend)
    powerMonitor.on('resume', handleResume)
    powerMonitor.on('lock-screen', handleLockScreen)
    powerMonitor.on('unlock-screen', handleUnlockScreen)
    powerMonitor.on('on-ac', handleOnAC)
    powerMonitor.on('on-battery', handleOnBattery)
    logger.info('power:subscribed', {
      events: ['suspend', 'resume', 'lock-screen', 'unlock-screen', 'on-ac', 'on-battery'],
    })
  } catch (err) {
    logger.error('power:subscribe:failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  }

  return {
    fireForTest(event: PowerEventName): void {
      try {
        // Cast through `unknown` because `EventEmitter.emit` is typed as
        // `(eventName: string | symbol, ...args: any[]) => boolean` but the
        // strict types on `powerMonitor` only accept the documented names.
        ;(powerMonitor as unknown as { emit(name: string): boolean }).emit(event)
      } catch (err) {
        logger.error('power:fire-for-test:threw', {
          event,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    },
    getPreviousState(): TrayState | null {
      return previousState
    },
  }
}
