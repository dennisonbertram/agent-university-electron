# Lab 05 — Notification with failed Listener

**Goal**: Implement a notification sender that always attaches the `failed` listener before `.show()`.

**Prerequisites**: [lab-04-tray-with-state.md](./lab-04-tray-with-state.md), [lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md)

**Duration**: ~20 minutes

**POC Reference**: [examples/example-l4-macos-integration.md](../examples/example-l4-macos-integration.md)

## Goal

By the end, you should have:
- `src/notifications.ts` that wires `failed` before `show()`
- Log markers for `notification:shown` and `notification:failed`
- A Playwright test that drives a notification and asserts on log output
- A static regression test verifying `failed` comes before `show()` in source

## Steps

### 1. Create src/notifications.ts

See [recipes/recipe-notification-with-failed-listener.md](../recipes/recipe-notification-with-failed-listener.md):

```typescript
import { Notification } from 'electron'
import { randomUUID } from 'node:crypto'

export function showNotification(
  opts: { title: string; body: string; logger: Logger }
): Promise<{ ok: boolean; id: string }> {
  const id = randomUUID()
  const n = new Notification({ title: opts.title, body: opts.body })

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: { ok: boolean; id: string }) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    // CRITICAL: failed BEFORE show() — on unsigned macOS this is the only signal
    n.on('failed', (_event, error) => {
      opts.logger.warn('notification:failed', { id, error: String(error) })
      finish({ ok: false, id })
    })
    n.on('show', () => {
      opts.logger.info('notification:shown', { id })
      finish({ ok: true, id })
    })

    // Safety timeout — in case neither event fires
    setTimeout(() => finish({ ok: false, id }), 5000)

    n.show()
  })
}
```

### 2. Add notification IPC channel

```typescript
{
  channel: 'notification:show',
  validate: (arg) => {
    if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
    const a = arg as any
    if (typeof a.title !== 'string') throw new IpcValidationError('title must be string')
    if (typeof a.body !== 'string') throw new IpcValidationError('body must be string')
    return { title: a.title as string, body: a.body as string }
  },
  handler: async ({ title, body }, ctx) => {
    const result = await ctx.notifications.show({ title, body, logger: ctx.logger })
    return result
  },
}
```

### 3. Static regression test

```typescript
it('R-notif-01: failed listener precedes show() in notifications.ts', () => {
  const src = readFileSync('src/notifications.ts', 'utf8')
  const failedIdx = src.indexOf("n.on('failed'")
  const showIdx = src.indexOf('n.show()')
  expect(failedIdx).toBeGreaterThanOrEqual(0)
  expect(showIdx).toBeGreaterThanOrEqual(0)
  expect(failedIdx).toBeLessThan(showIdx)
})
```

### 4. Playwright test

On unsigned dev macOS, the notification will fail. The test verifies the `failed` path works:

```typescript
test('BT-notif-01: notification show logs a marker (failed or shown)', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() =>
      (window as any).api.showNotification({
        title: 'Test', body: 'Lab 05 test notification'
      })
    )
    await expect.poll(
      () => {
        const lines = readLogLines()
        return lines.some(l =>
          l.event === 'notification:shown' || l.event === 'notification:failed'
        )
      },
      { timeout: 8000 }  // notifications can be slow
    ).toBe(true)
  } finally { await app.close() }
})
```

The test accepts either `shown` or `failed` — on unsigned dev, `failed` is expected. The important assertion is that the app didn't crash and a log marker was emitted.

## Verify

- Static regression test passes (failed index < show index in source)
- Playwright test receives either `notification:shown` or `notification:failed` within 8 seconds
- On an unsigned build: `notification:failed` with an authorization error
- On a signed build: `notification:shown`

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Neither event fires | Race: `failed` attached after `show()` | Check ordering in source |
| Test times out waiting for marker | Safety timeout (5s) too short | Increase to 8s in test poll |
| `notification:failed` fires even after signing | User denied notification permission | Check System Settings → Notifications |

See [troubleshooting/notification-not-displaying.md](../troubleshooting/notification-not-displaying.md).

Evidence: [recipes/recipe-notification-with-failed-listener.md](../recipes/recipe-notification-with-failed-listener.md), `../../05_distillation/patterns/P-09-notification-always-attach-failed-listener.md`
