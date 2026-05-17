# Production-Readiness Checklist — Electron App

Items that must be true BEFORE the bundle leaves your machine.

---

## Packaging

1. **`asar: true` in `packagerConfig`** — without it the app ships unpacked. Verify `out/<App>.app/Contents/Resources/app.asar` exists (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:168`).
2. **Dev-only files excluded via `ignore` regex** — `tests/`, `test-results/`, `out/`, `.git`, `forge.config.ts`, `playwright.config.ts`, `vitest.config.ts`, `tsconfig*.json`, source TS files. Otherwise your bundle is 2× bigger than needed (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:171-189`).
3. **Native modules unpacked from asar** — `AutoUnpackNativesPlugin` or `asar.unpack: '**/*.node'`. Native `.node` files cannot `require()` from inside asar (evidence: `01_research/14-native-modules.md` lines 106-130; `03_pocs/L-capstone-pulse/poc-report.md` §"Invariants" 4).
4. **`Info.plist.template` carries `CFBundleURLTypes` AND version + copyright** — verified by reading the packaged plist with `defaults read` or `plutil -p` (evidence: `03_pocs/L5-packaging-signing-update/poc-report.md` BT-L5-3 row).

## Code signing & notarization

5. **`osxSign` enabled with Developer ID Application cert** — `codesign --verify --deep --strict <App>.app` returns 0 (evidence: `03_pocs/L5-packaging-signing-update/poc-report.md` §"@signed-only").
6. **Hardened runtime enabled** — `optionsForFile.hardenedRuntime: true` (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:201-204`).
7. **Entitlements declared** — `com.apple.security.cs.disable-library-validation`, `com.apple.security.cs.allow-jit`, `com.apple.security.network.client` (evidence: `03_pocs/L5-packaging-signing-update/poc-report.md` BT-L5-9 row).
8. **App notarized via `xcrun notarytool submit ... --wait`** — Notarization ticket attached (evidence: `03_pocs/L5-packaging-signing-update/simulated-signing.md` §"What would happen").
9. **Notarization ticket stapled** — `xcrun stapler validate <App>.app` returns 0 (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts` lines 115-119).
10. **Gatekeeper assess passes** — `spctl --assess --type exec --verbose <App>.app` returns "accepted" (evidence: `03_pocs/L5-packaging-signing-update/simulated-signing.md` §5).

## Fuses

11. **All 6 hardening fuses set** — `RunAsNode:false`, `EnableCookieEncryption:true`, `EnableNodeOptionsEnvironmentVariable:false`, `EnableNodeCliInspectArguments:false`, `EnableEmbeddedAsarIntegrityValidation:true`, `OnlyLoadAppFromAsar:true` (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:225-233`).

## Auto-update

12. **`electron-updater` with `provider: generic` (or appropriate provider) wired** — feed URL set; `update-available`, `update-not-available`, `update-downloaded`, `error` events all logged (evidence: `01_research/18-auto-update.md` lines 32-63).
13. **Local update-server smoke test passes** — `BT-L5-6` style fixture server confirms `update-available` event fires for newer-version manifest (evidence: `03_pocs/L5-packaging-signing-update/poc-report.md` BT-L5-6 row).
14. **Update server strips query-string before path matching** — `electron-updater` appends `?noCache=<token>` (evidence: `04_logs/expectation-gap-ledger.md#entry-7`).
15. **`forceDevUpdateConfig = true` set if dev-mode updater testing matters** — otherwise updater short-circuits in unpackaged builds (evidence: `04_logs/expectation-gap-ledger.md#entry-9`).

## crashReporter

16. **`crashReporter.start()` called BEFORE `app.whenReady()`** — module-load scope. Static-source ordering check (evidence: `03_pocs/L5-packaging-signing-update/poc-report.md` R-L5-1; `01_research/19-crash-reporting-and-observability.md` line 41).
17. **`submitURL` set OR `uploadToServer: false`** — error since Electron 13 if neither (evidence: `01_research/19-crash-reporting-and-observability.md` line 45).

## Observability

18. **Structured JSON-lines logs in `app.getPath('logs')/main.log`** — every IPC handler, security guard, lifecycle event emits a markered log line (evidence: `02_planning/observability-strategy.md` lines 30-42).
19. **Renderer-side logs forwarded to main** — `electron-log`'s built-in forwarder OR an IPC `log:entry` channel (evidence: `02_planning/observability-strategy.md` §5).

## Lifecycle & menu-bar UX

20. **Single-instance lock requested BEFORE `whenReady`** — `requestSingleInstanceLock()` at module scope; `second-instance` handler wired (evidence: `01_research/11-deep-links-protocol.md` lines 60-86).
21. **`open-url` listener registered BEFORE `whenReady`** — otherwise cold-launch URLs are lost (evidence: `01_research/11-deep-links-protocol.md` lines 42-56).
22. **Deep-link scheme in BOTH `packagerConfig.protocols` AND `Info.plist.template` CFBundleURLTypes** — note the override gotcha (evidence: `04_logs/expectation-gap-ledger.md#entry-8`).
23. **`LSUIElement = true` in Info.plist for menu-bar-only apps** — runtime probe: app launches with no Dock icon (evidence: `03_pocs/L-capstone-pulse/poc-report.md` §"Honest deviations" item 2).
24. **`app.dock.hide()` invoked BEFORE first BrowserWindow in dev mode** — covers the unpackaged path where LSUIElement isn't read (evidence: `03_pocs/L-capstone-pulse/src/main.ts:560-570`).

## Tray (if menu-bar app)

25. **Tray reference is module-scope `let trayInstance: Tray | null`** — static-source check (evidence: `01_research/21-failure-modes.md#FM-04`; `03_pocs/L4-deep-macos-integration/src/tray.ts:27`).
26. **Per-state PNG template variants in `assets/` with `Template` suffix** — `tray-idle-Template.png`, `tray-idle-Template@2x.png` etc. Bundler must preserve the filename suffix (evidence: `01_research/07-tray-and-menus.md` lines 28-45).

## Auto-launch

27. **`setLoginItemSettings({ openAtLogin })` round-trips on the signed packaged build** — assert in a manual smoke test on macOS 13+; dev mode is non-deterministic (evidence: `04_logs/expectation-gap-ledger.md#entry-5`).

## Global shortcuts

28. **`globalShortcut.register` paired with `app.on('will-quit', () => globalShortcut.unregisterAll())`** — static-source check (evidence: `03_pocs/L-capstone-pulse/src/shortcuts.ts:68-77`; `03_pocs/L4-deep-macos-integration/poc-report.md` R-L4-2).

## Notifications

29. **`notification.on('failed', ...)` registered BEFORE `notification.show()`** — static-source check (evidence: `03_pocs/L-capstone-pulse/src/notifications.ts:83-89`).

## Test seams

30. **No `test:*` IPC channels reachable in production builds** — `testHooksEnabled()` returns false when `NODE_ENV !== 'test'` AND named flag env vars are unset. Runtime probe: in the packaged build, invoke a `test:*` channel and assert it rejects with `No handler registered` (evidence: `04_logs/decision-log.md#decision-10`; `03_pocs/L-capstone-pulse/poc-report.md` §"Invariants" 6).
