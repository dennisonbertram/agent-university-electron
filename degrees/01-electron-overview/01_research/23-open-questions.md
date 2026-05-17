# Open Questions — Electron

Research could not definitively answer these. Each has a hypothesis and verification method.

---

## OQ-01: Notification Actions in Unsigned Dev Builds

**Question**: Can `Notification` with `actions` (buttons) be tested without code signing, or do all notification features require signing?

**Context**: Docs say notifications require signing on macOS. But does the `failed` event fire for ALL notification features, or just for showing? Can actions be tested with system notification permissions?

**Hypothesis**: ALL notification display is blocked for unsigned apps. The `failed` event fires even for simple `title: 'test'` notifications. Actions and reply input are entirely untestable unsigned.

**Verify in**: L4 POC — call `notification.show()` in dev mode; observe `failed` event. Try with ad-hoc signing.

---

## OQ-02: globalShortcut in Sandboxed/MAS Builds

**Question**: Does `globalShortcut` work in a fully sandboxed app? Are there restrictions on which accelerators can be registered?

**Context**: Docs mention accessibility trust for media keys on macOS 10.14+, but are silent on sandbox/MAS restrictions. Apple's documentation suggests global keyboard access may be restricted in sandboxed apps.

**Hypothesis**: `globalShortcut` works in non-MAS builds with hardened runtime. MAS builds with full sandbox may fail to register some shortcuts. Media keys require accessibility trust regardless.

**Verify in**: L4 POC — test in development (no sandbox), then in hardened-runtime packaged build.

---

## OQ-03: Auto-Launch on macOS 13+ (Ventura+) Service Management API

**Question**: For a signed Electron app on macOS 13+, does `app.setLoginItemSettings({ openAtLogin: true })` use the new Service Management API transparently, or does it fall back to the deprecated old API that shows items in a different location?

**Context**: macOS 13 changed login items to use `SMAppService`. Electron 42 `setLoginItemSettings` has a `type` field added for macOS 13+. The old API items appear differently in System Settings.

**Hypothesis**: Without specifying `type: 'mainAppService'`, Electron uses the compatibility path (old API). Specifying `type` enables the new SM API and items appear under "Allow in the Background" in System Settings.

**Verify in**: L4 POC and capstone — test `setLoginItemSettings` results and `status` field on macOS 15.7.7.

---

## OQ-04: better-sqlite3 Universal Binary Rebuild

**Question**: What is the exact configuration needed for better-sqlite3 to be correctly rebuilt for BOTH arm64 and x64 in a universal binary build with Electron Forge?

**Context**: `@electron/rebuild` supports `--arch`, but building universal requires two separate rebuilds then a merge step. The AutoUnpackNativesPlugin may handle this, but exact configuration is undocumented in the sources consulted.

**Hypothesis**: Forge's universal maker with `AutoUnpackNativesPlugin` handles this automatically. The `rebuildConfig` may need `force: true`.

**Verify in**: L5 POC — run `npm run make -- --arch=universal` with better-sqlite3 installed; verify both arch native modules are correctly included.

---

## OQ-05: promptTouchID Entitlements for Packaged Hardened Runtime

**Question**: What exact entitlements are required in `entitlements.mac.plist` for `systemPreferences.promptTouchID` to work in a packaged, hardened-runtime app?

**Context**: The docs don't specify. Apple's documentation for `LAContext.evaluatePolicy` (which promptTouchID wraps) mentions `com.apple.security.cs.disable-library-validation` is often needed. But there may be additional entitlements.

**Hypothesis**: `com.apple.security.cs.disable-library-validation: true` in entitlements is required. Possibly also `com.apple.security.app-sandbox: false`.

**Verify in**: Capstone — attempt `promptTouchID` in a packaged, hardened-runtime build; observe error if entitlement missing.

---

## OQ-06: Tray Icon in Dev vs Packaged (Asset Path)

**Question**: In development with Vite bundler, how does `path.join(__dirname, 'assets/trayTemplate.png')` resolve? Does `__dirname` correctly point to assets, or does the Vite build change paths?

