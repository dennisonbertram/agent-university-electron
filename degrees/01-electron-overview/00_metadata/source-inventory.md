# Source Inventory — 01-electron-overview

Populated during Phase 1 research (2026-05-16). Every source consulted with URL, snapshot date, and reliability.

## Format

| ID | Source | URL | Snapshot date | Used for | Reliability |
|----|--------|-----|---------------|----------|-------------|
| S1 | Electron Docs: Process Model | https://www.electronjs.org/docs/latest/tutorial/process-model | 2026-05-16 | Three-process model, main/renderer/preload, UtilityProcess | High |
| S2 | Electron Docs: IPC Tutorial | https://www.electronjs.org/docs/latest/tutorial/ipc | 2026-05-16 | IPC patterns: invoke/handle, send/on, webContents.send, serialization | High |
| S3 | Electron Docs: Security | https://www.electronjs.org/docs/latest/tutorial/security | 2026-05-16 | Security checklist, webPreferences flags, CSP, permission handler, navigation guards | High |
| S4 | Electron Docs: Context Isolation | https://www.electronjs.org/docs/latest/tutorial/context-isolation | 2026-05-16 | contextBridge, exposeInMainWorld, serialization rules, TypeScript declarations | High |
| S5 | Electron Docs: Sandbox | https://www.electronjs.org/docs/latest/tutorial/sandbox | 2026-05-16 | Sandbox behavior, preload polyfill, available modules, gotchas | High |
| S6 | Electron Docs: Tray API | https://www.electronjs.org/docs/latest/api/tray | 2026-05-16 | Tray constructor, template image, methods, events, GC gotcha | High |
| S7 | Electron Docs: Notification API | https://www.electronjs.org/docs/latest/api/notification | 2026-05-16 | Notification options, actions, reply, show(), events, macOS code-signing requirement | High |
| S8 | Electron Docs: globalShortcut | https://www.electronjs.org/docs/latest/api/global-shortcut | 2026-05-16 | register, isRegistered, cleanup, conflict behavior, setSuspended | High |
| S9 | Electron Docs: powerMonitor | https://www.electronjs.org/docs/latest/api/power-monitor | 2026-05-16 | All events, idle detection, thermal state, platform matrix | High |
| S10 | Electron Docs: app API | https://www.electronjs.org/docs/latest/api/app | 2026-05-16 | Lifecycle events, getPath, addRecentDocument, setAsDefaultProtocolClient, requestSingleInstanceLock, setLoginItemSettings, dock | High |
| S11 | Electron Docs: safeStorage | https://www.electronjs.org/docs/latest/api/safe-storage | 2026-05-16 | isEncryptionAvailable, encryptString, decryptString, async API, platform behavior | High |
| S12 | Electron Docs: systemPreferences | https://www.electronjs.org/docs/latest/api/system-preferences | 2026-05-16 | canPromptTouchID, promptTouchID, entitlements | High |
| S13 | Electron Docs: nativeTheme | https://www.electronjs.org/docs/latest/api/native-theme | 2026-05-16 | shouldUseDarkColors, themeSource, updated event | High |
| S14 | Electron Forge Docs: Overview | https://www.electronjs.org/docs/latest/tutorial/forge-overview | 2026-05-16 | Forge overview, commands | High |
| S15 | Electron Docs: Code Signing | https://www.electronjs.org/docs/latest/tutorial/code-signing | 2026-05-16 | macOS signing requirements, osxSign, osxNotarize | High |
| S16 | Electron Forge: Code Signing macOS | https://www.electronforge.io/guides/code-signing/code-signing-macos | 2026-05-16 | osxSign config, osxNotarize options, entitlements, hardened runtime | High |
| S17 | Electron Docs: Auto-Update | https://www.electronjs.org/docs/latest/tutorial/updates | 2026-05-16 | Built-in autoUpdater (Squirrel), update-electron-app, manifest formats | High |
| S18 | electron-updater Docs | https://www.electron.build/auto-update | 2026-05-16 | electron-updater provider config, events, manifest format, local testing | High |
| S19 | Electron Docs: crashReporter | https://www.electronjs.org/docs/latest/api/crash-reporter | 2026-05-16 | crashReporter.start options, minidump location, local sink, extra params | High |
| S20 | Playwright: ElectronApplication API | https://playwright.dev/docs/api/class-electronapplication | 2026-05-16 | _electron launch, evaluate, firstWindow, windows, events, gotchas | High |
| S21 | Electron Docs: Versioning | https://www.electronjs.org/docs/latest/tutorial/electron-versioning | 2026-05-16 | Release cadence, SemVer, Chromium/Node coupling, supported versions | High |
| S22 | Electron Docs: Native Modules | https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules | 2026-05-16 | @electron/rebuild, ABI versioning, prebuilt binaries, Windows DLL hook | High |
| S23 | Electron Docs: BrowserWindow API | https://www.electronjs.org/docs/latest/api/browser-window | 2026-05-16 | Constructor options, webPreferences, vibrancy, popover patterns, BrowserView deprecation | High |
| S24 | Electron Docs: Menu API | https://www.electronjs.org/docs/latest/api/menu | 2026-05-16 | buildFromTemplate, setApplicationMenu, popup, context menus | High |
| S25 | Electron Docs: Dialog API | https://www.electronjs.org/docs/latest/api/dialog | 2026-05-16 | showOpenDialog, showSaveDialog, showMessageBox, sandbox considerations | High |
| S26 | Electron Docs: Deep Links | https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app | 2026-05-16 | setAsDefaultProtocolClient, open-url, second-instance, Info.plist, packaging | High |
| S27 | Electron Docs: Dock API | https://www.electronjs.org/docs/latest/api/dock | 2026-05-16 | bounce, setBadge, hide, show, setMenu, setIcon | High |
| S28 | Electron Docs: Performance | https://www.electronjs.org/docs/latest/tutorial/performance | 2026-05-16 | Startup, bundle size, lazy loading, blocking main process | High |
| S29 | Electron Docs: Breaking Changes | https://www.electronjs.org/docs/latest/breaking-changes | 2026-05-16 | v30-42 breaking changes, upgrade checklist | High |
| S30 | Electron Forge: Configuration | https://www.electronforge.io/config/configuration | 2026-05-16 | forge.config.ts structure, packagerConfig, makers, plugins, hooks | High |
| S31 | Electron Forge: DMG Maker | https://www.electronforge.io/config/makers/dmg | 2026-05-16 | DMG maker options, background, format | High |
| S32 | npm registry probe (environment) | npm view commands | 2026-05-16 | Version pins for electron, forge, updater, notarize, better-sqlite3, playwright, vitest | High |
| S33 | Electron Docs: Native Drag & Drop | https://www.electronjs.org/docs/latest/tutorial/native-file-drag-drop | 2026-05-16 | webContents.startDrag, drag-in via web API | High |
