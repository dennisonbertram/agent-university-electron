# Risk Register — 01-electron-overview

Risks ranked by composite severity (Likelihood × Impact). Each risk carries a unique ID for cross-referencing from other planning documents and POC test plans.

---

## R-01 — Native Module ABI Mismatch (better-sqlite3 + Electron 42)

- **Likelihood**: high
- **Impact**: high
- **Source / evidence**: `../01_research/14-native-modules.md` (FM-02 in `../01_research/21-failure-modes.md`); `../01_research/23-open-questions.md` OQ-04
- **Description**: `better-sqlite3` compiles against a specific Node ABI. Electron 42 bundles its own Node (ABI ≠ system Node ABI). Without `@electron/rebuild`, the module refuses to load with `NODE_MODULE_VERSION mismatch`. For universal binary builds (arm64 + x64), the rebuild must produce binaries for both architectures. The exact Forge configuration for universal better-sqlite3 is an open question (OQ-04).
- **Mitigation**:
  - Add `@electron/rebuild` to Forge's `rebuildConfig` with `force: true` in L3 (first use of SQLite).
  - Add `AutoUnpackNativesPlugin` to Forge config to ensure `.node` files are unpacked from asar.
  - In L5, test `npm run make -- --arch=universal` and verify both arch binaries exist in the output.
  - Write a vitest test that loads better-sqlite3 against system Node; separately verify in Playwright e2e that it works under Electron's Node.
- **Trigger to escalate**: L3 POC throws `NODE_MODULE_VERSION` error after running `npm run start` with Forge.

---

## R-02 — Notifications Silently Failing in Unsigned Dev Builds

- **Likelihood**: high
- **Impact**: medium
- **Source / evidence**: FM-05 in `../01_research/21-failure-modes.md`; OQ-01 in `../01_research/23-open-questions.md`
- **Description**: macOS requires code signing for notifications delivered via `UNUserNotificationCenter`. In unsigned dev builds, `notification.show()` fires the `show` event but the `failed` event also fires with "This app is not authorized to send notifications." The notification never appears in Notification Center. This makes L4 notification behavioral tests impossible to run in dev mode without signing. OQ-01 is unresolved: all notification display (including simple title-only) may be blocked unsigned.
- **Mitigation**:
  - Instrument the `failed` event listener and log it explicitly; treat `failed` firing as a documented expectation gap.
  - For unit tests, mock `Notification` class and assert call arguments without exercising OS delivery.
  - For L5/capstone, use an ad-hoc signed build (`codesign --sign -`) to test notification delivery with minimal friction.
  - Document in `05_distillation/gotchas.md`: "Notification delivery requires code signing; test via mock in unit tests, ad-hoc signing in integration."
- **Trigger to escalate**: `failed` event fires even in ad-hoc-signed build with valid entitlements.

---

## R-03 — Deep Links Not Firing on macOS Until App Is Packaged

- **Likelihood**: high
- **Impact**: medium
- **Source / evidence**: FM-06 in `../01_research/21-failure-modes.md`; OQ-06 context in `../01_research/23-open-questions.md`
- **Description**: On macOS, URL scheme routing requires the app to be a proper `.app` bundle registered with Launch Services. In dev mode (`npm run start`), the `open-url` event never fires when a URL like `electron-l4://action` is opened from Terminal or a browser. Deep link behavioral tests therefore cannot run in dev mode.
- **Mitigation**:
  - Design L4 deep-link handler to be unit-testable (pure URL-parsing function separate from Electron `open-url` registration).
  - Integration test the `open-url` event by triggering it programmatically in Playwright evaluate (`electronApp.evaluate(() => app.emit('open-url', event, 'url://...'))`).
  - In L5/capstone, install the packaged app and test real `open` command invocation; document the result.
- **Trigger to escalate**: Playwright evaluate trick doesn't fire the `open-url` handler (event argument type mismatch).

---

## R-04 — globalShortcut Collision with System Shortcuts

