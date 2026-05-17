# PB-05 — Debugging a Notification that doesn't display

**Symptom**: `notification.show()` is called. Nothing appears in Notification Center. No banner.

## Decision tree

1. **Did you attach a `failed` listener?** If not, you have no signal whether the OS rejected the notification. Wire it BEFORE `show()`:
   ```typescript
   notification.on('failed', (_event, error) => {
     console.warn('[notification] failed:', error)
   })
   notification.show()
   ```

2. **Run with the `failed` listener.** If `failed` fires with `"This app is not authorized to send notifications."` or similar, the OS rejected the show. Most common causes:
   - **App is unsigned.** macOS requires signing for Notification Center registration. Sign with `codesign --sign - app.app` (ad-hoc) for partial dev coverage; sign with Developer ID for production.
   - **User denied permission.** Check System Settings → Notifications → <App>.
   - **DND / Focus mode is filtering the app.**

3. **Did `show` fire but no banner appeared?** Then the OS accepted the show but suppressed display:
   - Notification Center is full / batched. Open Notification Center to check.
   - The user has set the app to "Banners off" in System Settings.

4. **Test the path with a signed build.** If `failed` does NOT fire on signed dev (ad-hoc-signed) but DOES on raw unsigned, you've identified signing as the gate.

5. **For action buttons**: macOS 12+ requires a signed build for action buttons to display. Use the IPC test seam (`test:trigger-notification-action`) to verify the action handler logic without OS display.

## Diagnostic snippets

```typescript
// Verbose listener — wire all events to log
const notification = new Notification({ title, body })
notification.on('show', () => log.info('notif:shown'))
notification.on('failed', (_e, err) => log.warn('notif:failed', { err }))
notification.on('click', () => log.info('notif:click'))
notification.on('close', () => log.info('notif:close'))
notification.on('action', (_e, idx) => log.info('notif:action', { idx }))
notification.show()
```

```bash
# Check macOS notification settings for your bundle:
defaults read com.apple.ncprefs | grep -A 5 "<your-bundle-id>"
```

## Evidence

- `01_research/21-failure-modes.md#FM-05`
- `01_research/08-notifications.md`
- `03_pocs/L-capstone-pulse/src/notifications.ts`
- `03_pocs/L4-deep-macos-integration/poc-report.md` BT-L4-3 row
- `01_research/23-open-questions.md#OQ-01`, `#OQ-08` (signed-only, Focus suppression)
