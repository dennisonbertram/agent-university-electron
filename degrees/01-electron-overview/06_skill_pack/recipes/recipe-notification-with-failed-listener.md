# Recipe — Notification with failed Listener

**Use when**: Showing any system notification.

## Code

```typescript
// src/notifications.ts
import { Notification } from 'electron'
import { randomUUID } from 'node:crypto'

interface ShowArgs {
  title: string
  body: string
  logger: Logger
}
interface ShowResult {
  ok: boolean
  id: string
  error?: string
}

export function showNotification(args: ShowArgs): Promise<ShowResult> {
  const id = randomUUID()
  const n = new Notification({ title: args.title, body: args.body })

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: ShowResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    // CRITICAL: failed listener BEFORE show()
    // On unsigned dev macOS, failed is the only observable
    n.on('failed', (_event, error) => {
      const msg = typeof error === 'string' ? error : String(error)
      args.logger.warn('notification:failed', { id, error: msg })
      finish({ ok: false, id, error: msg })
    })
    n.on('show', () => {
      args.logger.info('notification:shown', { id })
      finish({ ok: true, id })
    })
    n.on('click', () => args.logger.info('notification:click', { id }))
    n.on('close', () => args.logger.info('notification:close', { id }))

    // Safety: resolve after 6s if neither event fires
    setTimeout(() => finish({ ok: false, id, error: 'timeout' }), 6000)

    n.show()
  })
}
```

## Test Pattern

```typescript
it('R-notif-01: failed listener precedes show() in source', () => {
  const src = readFileSync('src/notifications.ts', 'utf8')
  const failedIdx = src.indexOf("n.on('failed'")
  const showIdx = src.indexOf('n.show()')
  expect(failedIdx).toBeGreaterThan(-1)
  expect(failedIdx).toBeLessThan(showIdx)
})
```

## Watch Out For

- Attaching the `failed` listener AFTER `n.show()` is a race condition — the OS can fire `failed` synchronously or immediately after show on some platforms.
- On unsigned dev macOS, `failed` fires with "This app is not authorized to send notifications" — this is expected, not a bug.
- Action buttons (`actions: [...]`) do NOT display on unsigned macOS 12+. Test action handler logic via IPC seam, not real notifications.
- The safety timeout (6s) prevents the Promise from hanging forever if the OS sends neither event. Adjust based on your environment.

Evidence: `../../05_distillation/patterns/P-09-notification-always-attach-failed-listener.md`, `../../05_distillation/gotchas/G-07-notifications-fail-silently-unsigned-macos.md`