- **Likelihood**: medium
- **Impact**: medium
- **Source / evidence**: FM-10 in `../01_research/21-failure-modes.md`; OQ-02 in `../01_research/23-open-questions.md`
- **Description**: `globalShortcut.register()` returns `false` if another app (or the system) owns the requested accelerator. `Cmd+Shift+P` is used by Chrome DevTools and VS Code. `Cmd+Shift+J` is used by Chrome. The capstone's two primary shortcuts may fail to register on the developer's machine.
- **Mitigation**:
  - Write registration with a `registered` boolean check and log a warning if false; never crash.
  - Provide a fallback accelerator list (e.g., `Cmd+Ctrl+P`) and a UI-configurable shortcut in the capstone.
  - In CI/test, skip globalShortcut tests if `registered === false` with a logged skip reason.
  - Unregister all shortcuts in `will-quit` (FM-10 mitigation).
- **Trigger to escalate**: Both primary and fallback accelerators fail to register on the CI machine.

---

## R-05 — Tray Icon GC Pitfall

- **Likelihood**: high (LLM will write local variable unless warned)
- **Impact**: high (Tray disappears silently; hard to debug)
- **Source / evidence**: FM-04 in `../01_research/21-failure-modes.md`
- **Description**: If the `Tray` instance is stored in a function-local variable, the V8 garbage collector destroys it when the function returns. The tray icon appears briefly and then vanishes with no error. This is one of the most common Electron beginner mistakes and an LLM is highly likely to reproduce it.
- **Mitigation**:
  - Declare `let tray: Tray | null = null` at module scope before any function.
  - Add a lint rule or comment `// module-level: must not be local variable — GC will destroy Tray`.
  - Write a vitest test that asserts the tray reference is accessible from module scope after initialization.
- **Trigger to escalate**: L4 POC tray icon appears then disappears within 2 seconds of launch.

---

## R-06 — BrowserView Deprecation / WebContentsView Migration

- **Likelihood**: medium
- **Impact**: medium
- **Source / evidence**: FM-13 in `../01_research/21-failure-modes.md`; `../01_research/22-version-compatibility.md` (Electron 30 breaking change)
- **Description**: `BrowserView` was deprecated in Electron 30. Using it in Electron 42 produces deprecation warnings. Any POC that uses a secondary in-window content area must use `WebContentsView` inside a `BaseWindow`. LLMs trained on older Electron code may generate `setBrowserView()` calls.
- **Mitigation**:
  - The degree does not include a multi-view POC by design (see poc-selection.md "Alternatives Considered").
  - If the capstone's popover window requires a webview-like surface, use `WebContentsView` from the start.
  - Add a lint comment wherever `BrowserView` might appear: "DEPRECATED since Electron 30 — use WebContentsView."
- **Trigger to escalate**: Capstone popover design requires embedded web content that cannot be implemented cleanly with a standard `BrowserWindow`.

---

## R-07 — File.path Removal (Electron 32+) Breaking Drag-Drop Assumption

- **Likelihood**: high (LLM training data contains pre-32 examples)
- **Impact**: medium
- **Source / evidence**: FM-15 in `../01_research/21-failure-modes.md`; `../01_research/22-version-compatibility.md`
- **Description**: `File.path` (the nonstandard property that returned the filesystem path from a dropped file) was removed in Electron 32. Code using `file.path` in a drop handler will get `undefined` silently or throw. The correct replacement is `webUtils.getPathForFile(file)` exposed via preload's contextBridge.
- **Mitigation**:
  - In L3 drag-drop implementation, use `webUtils.getPathForFile` exclusively.
  - Add a behavioral test: "Given a file is dropped, when handler fires, then the path returned by `getFilePath()` matches the actual file path."
  - Note in `05_distillation/before-you-build.md`.
- **Trigger to escalate**: L3 drag-drop test returns `undefined` for the file path on Electron 42.

---

## R-08 — safeStorage Re-encryption After Electron Upgrade or Bundle ID Change

- **Likelihood**: medium
- **Impact**: high
- **Source / evidence**: OQ-10 in `../01_research/23-open-questions.md`; `../01_research/13-storage-and-safestorage.md`
- **Description**: `safeStorage` on macOS uses a Keychain key scoped to the app's bundle ID. If the bundle ID changes (e.g., from a dev bundle ID to a production one, or after an Electron upgrade that changes the Keychain entry name), all existing encrypted data is unreadable. There is no automatic migration. This is a critical data-loss risk for the capstone's journal encryption.
- **Mitigation**:
  - Pin the capstone's `appBundleId` to `com.agentuniversity.pulse` from L4 onward and never change it during the degree.
  - Document the migration requirement in `05_distillation/gotchas.md`.
  - Write a test that encrypts and decrypts within the same app run; note that cross-run decryption depends on the Keychain being intact.
