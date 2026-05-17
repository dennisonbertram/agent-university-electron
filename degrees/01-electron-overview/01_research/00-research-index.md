# Research Index — 01-electron-overview

Entry point for all Phase 1 research. Read this first to orient before building.

## Status Key

- `complete` — fully sourced and reviewed
- `draft` — written but may have gaps flagged as open questions

## File List

| # | File | One-line Summary | Status | Priority |
|---|------|-----------------|--------|----------|
| 01 | `01-capabilities-overview.md` | What Electron is, does well, doesn't, and when to choose it | complete | Read first |
| 02 | `02-three-process-model.md` | Main / Renderer / Preload architecture, lifecycle, capabilities | complete | Read first |
| 03 | `03-app-lifecycle.md` | All `app` events with handler patterns and macOS-specific behavior | complete | Read second |
| 04 | `04-ipc-patterns.md` | IPC: invoke/handle, send/on, main→renderer push, serialization rules | complete | Read second |
| 05 | `05-security-model.md` | contextIsolation, sandbox, CSP, navigation guards, security checklist | complete | Read before coding |
| 06 | `06-windowing-and-webcontents.md` | BrowserWindow, WebContentsView, popover patterns, multi-window | complete | Reference |
| 07 | `07-tray-and-menus.md` | Tray API, template images, Menu/MenuItem, context menus | complete | Reference (L4/capstone) |
| 08 | `08-notifications.md` | Notification API, actions, reply, macOS code-signing requirement | complete | Reference (L4/capstone) |
| 09 | `09-global-shortcuts.md` | globalShortcut API, conflict detection, cleanup, limitations | complete | Reference (L4/capstone) |
| 10 | `10-power-monitor.md` | powerMonitor events, idle detection, thermal state, platform matrix | complete | Reference (L4/capstone) |
| 11 | `11-deep-links-protocol.md` | Custom URL scheme, open-url, second-instance, Info.plist, packaging | complete | Reference (L4/capstone) |
| 12 | `12-dock-and-autolaunch.md` | app.dock API, LSUIElement, setLoginItemSettings, macOS 13+ nuances | complete | Reference (L4/capstone) |
| 13 | `13-storage-and-safestorage.md` | getPath, userData layout, atomic writes, safeStorage, Keychain | complete | Reference (L3/capstone) |
| 14 | `14-native-modules.md` | Why rebuild, @electron/rebuild, ABI versioning, better-sqlite3 | complete | Reference (L3/capstone) |
| 15 | `15-system-preferences-touchid.md` | canPromptTouchID, promptTouchID, entitlements, fallback | complete | Reference (capstone) |
| 16 | `16-packaging-electron-forge.md` | forge.config.ts, makers, plugins, build/make/publish flow | complete | Read before L5 |
| 17 | `17-code-signing-notarization.md` | Apple signing, entitlements, notarization, simulated path | complete | Read before L5 |
| 18 | `18-auto-update.md` | electron-updater, provider generic, manifest format, local fixture | complete | Reference (L5) |
| 19 | `19-crash-reporting-and-observability.md` | crashReporter, minidump, logging conventions, electron-log | complete | Reference |
| 20 | `20-testing-strategies.md` | Vitest for main process, Playwright _electron, recommended stack | complete | Read before writing tests |
| 21 | `21-failure-modes.md` | 15+ failure modes with symptom/cause/diagnostic/fix | complete | Read before debugging |
| 22 | `22-version-compatibility.md` | Electron 42, Chromium/Node coupling, breaking changes 30-42 | complete | Reference |
| 23 | `23-open-questions.md` | 10+ unresolved questions to answer during POC construction | complete | |

## Most Critical Files Before Starting Any POC

1. `02-three-process-model.md` — foundational mental model
2. `05-security-model.md` — security defaults must be correct from L1
3. `04-ipc-patterns.md` — the communication contract between all processes
4. `16-packaging-electron-forge.md` — needed before L5

## Files to Read Before macOS-Specific Work (L4, Capstone)

- `07-tray-and-menus.md`
- `08-notifications.md`
- `09-global-shortcuts.md`
- `10-power-monitor.md`
- `11-deep-links-protocol.md`
- `12-dock-and-autolaunch.md`
- `15-system-preferences-touchid.md`

## Files With Open Questions (validate during POCs)

- `08-notifications.md` — code-signing requirement in dev vs packaged
- `11-deep-links-protocol.md` — packaging required; dev limitations
- `12-dock-and-autolaunch.md` — macOS 13+ Service Management API nuances
- `14-native-modules.md` — better-sqlite3 universal binary rebuild
- `17-code-signing-notarization.md` — simulated vs real signing path

## Version Reference

All research pins to **Electron 42.1.0** (latest stable as of 2026-05-16). [S32]
