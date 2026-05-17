# Electron Skill Pack — Master Index

**Audience**: Autonomous LLM coding agents building, debugging, or shipping Electron apps on macOS.

**Version baseline**: Electron 42.1.0 · Node.js 24.15.0 · electron-forge 7.11.1 · electron-updater 6.8.3

**Start here**:
- New to Electron → [quickstart.md](./quickstart.md) then [curriculum.md](./curriculum.md)
- Agent/automated consumer → [agent-instructions.md](./agent-instructions.md)
- Debugging a problem → [troubleshooting/index.md](./troubleshooting/index.md)
- Need a specific pattern → [Recipes](#recipes)

---

## Orientation

This pack is self-contained. You do not need to read raw research, planning, POC, or distillation files to use it. Every claim here traces back to a distillation; every code snippet is a production-ready pattern.

The pack is organized as: **Lessons** (concepts) → **Labs** (hands-on) → **Recipes** (copy-paste) → **Checklists** (pre-flight) → **Troubleshooting** (symptom-first) → **Reference** (dense tables) → **Examples** (pointers) → **Assessments** (verification).

---

## Top-Level Files

| File | Purpose |
|---|---|
| [README.md](./README.md) | Orientation: audience, scope, version baseline, how to navigate |
| [quickstart.md](./quickstart.md) | 10-step minimal app: scaffold → build → run → verify |
| [curriculum.md](./curriculum.md) | 5-phase reading order; prerequisites; skill checkpoints |
| [agent-instructions.md](./agent-instructions.md) | Decision tree, task-to-file map, anti-patterns for agents |

---

## Lessons

Progressive concept teaching. Read in order for a complete mental model; jump to a specific lesson if you need one concept.

| File | Topic | Prerequisites |
|---|---|---|
| [lessons/01-three-process-model.md](./lessons/01-three-process-model.md) | Main, Renderer, Preload — capabilities and boundaries | None |
| [lessons/02-secure-renderer-defaults.md](./lessons/02-secure-renderer-defaults.md) | BrowserWindow flags, CSP, navigation guards, fuses overview | Lesson 01 |
| [lessons/03-ipc-patterns-and-validation.md](./lessons/03-ipc-patterns-and-validation.md) | IPC registry, validators, error round-trip, test seams | Lessons 01–02 |
| [lessons/04-storage-and-encryption.md](./lessons/04-storage-and-encryption.md) | app.getPath, atomic write-rename, safeStorage, SQLite+WAL | Lesson 01 |
| [lessons/05-native-modules-and-rebuild.md](./lessons/05-native-modules-and-rebuild.md) | ABI, electron-rebuild, two-ABI problem, AutoUnpackNatives | Lesson 04 |
| [lessons/06-macos-system-integration.md](./lessons/06-macos-system-integration.md) | Tray, notifications, shortcuts, deep links, powerMonitor, Touch ID, dock | Lessons 01–03 |
| [lessons/07-app-lifecycle-and-single-instance.md](./lessons/07-app-lifecycle-and-single-instance.md) | Pre-ready boot ordering, single instance, cold-start deep links | Lessons 01, 06 |
| [lessons/08-packaging-with-electron-forge.md](./lessons/08-packaging-with-electron-forge.md) | Forge config, asar, ignore list, protocols, fuses | Lessons 01–05 |
| [lessons/09-code-signing-and-notarization.md](./lessons/09-code-signing-and-notarization.md) | Certificates, entitlements, hardened runtime, notarytool, stapling | Lesson 08 |
| [lessons/10-auto-update.md](./lessons/10-auto-update.md) | electron-updater, generic provider, forceDevUpdateConfig, noCache | Lesson 08 |
| [lessons/11-crash-reporting-and-observability.md](./lessons/11-crash-reporting-and-observability.md) | crashReporter pre-ready, structured JSON logging, log schema | Lessons 01, 07 |
| [lessons/12-testing-electron-apps.md](./lessons/12-testing-electron-apps.md) | Unit/behavioral/static layers, Playwright _electron, launchApp helper | Lessons 01–11 |

---

## Labs

Hands-on exercises. Each lab has a concrete goal, step-by-step instructions, and verifiable outcomes.

| File | Goal | Recipes Used |
|---|---|---|
| [labs/lab-01-hello-electron.md](./labs/lab-01-hello-electron.md) | Minimal 3-process app with ping IPC and log file | recipe-secure-window, recipe-structured-jsonl-logger |
| [labs/lab-02-secure-ipc-roundtrip.md](./labs/lab-02-secure-ipc-roundtrip.md) | IPC registry with validator, Playwright test for valid/invalid | recipe-ipc-handler-with-validator, recipe-playwright-electron-launch |
| [labs/lab-03-atomic-storage.md](./labs/lab-03-atomic-storage.md) | Atomic JSON persistence with USER_DATA_DIR override | recipe-atomic-json-write |
| [labs/lab-04-tray-with-state.md](./labs/lab-04-tray-with-state.md) | Module-scope tray, state machine, static regression | recipe-tray-with-template-image, recipe-test-seam-ipc-channel |
| [labs/lab-05-notification-with-failed-listener.md](./labs/lab-05-notification-with-failed-listener.md) | showNotification() Promise, failed-before-show, safety timeout | recipe-notification-with-failed-listener |
| [labs/lab-06-global-shortcut.md](./labs/lab-06-global-shortcut.md) | Shortcut registration, will-quit cleanup, fireForTest seam | recipe-global-shortcut-with-cleanup, recipe-test-seam-ipc-channel |
| [labs/lab-07-deep-link-router.md](./labs/lab-07-deep-link-router.md) | parseDeepLink, pre-ready registration, testEmitOpenUrl seam | recipe-deep-link-handler, recipe-test-seam-ipc-channel |
| [labs/lab-08-packaging-and-fuses.md](./labs/lab-08-packaging-and-fuses.md) | Forge package, asar verification, all 6 fuses | recipe-forge-config-with-fuses |
| [labs/lab-09-electron-updater-local-fixture.md](./labs/lab-09-electron-updater-local-fixture.md) | Local update server, fixture manifest, update-available event | recipe-electron-updater-generic-provider |
| [labs/lab-10-capstone-menu-bar-app.md](./labs/lab-10-capstone-menu-bar-app.md) | Full menu-bar app architecture with 3 Playwright tests | All recipe families |

---

## Recipes

Copy-paste patterns. Each recipe includes production code + test pattern + "watch out for" notes.

### Windows and Security

| File | What It Solves |
|---|---|
| [recipes/recipe-secure-window.md](./recipes/recipe-secure-window.md) | Secure BrowserWindow factory with SECURE_WEB_PREFERENCES |
| [recipes/recipe-context-menu-on-renderer.md](./recipes/recipe-context-menu-on-renderer.md) | Right-click context menu via IPC |
| [recipes/recipe-application-menu-template-macos.md](./recipes/recipe-application-menu-template-macos.md) | macOS application menu template |

### IPC

| File | What It Solves |
|---|---|
| [recipes/recipe-ipc-handler-with-validator.md](./recipes/recipe-ipc-handler-with-validator.md) | Full IPC registry with channel validators |
| [recipes/recipe-test-seam-ipc-channel.md](./recipes/recipe-test-seam-ipc-channel.md) | Test-only channels gated by testHooksEnabled() |

### Storage and Encryption

| File | What It Solves |
|---|---|
| [recipes/recipe-atomic-json-write.md](./recipes/recipe-atomic-json-write.md) | Crash-safe JSON persistence |
| [recipes/recipe-safestorage-encryption.md](./recipes/recipe-safestorage-encryption.md) | OS keychain encryption via safeStorage |
| [recipes/recipe-pbkdf2-passphrase.md](./recipes/recipe-pbkdf2-passphrase.md) | Passphrase hashing with PBKDF2 + timingSafeEqual |
| [recipes/recipe-better-sqlite3-with-auto-unpack.md](./recipes/recipe-better-sqlite3-with-auto-unpack.md) | SQLite native module: rebuild + asar unpack |

### macOS System Integration

| File | What It Solves |
|---|---|
| [recipes/recipe-tray-with-template-image.md](./recipes/recipe-tray-with-template-image.md) | Module-scope tray with template PNG |
| [recipes/recipe-notification-with-failed-listener.md](./recipes/recipe-notification-with-failed-listener.md) | Notifications with failed-before-show pattern |
| [recipes/recipe-global-shortcut-with-cleanup.md](./recipes/recipe-global-shortcut-with-cleanup.md) | Global shortcut registration + will-quit cleanup |
| [recipes/recipe-power-monitor-aware-timer.md](./recipes/recipe-power-monitor-aware-timer.md) | powerMonitor events with test seam |
| [recipes/recipe-deep-link-handler.md](./recipes/recipe-deep-link-handler.md) | Deep link router with parseDeepLink + dual-path |
| [recipes/recipe-single-instance-lock.md](./recipes/recipe-single-instance-lock.md) | Single instance enforcement + second-instance |
| [recipes/recipe-app-dock-hide-menu-bar-only.md](./recipes/recipe-app-dock-hide-menu-bar-only.md) | Dock.hide() + LSUIElement for menu-bar apps |
| [recipes/recipe-touch-id-with-fallback.md](./recipes/recipe-touch-id-with-fallback.md) | Touch ID with env-flag test seams |

### Lifecycle and Boot

| File | What It Solves |
|---|---|
| [recipes/recipe-crashreporter-pre-ready.md](./recipes/recipe-crashreporter-pre-ready.md) | crashReporter.start() before whenReady |

### Packaging and Distribution

| File | What It Solves |
|---|---|
| [recipes/recipe-forge-config-with-fuses.md](./recipes/recipe-forge-config-with-fuses.md) | Complete forge.config.ts with all 6 fuses + conditional signing |
| [recipes/recipe-electron-updater-generic-provider.md](./recipes/recipe-electron-updater-generic-provider.md) | electron-updater with local fixture server |

### Observability and Testing

| File | What It Solves |
|---|---|
| [recipes/recipe-structured-jsonl-logger.md](./recipes/recipe-structured-jsonl-logger.md) | JSON-lines logger with appendFileSync |
| [recipes/recipe-playwright-electron-launch.md](./recipes/recipe-playwright-electron-launch.md) | Complete launchApp() helper for Playwright |

---

## Checklists

Use before risky operations. Each item has a "how to verify" column.

| File | When to Use |
|---|---|
| [checklists/security-checklist.md](./checklists/security-checklist.md) | Before merging any security-related change; 27 items |
| [checklists/production-readiness-checklist.md](./checklists/production-readiness-checklist.md) | Before shipping any build; 33 items |
| [checklists/packaging-checklist.md](./checklists/packaging-checklist.md) | Before running `npm run make`; 33 items |
| [checklists/deep-macos-integration-checklist.md](./checklists/deep-macos-integration-checklist.md) | When adding tray/notifications/shortcuts/deep links; 30 items |

---

## Troubleshooting

Symptom-first index. Find your symptom; follow the link.

| File | Symptom |
|---|---|
| [troubleshooting/index.md](./troubleshooting/index.md) | Master symptom table |
| [troubleshooting/white-screen.md](./troubleshooting/white-screen.md) | BrowserWindow shows blank white page |
| [troubleshooting/native-module-load-failure.md](./troubleshooting/native-module-load-failure.md) | `.node` module fails to load; ABI mismatch |
| [troubleshooting/deep-link-not-firing.md](./troubleshooting/deep-link-not-firing.md) | Custom URL scheme does nothing |
| [troubleshooting/tray-icon-disappears.md](./troubleshooting/tray-icon-disappears.md) | Tray icon appears then vanishes |
| [troubleshooting/notification-not-displaying.md](./troubleshooting/notification-not-displaying.md) | macOS notification never shows |
| [troubleshooting/electron-updater-not-checking.md](./troubleshooting/electron-updater-not-checking.md) | Auto-update never fires update-available |
| [troubleshooting/packaged-app-wont-launch.md](./troubleshooting/packaged-app-wont-launch.md) | App crashes immediately after packaging |
| [troubleshooting/code-signing-failure.md](./troubleshooting/code-signing-failure.md) | codesign/Gatekeeper/notarization errors |
| [troubleshooting/ipc-validation-error-shape.md](./troubleshooting/ipc-validation-error-shape.md) | IPC error loses .code / custom fields |

---

## Reference

Dense, scannable tables for quick lookup.

| File | Contents |
|---|---|
| [reference/api-cheatsheet.md](./reference/api-cheatsheet.md) | All commonly used Electron APIs by process |
| [reference/ipc-channel-conventions.md](./reference/ipc-channel-conventions.md) | Channel naming, registry structure, anti-patterns |
| [reference/log-format.md](./reference/log-format.md) | LogEntry schema, event catalog, LOG_DIR env var |
| [reference/fuses-reference.md](./reference/fuses-reference.md) | All 6 fuses: purpose, config, verification |
| [reference/entitlements-reference.md](./reference/entitlements-reference.md) | Required entitlements, optional entitlements, plist |
| [reference/electron-version-compatibility.md](./reference/electron-version-compatibility.md) | ABI table, breaking changes by version |
| [reference/glossary.md](./reference/glossary.md) | Key terms: asar, ABI, contextBridge, fuses, etc. |

---

## Examples

Pointer tables to POC implementations. Each maps source files to recipes and lessons.

| File | App |
|---|---|
| [examples/index.md](./examples/index.md) | Examples index |
| [examples/example-l1-minimal-app.md](./examples/example-l1-minimal-app.md) | L1: Minimal app (3-process model, IPC, logging) |
| [examples/example-l2-secure-ipc.md](./examples/example-l2-secure-ipc.md) | L2: Secure IPC (registry, guards, permissions) |
| [examples/example-l3-atomic-storage.md](./examples/example-l3-atomic-storage.md) | L3: Storage (atomic JSON, safeStorage, SQLite) |
| [examples/example-l4-macos-integration.md](./examples/example-l4-macos-integration.md) | L4: macOS (tray, notifications, shortcuts, deep links) |
| [examples/example-l5-packaging.md](./examples/example-l5-packaging.md) | L5: Packaging (Forge, fuses, signing, auto-update) |
| [examples/example-capstone-pulse.md](./examples/example-capstone-pulse.md) | Capstone: Pulse menu-bar app (all patterns combined) |

---

## Assessments

Self-check questions with answer keys. Answer without reading the answers first.

| File | Topic |
|---|---|
| [assessments/assessment-01-process-model.md](./assessments/assessment-01-process-model.md) | Three-process model and IPC architecture |
| [assessments/assessment-02-security.md](./assessments/assessment-02-security.md) | Security: BrowserWindow, CSP, guards, fuses |
| [assessments/assessment-03-ipc.md](./assessments/assessment-03-ipc.md) | IPC, storage, native modules, encryption |
| [assessments/assessment-04-macos-integration.md](./assessments/assessment-04-macos-integration.md) | macOS: tray, notifications, shortcuts, deep links |
| [assessments/assessment-05-packaging-and-update.md](./assessments/assessment-05-packaging-and-update.md) | Packaging, signing, notarization, auto-update |
| [assessments/assessment-06-capstone-readiness.md](./assessments/assessment-06-capstone-readiness.md) | Capstone: full scenario covering all topics |

---

## Gotcha Quick Reference

Most common mistakes that cause silent failures:

| Gotcha | Symptom | Fix | File |
|---|---|---|---|
| G-02 | Ambient .d.ts breaks TypeScript | Remove `src/electron.d.ts` | [lessons/03](./lessons/03-ipc-patterns-and-validation.md) |
| G-03 | IPC error loses .code field | Encode in message or use result union | [troubleshooting/ipc-validation-error-shape.md](./troubleshooting/ipc-validation-error-shape.md) |
| G-04 | fs.watch misses atomic renames | Use polling / chokidar | [lessons/04](./lessons/04-storage-and-encryption.md) |
| G-08 | ?noCache query causes 404 | Strip query in update server | [troubleshooting/electron-updater-not-checking.md](./troubleshooting/electron-updater-not-checking.md) |
| G-09 | protocols + CFBundleURLTypes conflict | Use only one | [troubleshooting/deep-link-not-firing.md](./troubleshooting/deep-link-not-firing.md) |
| G-10 | forceDevUpdateConfig type error | Cast `(autoUpdater as any)` | [troubleshooting/electron-updater-not-checking.md](./troubleshooting/electron-updater-not-checking.md) |
| G-11 | Playwright workers > 1 causes flaky tests | Set `workers: 1, fullyParallel: false` | [lessons/12](./lessons/12-testing-electron-apps.md) |
| G-12 | `npm run package` vs `npm run make` confusion | `package` = .app only; `make` = distributable | [lessons/08](./lessons/08-packaging-with-electron-forge.md) |
| Tray GC | Tray disappears after 3s | Module-scope `let trayInstance` | [troubleshooting/tray-icon-disappears.md](./troubleshooting/tray-icon-disappears.md) |
| Notification silent | Notification never fires, no error | Attach `failed` BEFORE `.show()` | [troubleshooting/notification-not-displaying.md](./troubleshooting/notification-not-displaying.md) |
| Deep link cold start | URL opens app but handler not called | Register `open-url` BEFORE `whenReady` | [troubleshooting/deep-link-not-firing.md](./troubleshooting/deep-link-not-firing.md) |
| ABI mismatch | `.node` can't load in packaged app | Run `electron-rebuild` + `AutoUnpackNativesPlugin` | [troubleshooting/native-module-load-failure.md](./troubleshooting/native-module-load-failure.md) |

---

## File Count

| Section | Count |
|---|---|
| Top-level navigation | 4 |
| Lessons | 12 |
| Labs | 10 |
| Recipes | 22 |
| Checklists | 4 |
| Troubleshooting | 10 (index + 9) |
| Reference | 7 |
| Examples | 7 (index + 6) |
| Assessments | 6 |
| **Total** | **82** |

Evidence: `/Users/dennison/develop/agent-university/electron/degrees/01-electron-overview/05_distillation/`