- **Trigger to escalate**: Capstone `safeStorage.decryptString()` throws after a bundle ID or Electron version change during development.

---

## R-09 — macOS 13+ Service Management API Differences for setLoginItemSettings

- **Likelihood**: medium
- **Impact**: low
- **Source / evidence**: FM-09 in `../01_research/21-failure-modes.md`; OQ-03 in `../01_research/23-open-questions.md`
- **Description**: On macOS 13+, `app.setLoginItemSettings({ openAtLogin: true })` returns a `status` of `'requires-approval'` for unsigned apps, meaning the user must manually approve in System Settings → General → Login Items. The `getLoginItemSettings().openAtLogin` getter returns `true` even when the item hasn't been approved, making behavioral tests misleading. The new `type: 'mainAppService'` option uses `SMAppService` but behavior is version-dependent.
- **Mitigation**:
  - In L4, assert `getLoginItemSettings().status` is inspected and logged — not just the boolean.
  - Document the "requires-approval" state as expected behavior in unsigned builds.
  - In capstone, show a UI prompt directing users to System Settings if `status === 'requires-approval'`.
- **Trigger to escalate**: `setLoginItemSettings` fails or throws on macOS 15.7.7 even in packaged signed build.

---

## R-10 — Auto-Update Test Environment Friction

- **Likelihood**: high
- **Impact**: medium
- **Source / evidence**: FM-11 in `../01_research/21-failure-modes.md`; `../01_research/18-auto-update.md`
- **Description**: `electron-updater` requires: (1) a signed app, (2) an `app-update.yml` embedded by `npm run make` (not `npm run package`), (3) a reachable HTTPS update server. Setting up all three locally is non-trivial. The `forceDevUpdateConfig = true` flag partially bypasses the signing check. A local HTTP server must serve a valid manifest JSON to exercise the update-check flow.
- **Mitigation**:
  - In L5, write `scripts/local-update-server.ts` serving a manifest at `http://localhost:8181/`.
  - Use `autoUpdater.setFeedURL({ provider: 'generic', url: 'http://localhost:8181' })` in test mode.
  - Set `forceDevUpdateConfig = true` during testing.
  - For the update download test, mock the download; assert `update-available` event fires with expected version.
- **Trigger to escalate**: `update-available` event never fires even with local server running and manifest valid.

---

## R-11 — Touch ID Unavailable on Review Machine

- **Likelihood**: medium
- **Impact**: low (degrades gracefully if planned)
- **Source / evidence**: OQ-09 in `../01_research/23-open-questions.md`; `../01_research/15-system-preferences-touchid.md`
- **Description**: `systemPreferences.promptTouchID()` throws or rejects if the machine lacks a Touch ID sensor or if the session is already authenticated. The capstone journal view is gated behind Touch ID. If the CI runner or review machine lacks Touch ID, the gate cannot be tested end-to-end.
- **Mitigation**:
  - Design the Touch ID gate to be injectable: accept a `promptFn: () => Promise<void>` parameter in the service; substitute a no-op mock in tests.
  - Implement a passphrase fallback that activates when `promptTouchID` throws with `'could not evaluate client requirements'`.
  - Document the fallback path in capstone README.
- **Trigger to escalate**: `promptTouchID` throws an unexpected error type not in the documented error strings.

---

## R-12 — Code Signing Cannot Be Exercised Without Apple Developer Account

- **Likelihood**: certain
- **Impact**: medium (notarization is the biggest risk surface; signing itself can be simulated)
- **Source / evidence**: `../01_research/17-code-signing-notarization.md`; command-intent.md constraints
- **Description**: Real code signing requires an `Apple Developer ID Application` certificate in the system keychain. Notarization requires an Apple ID, app-specific password, and team ID. Neither is available in this degree (per constraints). Packaging and hardened-runtime flags can be tested without signing. The auto-updater and notification delivery cannot be fully exercised in unsigned builds.
- **Mitigation**:
  - Skip signing/notarization by omitting `osxSign`/`osxNotarize` in Forge config OR by setting to conditional env-var check.
  - Produce `simulated-signing.md` documenting what production signing would look like, with exact CLI commands.
  - Use ad-hoc signing (`codesign --sign -`) for notification and updater tests where possible.
  - Mark all tests that require real signing as `skipIf(process.env.APPLE_IDENTITY === undefined)`.
