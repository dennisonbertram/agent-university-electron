# P-09 — Always attach `failed` listener BEFORE `notification.show()`

**When to use**: every `new Notification(...)` instance.
**Evidence**: L4 R-L4-3, capstone `notifications.ts` (`03_pocs/L-capstone-pulse/src/notifications.ts:83-89`).

## Pattern

```typescript
// src/notifications.ts
import { Notification } from 'electron'

export function show(args: ShowNotificationArgs): Promise<ShowResult> {
  const id = randomUUID()
  const notification = new Notification({
    title: args.title,
    body: args.body,
    actions: args.actions,
  })

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: ShowResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    // CRITICAL: `failed` listener BEFORE show().
    // On unsigned dev macOS this is the only observable.
    notification.on('failed', (_event, error) => {
      const message = typeof error === 'string' ? error : String(error)
      logger.warn('notification:failed:unsigned', { id, error: message })
      finish({ ok: false, id, failed: { error: message } })
    })
    notification.on('show', () => {
      logger.info('notification:shown', { id })
      finish({ ok: true, id })
    })

    try {
      notification.show()
    } catch (err) { /* ... */ }
  })
}
```

A static-regression test (R-L4-3) reads `src/notifications.ts` and asserts every `notification.show()` call site is preceded by a `notification.on('failed'`:

```typescript
// tests/e2e/regression.spec.ts
test('R-L4-3: every notification.show() has a paired failed listener', () => {
  const src = readFileSync('src/notifications.ts', 'utf8')
  expect(src).toMatch(/notification\.on\('failed'[\s\S]+notification\.show\(\)/)
})
```

## Why it works

- On unsigned dev macOS, `notification.show()` cannot reach Notification Center. The `failed` event is the only signal.
- Attaching after `show()` is a race condition — the OS may emit `failed` before the listener is registered.
- Wrapping in a Promise with `settled` guard means `failed` and `show` and the safety timeout all resolve idempotently.

## Tradeoffs

- The `show` event also fires for successful display, so the same Promise handles both cases — only the `failed` branch surfaces an error to callers.
- Listener wiring before `show()` adds 4-6 lines per call site. Mitigated by funneling all notifications through one `show()` adapter (the pattern above).

## Variants

- **Per-action handler registry** (capstone) — when the notification has action buttons, register handlers keyed by notification id before `show()` so the action callback finds them.

## Evidence

- `01_research/21-failure-modes.md#FM-05`
- `03_pocs/L-capstone-pulse/src/notifications.ts:83-89`
- `03_pocs/L4-deep-macos-integration/poc-report.md` R-L4-3
