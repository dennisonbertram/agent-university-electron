# G-07 — `new Notification(...)` fails silently on unsigned dev macOS

**Severity**: medium
**Surface**: Notifications
**Discovered in**: L4 BT-L4-3 design (`03_pocs/L4-deep-macos-integration/poc-report.md` BT-L4-3 row)

## Symptom

`notification.show()` is called. The `show` event does NOT fire. The notification never appears in Notification Center. If a `failed` listener is attached, it fires with `error: 'This app is not authorized to send notifications.'` or similar OS-supplied string.

## Root cause

macOS requires code signing for notification entitlement. Unsigned dev binaries — including binaries launched via `electron .` — cannot register with `UNUserNotificationCenter` and every show is rejected at the OS layer.

## Fix

1. **Always attach a `failed` listener BEFORE calling `show()`**. Without it, you have no signal that the notify was rejected:
   ```typescript
   notification.on('failed', (_event, error) => {
     logger.warn('notification:failed:unsigned', { error })
   })
   notification.on('show', () => { /* ... */ })
   notification.show()
   ```
2. **For local dev verification**, ad-hoc-sign with `codesign --sign - app.app` — partially works for some surfaces.
3. **For production**, sign with a Developer ID Application cert; notifications then work fully.
4. **For Playwright tests**, drive the notification's action handler via a test IPC seam (`test:trigger-notification-action`) instead of asserting OS display.

## Test that catches a regression

Static-source check (R-L4-3): every call site of `notification.show()` must be preceded by a `notification.on('failed', ...)` registration in the same module. The capstone implements this in `src/notifications.ts`.

## Evidence

- `01_research/21-failure-modes.md#FM-05`
- `01_research/08-notifications.md`
- `03_pocs/L-capstone-pulse/src/notifications.ts:83-89`
- `03_pocs/L4-deep-macos-integration/poc-report.md` §"Honest reporting" BT-L4-3 row
