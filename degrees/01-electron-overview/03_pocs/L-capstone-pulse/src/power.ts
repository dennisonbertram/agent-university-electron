/**
 * powerMonitor service for Pulse.
 *
 * Differences vs L5:
 *   - On `suspend`, the focus engine is notified (it transitions
 *     `focus -> paused` and records the suspend timestamp for accurate
 *     elapsed-time accounting on resume — BT-C-2).
 *   - The tray controller is no longer the source of paused-state truth;
 *     the focus engine drives the tray indirectly (the state-change event
 *     emitted by the engine updates the tray via main's wiring).
 */
import { powerMonitor } from 'electron'
import type { Logger } from './log'
import type { FocusEngine } from './focus-engine'

export interface InstallPowerServiceOptions {
  readonly logger: Logger
  readonly engine: FocusEngine | null
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
}

export function installPowerService(opts: InstallPowerServiceOptions): PowerService {
  const { logger, engine } = opts

  const handleSuspend = (): void => {
    logger.info('power:suspend', {})
    if (engine) {
      try {
        engine.sleep()
        logger.info('focus:paused:sleep', {})
      } catch (err) {
        logger.error('focus:paused:sleep:threw', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  const handleResume = (): void => {
    logger.info('power:resume', {})
    if (engine) {
      try {
        engine.wake()
        logger.info('focus:resumed:after-sleep', {})
      } catch (err) {
        logger.error('focus:resumed:after-sleep:threw', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  const handleLockScreen = (): void => { logger.info('power:lock-screen', {}) }
  const handleUnlockScreen = (): void => { logger.info('power:unlock-screen', {}) }
  const handleOnAC = (): void => { logger.info('power:on-ac', {}) }
  const handleOnBattery = (): void => { logger.info('power:on-battery', {}) }

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
        ;(powerMonitor as unknown as { emit(name: string): boolean }).emit(event)
      } catch (err) {
        logger.error('power:fire-for-test:threw', {
          event,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    },
  }
}
