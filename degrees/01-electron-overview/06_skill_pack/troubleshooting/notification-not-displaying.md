# Troubleshooting — macOS Notification Not Displaying

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Symptom

`new Notification({ title: '...' }).show()` is called but:
- No notification appears in the macOS notification center
- No error is thrown
- No `failed` event fires (if you didn't attach a listener)

Or: The notification fires in development but not in a packaged build.

---

## Root Cause Summary

macOS notifications require the app to be **signed** to display reliably. On unsigned apps, the notification may silently fail. The `failed` event is the only observable signal — but only if you attach the listener BEFORE calling `.show()`.

---

## Cause → Diagnostic → Fix

### Cause 1: `failed` listener not attached before `.show()`

If you call `notification.show()` before attaching `notification.on('failed', ...)`, the `failed` event may fire synchronously during `show()` and you miss it.

**Diagnostic**

```bash
grep -n 'notification.show\|notification.on' src/notifications.ts
# The 'failed' listener line must have a LOWER line number than 'show()'
```

**Fix**

```typescript
export function showNotification(title: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const notification = new Notification({ title, body })

    // CRITICAL: attach BEFORE show()
    notification.on('failed', (_e, err) => {
      logger.error({ event: 'notification:failed', err })
      reject(new Error(err))
    })

    notification.on('show', () => {
      logger.info({ event: 'notification:shown' })
      resolve()
    })

    notification.show()   // fired AFTER listeners attached
  })
}
```

---

### Cause 2: App is not code-signed (most common on macOS 10.14+)

**Diagnostic**

```bash
codesign --verify --deep --strict MyApp.app
# If this fails or the app is run from out/ without signing, notifications may not work
```

In development mode (`npm start`), the Electron binary is used directly. macOS may refuse to show notifications for unsigned executables.

**Fix (short-term for dev)**

Grant notification permission manually:
1. Open System Settings → Notifications
2. Find "Electron" (or your app name) and enable notifications

**Fix (long-term for production)**

Sign the app with a Developer ID certificate. See [../lessons/09-code-signing-and-notarization.md](../lessons/09-code-signing-and-notarization.md).

---

### Cause 3: `Notification.isSupported()` returns false

Some headless/CI environments don't support notifications.

**Diagnostic**

```typescript
console.log(Notification.isSupported())  // must be true
```

**Fix**

Guard all notification calls:
```typescript
if (!Notification.isSupported()) {
  logger.warn({ event: 'notification:not-supported' })
  return
}
```

---

### Cause 4: Notification fires but permission denied in System Settings

The app may not have notification permission. This appears as a silent failure or a `failed` event with a permission error.

**Diagnostic**

Check macOS System Settings → Notifications → find your app name. If "Allow Notifications" is off, notifications are silently dropped.

**Fix**

This requires user action. Design for the failure case — always attach the `failed` listener and log it. Do not assume notifications will work.

---

### Cause 5: Safety timeout missing — Promise never settles

If both `show` and `failed` events are unreliable, the Promise returned by `showNotification()` hangs forever, blocking any `await` caller.

**Fix**

Add a safety timeout:
```typescript
const timeoutId = setTimeout(() => {
  logger.warn({ event: 'notification:timeout', title })
  resolve()  // settle with success after timeout — notification may have shown
}, 5000)

notification.on('show', () => {
  clearTimeout(timeoutId)
  logger.info({ event: 'notification:shown' })
  resolve()
})

notification.on('failed', (_e, err) => {
  clearTimeout(timeoutId)
  logger.error({ event: 'notification:failed', err })
  reject(new Error(err))
})
```

---

## Test Strategy

Since notifications are OS-gated, tests should accept EITHER outcome:

```typescript
test('BT-notif-01: notification either shows or fails with log marker', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() => (window as any).api.triggerNotification('Test', 'Body'))
    await expect.poll(() => {
      const lines = readLogLines()
      return lines.some(l => l.event === 'notification:shown' || l.event === 'notification:failed')
    }, { timeout: 6000 }).toBe(true)
  } finally { await app.close() }
})
```

---

## Related

- [../lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md) — Notifications section
- [../recipes/recipe-notification-with-failed-listener.md](../recipes/recipe-notification-with-failed-listener.md) — complete implementation
- [../labs/lab-05-notification-with-failed-listener.md](../labs/lab-05-notification-with-failed-listener.md) — hands-on exercise
- [../checklists/deep-macos-integration-checklist.md](../checklists/deep-macos-integration-checklist.md) — items 9–12

Evidence: `../../../05_distillation/playbooks/PB-05-debugging-notification-not-displaying.md`, `../../../05_distillation/patterns/P-09-notification-always-attach-failed-listener.md`
