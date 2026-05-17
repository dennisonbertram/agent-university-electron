/**
 * BT-L4-5: powerMonitor.suspend pauses the app and `power:suspend` is logged.
 *          On resume, the previous state is restored and `power:resume` is
 *          logged.
 */
import { test, expect } from '@playwright/test'
import {
  launchApp,
  waitForEvent,
  getTrayState,
  setTrayState,
  simulatePowerEvent,
  type LaunchedApp,
} from './helpers'

let launched: LaunchedApp | null = null

test.afterEach(async () => {
  if (launched) {
    try {
      await launched.app.close()
    } catch {
      // best-effort
    }
    launched = null
  }
})

test('BT-L4-5: powerMonitor.suspend → tray paused; resume restores state', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // Put the app into 'focused' so we can prove resume restores non-default.
  await setTrayState(win, 'focused')
  expect((await getTrayState(win)).state).toBe('focused')

  await simulatePowerEvent(win, 'suspend')
  await waitForEvent(logFile, 'power:suspend')

  const afterSuspend = await getTrayState(win)
  expect(afterSuspend.state).toBe('paused')

  await simulatePowerEvent(win, 'resume')
  await waitForEvent(logFile, 'power:resume')

  const afterResume = await getTrayState(win)
  expect(afterResume.state).toBe('focused')
})
