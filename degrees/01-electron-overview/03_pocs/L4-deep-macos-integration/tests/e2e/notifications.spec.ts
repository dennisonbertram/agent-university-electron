/**
 * BT-L4-3: a notification with two action buttons in an unsigned dev build
 *          fails (notification.failed fires) and a structured log entry
 *          `notification:failed:unsigned` is written.
 *
 * NOTE: this is the realistic path for unsigned dev builds on macOS. The
 * commented-out `@signed-only` case documents the assertion shape for a
 * signed build where the notification would actually display.
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForEvent, type LaunchedApp } from './helpers'

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

test('BT-L4-3: notification with two buttons fires `failed` in unsigned dev build', async () => {
  launched = await launchApp()
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const result = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { notificationShow: (v: unknown) => Promise<{ ok: boolean; id: string; failed?: { error: string } }> }
    }).api.notificationShow({
      title: 'Focus Session Complete',
      body: 'You completed a 25-minute focus session.',
      actions: [
        { type: 'button', text: 'Reply' },
        { type: 'button', text: 'Dismiss' },
      ],
    })
  })) as { ok: boolean; id: string; failed?: { error: string } }

  expect(typeof result.id).toBe('string')
  expect(result.id.length).toBeGreaterThan(0)
  // On unsigned macOS dev builds the OS rejects the notification; the test
  // accepts EITHER the synchronous failure result OR the structured log entry
  // (whichever path the platform takes). On other platforms Notification.show
  // may actually display; we still require the show:served log entry.
  if (process.platform === 'darwin') {
    expect(result.ok).toBe(false)
    expect(result.failed?.error.length ?? 0).toBeGreaterThan(0)
    await waitForEvent(logFile, 'notification:failed:unsigned')
  } else {
    // Other platforms — assert the log shows a `notification:show:served`
    // entry. We still wait for SOMETHING from the notification subsystem.
    await waitForEvent(logFile, 'ipc:notification:show:served')
  }
})

// test.fixme: BT-L4-3 (signed) — in a signed build the same call should
// resolve with { ok: true } and emit `notification:shown`. Re-enable when
// the L5 packaging + signing pipeline is wired.
