# BYB-03 — Before shipping an Electron app

Read this before `npm run make`. The final-mile work is non-trivial; build-out is the easy part.

## Code-signing prerequisites (macOS)

- **$99/yr Apple Developer Program membership.**
- **Developer ID Application certificate** installed in Keychain. To create: developer.apple.com → Certificates → "+" → "Developer ID Application".
- **App-Specific Password** for notarytool. To create: appleid.apple.com → Sign-In and Security → App-Specific Passwords.
- **Team ID** — 10-character string from developer.apple.com account page.
- **Bundle ID** declared in `forge.config.ts` (`appBundleId: 'com.example.pulse'`). Reverse-DNS form; must be unique to your developer account.

## The four artifacts that must exist

1. **Signed `.app` bundle** — `codesign --verify --deep --strict <App>.app` returns 0.
2. **Stapled notarization ticket** — `xcrun stapler validate <App>.app` returns 0.
3. **Gatekeeper acceptance** — `spctl --assess --type exec --verbose <App>.app` returns "accepted".
4. **Working auto-update channel** — `electron-updater` configured + manifest server reachable + signing cert MATCHES the previously-published version's cert (Apple verifies signature chain on update).

## The six fuses you must flip

`forge.config.ts` → `FusesPlugin`:

```typescript
[FuseV1Options.RunAsNode]: false,
[FuseV1Options.EnableCookieEncryption]: true,
[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
[FuseV1Options.EnableNodeCliInspectArguments]: false,
[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
[FuseV1Options.OnlyLoadAppFromAsar]: true,
```

(See P-14 for rationale.)

## The five things crashReporter requires

1. `crashReporter.start()` called BEFORE `app.whenReady()` (AP-06, P-13).
2. `submitURL` set OR `uploadToServer: false`.
3. Crash dumps directory exists: `app.setPath('crashDumps', ...)` BEFORE `crashReporter.start()` if customizing.
4. `productName` matches your app identity.
5. `globalExtra._companyName` set (replaces deprecated `companyName` option).

## Pre-flight checklist (production-readiness — see also `production-readiness-checklist.md`)

- [ ] `asar: true` in packagerConfig
- [ ] `AutoUnpackNativesPlugin` if you use native modules
- [ ] All 6 fuses set in `FusesPlugin`
- [ ] `osxSign` + `osxNotarize` blocks present (conditional on env if running unsigned in dev/CI)
- [ ] `entitlements.mac.plist` includes `cs.allow-jit`, `cs.disable-library-validation`, `network.client`
- [ ] `Info.plist.template` has `CFBundleURLTypes`, `LSUIElement` (if menu-bar-only), version, copyright
- [ ] `crashReporter.start()` at module-load scope, BEFORE `whenReady`
- [ ] `requestSingleInstanceLock` at module-load scope
- [ ] `open-url` listener attached BEFORE `whenReady`
- [ ] `electron-updater` wired with `provider: generic` (or GitHub/S3), `forceDevUpdateConfig` for dev tests
- [ ] No `nodeIntegration: true` anywhere
- [ ] No `ipcRenderer` exposed directly via contextBridge
- [ ] No `sendSync` calls
- [ ] No `file.path` access on the renderer (use `webUtils.getPathForFile`)
- [ ] Every `notification.show()` paired with `notification.on('failed', ...)`
- [ ] Every `globalShortcut.register` paired with `app.on('will-quit', () => globalShortcut.unregisterAll())`
- [ ] All `test:*` IPC channels gated behind `testHooksEnabled()`
- [ ] Tray reference is `let trayInstance: Tray | null` at module scope
- [ ] Structured JSON-lines logs to `app.getPath('logs')/main.log`

## Smoke tests on a clean machine

After producing the signed + notarized bundle, copy it to a clean Mac (or a fresh VM):

```bash
# Verify it runs
open /path/to/Pulse.app

# Verify deep link routes
open "pulse://start?duration=5"

# Verify auto-launch (sign in / out)
# Set in Settings → General → Login Items → "+" → Pulse

# Verify auto-update
# Modify the local fixture to point at a 9.9.9 manifest; launch packaged app;
# observe the update check + download in log.
```

If any of these fail, the production build is not ready.

## What you do NOT need to ship (school POC)

- Apple Developer creds (the simulated-signing.md skip path handles this — see L5 poc-report).
- Hosted update server (use a local fixture for tests).
- Crash sink (use `uploadToServer: false` + local minidumps).

## Evidence

- `03_pocs/L5-packaging-signing-update/poc-report.md`
- `03_pocs/L5-packaging-signing-update/forge.config.ts`
- `03_pocs/L5-packaging-signing-update/simulated-signing.md` (the full "real signing flow")
- `01_research/17-code-signing-notarization.md`
- `01_research/18-auto-update.md`
- `01_research/19-crash-reporting-and-observability.md`
