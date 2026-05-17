# Example — Capstone: Pulse (Menu-Bar App)

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Purpose

Pulse is the capstone implementation — a full menu-bar app that combines all patterns from L1–L5. It has a tray icon, a frameless popover window, deep link integration, global shortcuts, power-aware behavior, SQLite storage, and full test coverage.

---

## Architecture

```
src/
  main.ts          — boot order: crash → lock → protocol → open-url → whenReady
  window.ts        — createPopoverWindow() frame:false, alwaysOnTop:true
  tray.ts          — module-scope trayInstance, template image, popover toggle
  ipc.ts           — IPC_REGISTRY + TEST_REGISTRY
  preload.ts       — contextBridge API surface
  log.ts           — createLogger(module)
  storage.ts       — atomicWriteJson + readJson
  db.ts            — openDatabase + runMigrations + WAL
  notifications.ts — showNotification() with failed-before-show
  shortcuts.ts     — installShortcuts() + will-quit cleanup
  deep-link.ts     — parseDeepLink() + pre-ready registration
  power.ts         — installPowerMonitor() inside whenReady
  updater.ts       — installUpdater() with forceDevUpdateConfig
  crash.ts         — startCrashReporter() before whenReady
  renderer/
    index.html     — CSP meta tag, no inline script
    renderer.ts    — calls window.api.* ; polls tray state
```

---

## Patterns Demonstrated

| Pattern | File | Recipe |
|---|---|---|
| Pre-ready boot ordering | `src/main.ts` | [../recipes/recipe-crashreporter-pre-ready.md](../recipes/recipe-crashreporter-pre-ready.md) |
| Module-scope Tray | `src/tray.ts` | [../recipes/recipe-tray-with-template-image.md](../recipes/recipe-tray-with-template-image.md) |
| Frameless popover window | `src/window.ts` | [../lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md) |
| IPC registry + test seams | `src/ipc.ts` | [../recipes/recipe-test-seam-ipc-channel.md](../recipes/recipe-test-seam-ipc-channel.md) |
| Atomic JSON storage | `src/storage.ts` | [../recipes/recipe-atomic-json-write.md](../recipes/recipe-atomic-json-write.md) |
| SQLite + safeStorage | `src/db.ts` | [../recipes/recipe-better-sqlite3-with-auto-unpack.md](../recipes/recipe-better-sqlite3-with-auto-unpack.md) |
| Notifications | `src/notifications.ts` | [../recipes/recipe-notification-with-failed-listener.md](../recipes/recipe-notification-with-failed-listener.md) |
| Global shortcut | `src/shortcuts.ts` | [../recipes/recipe-global-shortcut-with-cleanup.md](../recipes/recipe-global-shortcut-with-cleanup.md) |
| Deep links | `src/deep-link.ts` | [../recipes/recipe-deep-link-handler.md](../recipes/recipe-deep-link-handler.md) |
| powerMonitor | `src/power.ts` | [../recipes/recipe-power-monitor-aware-timer.md](../recipes/recipe-power-monitor-aware-timer.md) |
| Auto-update | `src/updater.ts` | [../recipes/recipe-electron-updater-generic-provider.md](../recipes/recipe-electron-updater-generic-provider.md) |
| Forge + fuses + signing | `forge.config.ts` | [../recipes/recipe-forge-config-with-fuses.md](../recipes/recipe-forge-config-with-fuses.md) |
| Playwright test suite | `tests/` | [../recipes/recipe-playwright-electron-launch.md](../recipes/recipe-playwright-electron-launch.md) |

---

## Test Coverage

| Test File | What It Covers |
|---|---|
| `tests/boot.spec.ts` | Boot order: `crash:reporter-started` before `app:ready`, `dock:hidden` before `window:created` |
| `tests/tray.spec.ts` | Tray created, state transitions, `^let trayInstance` static check |
| `tests/ipc.spec.ts` | All production channels + validation failures |
| `tests/shortcuts.spec.ts` | `testFireShortcut` seam, `unregisterAll` in `will-quit` |
| `tests/deep-link.spec.ts` | `testEmitOpenUrl`, `parseDeepLink` unit tests |
| `tests/power.spec.ts` | `testEmitPower` seam, suspend/resume markers |
| `tests/storage.spec.ts` | Atomic save/load, no tmp files |
| `tests/notifications.spec.ts` | Either `shown` or `failed` marker fires |
| `tests/updater.spec.ts` | `update-available` for fixture manifest |
| `tests/security.spec.ts` | Blocked navigation, denied window.open, test channels blocked in production |
| `tests/static.spec.ts` | All 6 fuses, `^let trayInstance`, `crashReporter` before `whenReady`, no sendSync |

---

## Corresponding Lab

[../labs/lab-10-capstone-menu-bar-app.md](../labs/lab-10-capstone-menu-bar-app.md) — build a minimal version of this architecture.

---

## Corresponding Curriculum Phase

Phase 5: All phases combined. See [../curriculum.md](../curriculum.md).

Evidence: `../../../05_distillation/before-you-build/BYB-02-electron-on-macos-deep-integration.md`, `../../../05_distillation/distilled-principles.md`