**Context**: Vite rewrites asset paths. In dev mode, `__dirname` is the source file's directory. In packaged mode, it's inside `app.asar`. Template image name preservation with Vite is known to be tricky.

**Hypothesis**: `__dirname` works differently in dev (source) vs packaged (asar). Must use `app.isPackaged` to conditionally build the path, OR use Vite's `?asset` import or `path.join(process.resourcesPath, 'assets/tray.png')` for packaged.

**Verify in**: L4 POC — test icon loading in both dev mode and packaged app.

---

## OQ-07: powerMonitor.querySystemIdleState vs getSystemIdleState

**Question**: Does a method called `querySystemIdleState` exist in Electron 42? Documentation mentions only `getSystemIdleState`.

**Context**: Some older Electron docs and community posts reference `powerMonitor.querySystemIdleState()` as an async variant. The current API page only shows `getSystemIdleState(threshold)` (synchronous).

**Hypothesis**: `querySystemIdleState` does not exist in Electron 42. The correct method is `getSystemIdleState(threshold)` which is synchronous.

**Verify in**: L4 POC — call `powerMonitor.getSystemIdleState(60)` and confirm it returns a string. Check if `powerMonitor.querySystemIdleState` exists.

---

## OQ-08: Notification Behavior in Focus/DND Mode on macOS

**Question**: If the user has enabled Focus (Do Not Disturb) or a Focus mode on macOS, do Electron `Notification` instances get silently suppressed? Is there any way to detect this state or override it?

**Context**: macOS Focus filters notifications. Most apps respect this. Electron notifications use UNUserNotificationCenter, which respects Focus filters. No mention in docs.

**Hypothesis**: Notifications are suppressed in DND/Focus mode unless the user grants permission exceptions. Electron provides no API to detect Focus state or bypass it. The `failed` event may or may not fire.

**Verify in**: L4 POC — enable DND, show notification, observe result. Check if `failed` fires.

---

## OQ-09: Electron Forge + Vite — Hot Reload in Main Process

**Question**: With Electron Forge's VitePlugin, when main.ts or preload.ts changes, does Electron restart automatically without manual intervention? What is the exact restart mechanism?

**Context**: Vite's HMR works for renderer. For main/preload changes, Electron Forge watches for changes and restarts the Electron process. The exact mechanism and latency are undocumented in sources consulted.

**Hypothesis**: Main/preload changes trigger a full Electron process restart (not HMR). Restart takes 2-5 seconds. The VitePlugin handles this via process-kill + relaunch.

**Verify in**: L1 POC — change main.ts while running; measure restart time.

---

## OQ-10: safeStorage Cross-Bundle-ID Migration

**Question**: If the app's bundle ID changes (e.g., from dev `com.example.myapp-dev` to production `com.example.myapp`), does safeStorage-encrypted data become unreadable? What is the migration path?

**Context**: safeStorage on macOS uses a Keychain key scoped to the app's bundle ID. A bundle ID change would create a new Keychain entry. Existing encrypted data would fail to decrypt.

**Hypothesis**: Yes, bundle ID change breaks decryption. Migration path: before changing bundle ID, decrypt all data with old key and re-encrypt with new key (requires running both versions simultaneously or a migration script).

**Verify in**: Capstone — create data with one bundle ID; change bundle ID; attempt decryption; observe `decryptString` error.

---

## OQ-11: Tray.popUpContextMenu Position Behavior (macOS vs Windows)

**Question**: On macOS, does `tray.popUpContextMenu([menu, position])` honor the `position` argument? Docs say position is honored on Windows only.

**Context**: Docs state the position parameter is "only honored on Windows". On macOS, the menu appears at the tray icon location automatically.

**Hypothesis**: On macOS, passing `position` to `popUpContextMenu` is silently ignored. The menu always appears at the tray icon. This is correct macOS behavior.

**Verify in**: L4 POC — call `tray.popUpContextMenu(menu, { x: 100, y: 100 })` on macOS; confirm menu appears at tray, not at (100,100).
