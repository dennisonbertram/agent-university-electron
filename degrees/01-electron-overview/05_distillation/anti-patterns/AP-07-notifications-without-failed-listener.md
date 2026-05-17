# AP-07 — Calling `notification.show()` without a `failed` listener

**Severity**: high (silent failures in production)
**Surface**: Notifications.

## What this looks like

```typescript
// WRONG
const notification = new Notification({ title: 'Done', body: 'Task complete' })
notification.show()
// no failed listener — if the OS rejects, you have no signal
```

## Why this is wrong

- On unsigned dev macOS — and on signed builds that hit Focus / DND filters, or that lack notification permission — `show()` is rejected silently at the OS layer.
- The `show` event does NOT fire on rejection. The `failed` event is the only observable.
- Without a `failed` listener, you cannot tell whether the user saw your notification or not. Telemetry shows `show()` was called; users complain they got nothing.

## Better approach

Always wire `failed` BEFORE `show()`:

```typescript
const notification = new Notification({ title: 'Done', body: 'Task complete' })

notification.on('failed', (_event, error) => {
  logger.warn('notification:failed', { error: String(error) })
  // fallback: in-app banner, or surface to user
})
notification.on('show', () => {
  logger.info('notification:shown', {})
})
notification.show()
```

(See P-09 for the full Promise-wrapped pattern.)

## Test / lint that catches it

Static-source regression check (R-L4-3): every `notification.show()` call site in the file must be preceded by a `notification.on('failed'`:

```typescript
test('R-L4-3: notification.show() has paired failed listener', () => {
  const src = readFileSync('src/notifications.ts', 'utf8')
  expect(src).toMatch(/notification\.on\('failed'[\s\S]+notification\.show\(\)/)
})
```

## Evidence

- `01_research/21-failure-modes.md#FM-05`
- `03_pocs/L-capstone-pulse/src/notifications.ts:83-89`
- `03_pocs/L4-deep-macos-integration/poc-report.md` R-L4-3
