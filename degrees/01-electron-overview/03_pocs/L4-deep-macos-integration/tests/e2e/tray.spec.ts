/**
 * BT-L4-1: a Tray exists at boot with the configured initial state.
 * BT-L4-2: tray:set-state -> appGetTrayState reflects the new title within one tick.
 */
import { test, expect } from '@playwright/test'
import { launchApp, getTrayState, setTrayState, type LaunchedApp } from './helpers'

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

test('BT-L4-1: app:ready resolves with exactly one Tray holding a template image and the initial title', async () => {
  launched = await launchApp()
  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // After ready, the IPC reports the initial tray view.
  const view = await getTrayState(win)
  expect(['idle', 'focused', 'break', 'paused']).toContain(view.state)
  // The title must be non-empty and reflect the initial state.
  expect(view.title.length).toBeGreaterThan(0)
  expect(view.hasImage).toBe(true)
  // Default initial state is 'idle'.
  expect(view.state).toBe('idle')
})

test('BT-L4-2: tray:set-state({ state: "focused" }) updates the title within one event-loop tick', async () => {
  launched = await launchApp()
  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const before = await getTrayState(win)
  expect(before.state).toBe('idle')

  const setResult = await setTrayState(win, 'focused')
  expect(setResult.ok).toBe(true)
  expect(setResult.view.state).toBe('focused')

  const after = await getTrayState(win)
  expect(after.state).toBe('focused')
  expect(after.title).not.toBe(before.title)
})
