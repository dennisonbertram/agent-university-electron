# Curriculum — Recommended Reading Order

For an agent learning Electron from this skill pack. Read in order; each lesson depends on the previous.

## Phase 1 — Foundation (read before writing any code)

1. [quickstart.md](./quickstart.md) — get something on screen immediately
2. [lessons/01-three-process-model.md](./lessons/01-three-process-model.md) — the mental model everything else depends on
3. [lessons/02-secure-renderer-defaults.md](./lessons/02-secure-renderer-defaults.md) — non-negotiable security baseline
4. [lessons/03-ipc-patterns-and-validation.md](./lessons/03-ipc-patterns-and-validation.md) — the only correct way to communicate across process boundaries
5. [lessons/07-app-lifecycle-and-single-instance.md](./lessons/07-app-lifecycle-and-single-instance.md) — pre-ready boot ordering (mis-ordering silently breaks deep links, crash capture, and single-instance)

## Phase 2 — Storage and Native Modules

6. [lessons/04-storage-and-encryption.md](./lessons/04-storage-and-encryption.md) — atomic writes, safeStorage, SQLite
7. [lessons/05-native-modules-and-rebuild.md](./lessons/05-native-modules-and-rebuild.md) — ABI mismatch, electron-rebuild, two-ABI problem

## Phase 3 — macOS System Integration

8. [lessons/06-macos-system-integration.md](./lessons/06-macos-system-integration.md) — tray, notifications, shortcuts, powerMonitor, deep links, dock, autolaunch, theme

## Phase 4 — Packaging and Distribution

9. [lessons/08-packaging-with-electron-forge.md](./lessons/08-packaging-with-electron-forge.md) — forge.config.ts, asar, ignore lists, fuses
10. [lessons/09-code-signing-and-notarization.md](./lessons/09-code-signing-and-notarization.md) — entitlements, hardened runtime, notarytool
11. [lessons/10-auto-update.md](./lessons/10-auto-update.md) — electron-updater, generic provider, local fixture server

## Phase 5 — Observability and Testing

12. [lessons/11-crash-reporting-and-observability.md](./lessons/11-crash-reporting-and-observability.md) — crashReporter, structured logging
13. [lessons/12-testing-electron-apps.md](./lessons/12-testing-electron-apps.md) — Playwright + Vitest, test seams, log-driven assertions

## Labs (hands-on practice — do these alongside the lessons)

- [labs/lab-01-hello-electron.md](./labs/lab-01-hello-electron.md) — after lesson 1-2
- [labs/lab-02-secure-ipc-roundtrip.md](./labs/lab-02-secure-ipc-roundtrip.md) — after lesson 3
- [labs/lab-03-atomic-storage.md](./labs/lab-03-atomic-storage.md) — after lesson 4
- [labs/lab-04-tray-with-state.md](./labs/lab-04-tray-with-state.md) — after lesson 6
- [labs/lab-05-notification-with-failed-listener.md](./labs/lab-05-notification-with-failed-listener.md) — after lesson 6
- [labs/lab-06-global-shortcut.md](./labs/lab-06-global-shortcut.md) — after lesson 6
- [labs/lab-07-deep-link-router.md](./labs/lab-07-deep-link-router.md) — after lesson 6
- [labs/lab-08-packaging-and-fuses.md](./labs/lab-08-packaging-and-fuses.md) — after lessons 8-9
- [labs/lab-09-electron-updater-local-fixture.md](./labs/lab-09-electron-updater-local-fixture.md) — after lesson 10
- [labs/lab-10-capstone-menu-bar-app.md](./labs/lab-10-capstone-menu-bar-app.md) — after all lessons

## Assessment (self-check — verify understanding before moving on)

- [assessments/assessment-01-process-model.md](./assessments/assessment-01-process-model.md) — after phase 1
- [assessments/assessment-02-security.md](./assessments/assessment-02-security.md) — after phase 1
- [assessments/assessment-03-ipc.md](./assessments/assessment-03-ipc.md) — after phase 1
- [assessments/assessment-04-macos-integration.md](./assessments/assessment-04-macos-integration.md) — after phase 3
- [assessments/assessment-05-packaging-and-update.md](./assessments/assessment-05-packaging-and-update.md) — after phase 4
- [assessments/assessment-06-capstone-readiness.md](./assessments/assessment-06-capstone-readiness.md) — after all phases

## Quick Reference (use anytime)

- [reference/api-cheatsheet.md](./reference/api-cheatsheet.md) — one-screen API summary
- [reference/glossary.md](./reference/glossary.md) — terminology
- [troubleshooting/index.md](./troubleshooting/index.md) — symptom-to-cause table (use when debugging)

Back to [index.md](./index.md)
