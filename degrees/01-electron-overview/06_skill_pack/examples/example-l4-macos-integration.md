# Example — L4: macOS Integration

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Purpose

The L4 implementation covers the full spectrum of macOS system integration: tray icon, notifications, global shortcuts, deep links, powerMonitor events, Touch ID, auto-launch, and dock control.

---

## Patterns Demonstrated

| Pattern | File | Recipe |
|---|---|---|
| Module-scope Tray | `src/tray.ts` | [../recipes/recipe-tray-with-template-image.md](../recipes/recipe-tray-with-template-image.md) |
| Notification with failed-before-show | `src/notifications.ts` | [../recipes/recipe-notification-with-failed-listener.md](../recipes/recipe-notification-with-failed-listener.md) |
| Global shortcut + will-quit cleanup | `src/shortcuts.ts` | [../recipes/recipe-global-shortcut-with-cleanup.md](../recipes/recipe-global-shortcut-with-cleanup.md) |
| Deep link router + test seam | `src/deep-link.ts` | [../recipes/recipe-deep-link-handler.md](../recipes/recipe-deep-link-handler.md) |
| powerMonitor with test seam | `src/power.ts` | [../recipes/recipe-power-monitor-aware-timer.md](../recipes/recipe-power-monitor-aware-timer.md) |
| Touch ID with env-flag seams | `src/biometric.ts` | [../recipes/recipe-touch-id-with-fallback.md](../recipes/recipe-touch-id-with-fallback.md) |
| Dock hide before first window | `src/main.ts` | [../recipes/recipe-app-dock-hide-menu-bar-only.md](../recipes/recipe-app-dock-hide-menu-bar-only.md) |
| Auto-launch test contract | `src/autolaunch.ts` | [../lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md) |

---

## Source File Map

| File | Description |
|---|---|
| `src/tray.ts` | `let trayInstance: Tray \| null` at module scope; `installTray()`, `destroyTray()` |
| `src/notifications.ts` | `showNotification()` Promise with failed/show/timeout |
| `src/shortcuts.ts` | `installShortcuts()`, handlers Map, `fireForTest()`, `will-quit` cleanup |
| `src/deep-link.ts` | `parseDeepLink()`, pre-ready registration, `open-url`/`second-instance` |
| `src/power.ts` | `installPowerMonitor()` inside `whenReady`, `fireForTest()` |
| `src/biometric.ts` | `BiometricService` with `TOUCH_ID_UNAVAILABLE` / `TOUCH_ID_FORCE_AVAILABLE` |
| `src/autolaunch.ts` | `setLoginItemSettings`; tests assert request-side only |
| `tests/tray.spec.ts` | Static + E2E: `^let trayInstance`, state transitions |
| `tests/notifications.spec.ts` | E2E: either `notification:shown` or `notification:failed` |
| `tests/shortcuts.spec.ts` | E2E: `testFireShortcut` seam, `will-quit` cleanup |
| `tests/deep-link.spec.ts` | E2E: `testEmitOpenUrl`, unit tests for `parseDeepLink` boundaries |
| `tests/power.spec.ts` | E2E: `testEmitPower('suspend')`, marker assertion |
| `tests/biometric.spec.ts` | E2E: `TOUCH_ID_UNAVAILABLE=1` and `TOUCH_ID_FORCE_AVAILABLE=1` |

---

## Key Learning Points

1. **Tray GC**: V8 collects function-local `Tray` objects within seconds. Module-scope is mandatory.
2. **Notification silence**: On unsigned apps, `failed` fires silently. Attach before `show()`. Tests must accept either outcome.
3. **`globalShortcut.register()` returns false**: No exception on conflict. Always check the return value.
4. **`open-url` timing**: Must register before `app.whenReady()` for cold-start deep link delivery.
5. **packaging required for deep links**: `setAsDefaultProtocolClient` alone doesn't work in development on macOS — the OS needs a real `.app` bundle registered with Launch Services.
6. **powerMonitor inside whenReady**: Accessing `powerMonitor` before `app.whenReady()` throws `ERR_NO_APP`.

---

## Corresponding Labs

- [../labs/lab-04-tray-with-state.md](../labs/lab-04-tray-with-state.md)
- [../labs/lab-05-notification-with-failed-listener.md](../labs/lab-05-notification-with-failed-listener.md)
- [../labs/lab-06-global-shortcut.md](../labs/lab-06-global-shortcut.md)
- [../labs/lab-07-deep-link-router.md](../labs/lab-07-deep-link-router.md)

---

## Corresponding Lesson

- [../lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md)

Evidence: `../../../05_distillation/before-you-build/BYB-02-electron-on-macos-deep-integration.md`, `../../../05_distillation/patterns/P-05-module-scoped-tray-instance.md`, `../../../05_distillation/patterns/P-09-notification-always-attach-failed-listener.md`, `../../../05_distillation/patterns/P-10-globalshortcut-register-and-will-quit-unregister.md`, `../../../05_distillation/patterns/P-11-deep-link-router-via-protocol-and-second-instance.md`
