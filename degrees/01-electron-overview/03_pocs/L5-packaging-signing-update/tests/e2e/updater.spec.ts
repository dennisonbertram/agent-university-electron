/**
 * Updater behavioral tests — BT-L5-6, BT-L5-7.
 *
 * These run AGAINST the dev build (not the packaged app). electron-updater
 * has a `forceDevUpdateConfig = true` mode and a configurable `setFeedURL`
 * that lets us drive the check from a test seam, against a local fixture
 * HTTP server, without packaging.
 *
 * BT-L5-6 — newer-version manifest → fires `update-available` and logs
 *           `updater:update-available:<version>`.
 * BT-L5-7 — same-version manifest → fires `update-not-available` and logs
 *           `updater:update-not-available`.
 */
import { test, expect } from '@playwright/test'
import {
  launchApp,
  startUpdateServer,
  waitForEvent,
  findEvents,
  callCheckForUpdates,
} from './helpers'

test.describe.serial('L5 — updater (provider:generic) against local fixture', () => {
  test('BT-L5-6: newer manifest version → update-available event + log', async () => {
    const server = await startUpdateServer({ manifestFile: 'latest-mac.yml.update' })
    const launched = await launchApp({
      extraEnv: {
        UPDATE_URL: server.url,
      },
    })
    try {
      const win = await launched.app.firstWindow()
      // Wait for the renderer to be ready and the updater to be installed.
      await waitForEvent(launched.logFile, 'app:install-complete', 15_000)

      const snapshot = await callCheckForUpdates(win)
      // Updater may resolve `update-available` directly in the IPC return,
      // but the load-bearing assertion is the log entry — that's what
      // captures the lifecycle transition the way operators read it.
      const events = findEvents(launched.logFile, 'updater:update-available')
      if (events.length === 0) {
        // give the async event a moment to land
        await waitForEvent(launched.logFile, 'updater:update-available', 10_000)
      }
      const finalEvents = findEvents(launched.logFile, 'updater:update-available')
      expect(finalEvents.length).toBeGreaterThan(0)
      const payload = finalEvents[finalEvents.length - 1]?.payload ?? {}
      expect(payload.version, 'log payload should carry version').toBeDefined()
      // The snapshot may already reflect the available update, OR may still
      // be in checking-for-update — both are acceptable since the log is
      // the SoT here. We only assert the snapshot's `provider` is generic
      // and the `feedUrl` matches the server.
      expect(snapshot.provider).toBe('generic')
      expect(snapshot.feedUrl).toBe(server.url)
    } finally {
      await launched.app.close().catch(() => undefined)
      await server.close()
    }
  })

  test('BT-L5-7: same manifest version → update-not-available event + log', async () => {
    const server = await startUpdateServer({ manifestFile: 'latest-mac.yml.current' })
    const launched = await launchApp({
      extraEnv: {
        UPDATE_URL: server.url,
      },
    })
    try {
      const win = await launched.app.firstWindow()
      await waitForEvent(launched.logFile, 'app:install-complete', 15_000)
      await callCheckForUpdates(win)
      await waitForEvent(launched.logFile, 'updater:update-not-available', 15_000)
      const events = findEvents(launched.logFile, 'updater:update-not-available')
      expect(events.length).toBeGreaterThan(0)
      // Negative — no update-available log should have fired during this
      // session.
      const wrongEvents = findEvents(launched.logFile, 'updater:update-available')
      expect(wrongEvents.length).toBe(0)
    } finally {
      await launched.app.close().catch(() => undefined)
      await server.close()
    }
  })
})