- **Trigger to escalate**: Even ad-hoc signing fails for notification delivery testing (code path blocked earlier than expected).

---

## R-13 — Playwright `_electron` Instability in CI / macOS Sandboxing

- **Likelihood**: medium
- **Impact**: medium
- **Source / evidence**: `../01_research/20-testing-strategies.md` (Playwright Gotchas section)
- **Description**: `_electron` is under Playwright experimental APIs and may change between Playwright versions. Known issues: (1) `firstWindow()` has a 30s default timeout; if app shows no window (tray-only mode), the test hangs. (2) macOS CI runners (GitHub Actions macOS-latest) may have stricter sandboxing. (3) `evaluate()` serialization drops non-serializable values silently.
- **Mitigation**:
  - For tray-only capstone: use `electronApp.evaluate()` to assert process state without requiring a window; or open a temporary debug window in test mode.
  - Set explicit `timeout: 60_000` in Playwright config to avoid flaky timeouts.
  - Use `evaluateHandle()` instead of `evaluate()` for non-serializable values.
  - In CI: install Xcode CLT and ensure `DISPLAY` is not required (macOS runners support headless Electron).
- **Trigger to escalate**: Playwright `_electron` launch fails to produce a valid `ElectronApplication` handle on the CI runner.

---

## R-14 — POC Time Budget Overrun (Capstone Complexity)

- **Likelihood**: medium
- **Impact**: medium
- **Source / evidence**: command-intent.md ("capstone is intentionally hard"); degree-plan.md triage list
- **Description**: The capstone combines 8+ subsystems (SQLite, safeStorage, Touch ID, tray, notifications, shortcuts, deep links, powerMonitor, electron-updater, crashReporter, Playwright e2e). Integrating them into a coherent, polished app with full test coverage may exceed the allocated build time. Individual subsystem issues could cascade.
- **Mitigation**:
  - Build each subsystem as a separate module (file-per-concern: `tray.ts`, `session.ts`, `journal.ts`, etc.) before integration.
  - Apply the triage list from degree-plan.md if time runs out.
  - Set clear "minimum viable capstone" acceptance: boots as menu-bar app, tray functional, global shortcut toggles session, journal persists via SQLite (safeStorage/Touch ID optional extensions).
- **Trigger to escalate**: More than 2 subsystems remain unimplemented when 80% of allocated capstone time is consumed.

---

## R-15 — Doctrine-vs-Runtime Drift (Electron Releases Every ~8 Weeks)

- **Likelihood**: low (pinned to 42.1.0)
- **Impact**: medium
- **Source / evidence**: `../01_research/22-version-compatibility.md`
- **Description**: Electron releases a new major approximately every 8 weeks. The degree is pinned to 42.1.0. If the degree build spans multiple weeks, a new Electron release may introduce breaking changes (API deprecations, ABI bump, macOS compatibility changes). Research findings may drift from the pinned version's behavior.
- **Mitigation**:
  - Pin `"electron": "42.1.0"` (exact, not `^42`) in every POC's `package.json`.
  - Do not run `npm update` during the degree without checking the breaking changes document for the new version.
  - Record the exact Electron version in each POC's `commands.md`.
- **Trigger to escalate**: A POC fails with an error that looks like a runtime behavior change not present in the 42.1.0 breaking-changes docs.

---

## R-16 — Tray Icon Asset Path Differences (Dev vs Packaged)

- **Likelihood**: high
- **Impact**: medium
- **Source / evidence**: OQ-06 in `../01_research/23-open-questions.md`; `../01_research/07-tray-and-menus.md`
- **Description**: In development mode with Vite, `__dirname` points to the source file's directory. In a packaged app, it points inside `app.asar`. The tray icon path must be resolved differently for each environment. Vite may also rename asset files during the build step, breaking the `Template` suffix convention required for macOS dark-mode template images.
- **Mitigation**:
  - Use `app.isPackaged` to conditionally build the icon path: `process.resourcesPath` when packaged, `path.join(__dirname, '../assets')` when not.
  - Import icon via Vite's `?asset` query to ensure the file is included and path is correct.
  - Name tray images as `trayTemplate.png` and `trayTemplate@2x.png` to satisfy macOS template image convention.
  - Test icon loading in both dev and packaged mode in L4.
- **Trigger to escalate**: L4 POC shows a generic broken-image square instead of the tray icon in either dev or packaged mode.
