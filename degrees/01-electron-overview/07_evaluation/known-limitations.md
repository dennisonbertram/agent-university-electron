# Known Limitations — 01-electron-overview

This file is honest about what the degree did NOT cover, could NOT verify on this
hardware, or deliberately left out of scope. Future agents must read this file before
assuming any `@signed-only` or `@simulated` path in the skill pack is verified.

---

## Tested but Limited

### Unsigned-Build Notification Failures

Notifications were tested only on the failure path. On unsigned dev macOS, every
`notification.show()` call silently fails — the OS rejects it and the `failed` event
fires. The `failed` listener pattern (G-07, P-09) was fully exercised and passes in
the capstone (BT-C-3 uses the in-process seam; BT-L4-3 verifies the `failed` event
fires with a log marker). What was NOT tested: notification display on a signed build,
notification action button clicks through real OS UI, notification sound, notification
in Focus/DND mode (OQ-08).

Evidence: `03_pocs/L4-deep-macos-integration/poc-report.md` BT-L4-3 row.

### Notification Action Button Clicks

Action buttons (`Notification({ actions: [{ type: 'button', text: '...' }] })`) are
registered in the capstone's notification module but were tested only via the
`test:trigger-notification-action` IPC seam (BT-C-3). Real button clicks require a
signed build on macOS 12+. The `notification:action` log path is correct in shape;
whether macOS actually calls the handler in a signed build is not verified here.

Evidence: `03_pocs/L-capstone-pulse/poc-report.md` §"Honest deviations."

### Universal Binary Build

BT-L5-4 (verify universal binary produces working DMG) was tagged `@long-running`
and skipped in all CI-style runs. The `forge.config.ts` `arch: 'universal'` config is
present and passes a static source check (R-L5-2 passes), but the actual `npm run make
-- --arch=universal` invocation was not run end-to-end. Whether `better-sqlite3`'s
arm64 and x64 binaries correctly merge into the universal binary via
`AutoUnpackNativesPlugin` is open (OQ-04, OQ-13).

Evidence: `03_pocs/L5-packaging-signing-update/poc-report.md` BT-L5-4 row (1 skipped);
`05_distillation/open-questions.md` OQ-04.

### Touch ID Prompt

The `biometric.ts` module uses a real `systemPreferences.promptTouchID()` call when
`TOUCH_ID_UNAVAILABLE` is not set and `TOUCH_ID_FORCE_AVAILABLE` is set. Under the
Playwright test environment, the real biometric prompt was never invoked because:
(a) it requires a machine with an enrolled fingerprint and human presence, and (b) it
would hang the test indefinitely if no fingerprint is enrolled. BT-C-8 tests the
"available and succeeds" branch via the force-available env flag only. The real
`promptTouchID` codepath (calling into macOS LocalAuthentication.framework) is
untested. Entitlements for a hardened-runtime packaged build are also unverified (OQ-05).

Evidence: `03_pocs/L-capstone-pulse/poc-report.md` §"Touch ID test (BT-C-8)."

### Auto-Launch Round-Trip on Unsigned Dev

`app.setLoginItemSettings({ openAtLogin: true })` was observed to produce a
non-deterministic `openAtLogin` result from `getLoginItemSettings()` on the
enable side on macOS 14 with an unsigned dev binary. The behavior was reproduced
across three consecutive test runs. BT-L4-8 was weakened to only assert the invocation
log, not the OS-returned state. The full bidirectional round-trip (both enable and
disable sides reliably round-trip) is deferred to a signed packaged build on macOS 13+.

Evidence: `04_logs/expectation-gap-ledger.md` Entry 5; `05_distillation/gotchas/G-05`.

### `setLoginItemSettings` with Service Management on macOS 13+

Electron 32+ uses the new Service Management API (`type: 'mainAppService'`) for login
items on macOS 13+. The degree documented this in `01_research/12-dock-and-autolaunch.md`
but did not test the Service Management path at all. All autolaunch testing used the
legacy LSSharedFileList path (the default). Whether the Service Management API round-
trips reliably with a signed build on macOS 14+ is open (OQ-03).

Evidence: `05_distillation/open-questions.md` OQ-03.

---

## Documented but Not Exercised

### Real Apple Developer Code Signing

All code signing in this degree is simulated. When `APPLE_ID`, `APPLE_TEAM_ID`, and
`APPLE_APP_SPECIFIC_PASSWORD` environment variables are absent, the forge config's
conditional spread omits `osxSign` and `osxNotarize`, and the `packageAfterCopy` hook
writes `simulated-signing.md` instead. The commands that would execute on a real
signing machine are documented in `simulated-signing.md` and in
`06_skill_pack/lessons/09-code-signing-and-notarization.md`, but none of:
- `codesign --verify --deep --strict`
- `xcrun notarytool submit`
- `xcrun stapler staple`
- `spctl --assess --type exec`
...were executed. The signing walkthrough in PB-08 is documented as "simulated."

Evidence: `03_pocs/L5-packaging-signing-update/simulated-signing.md`;
`04_logs/deployment-log.md` Attempts 1-3 (all SIMULATED).

### Production Auto-Update Server

The auto-update path was exercised against a local Node HTTP server
(`scripts/local-update-server.mjs`) serving fixture YAML manifests. BT-L5-6 and
BT-L5-7 verify `update-available` and `update-not-available` events fire correctly.
What was NOT tested: a real remote server (S3 + CloudFront, GitHub Releases), real
binary download and integrity verification, real installation of the downloaded
package, and the actual update install/relaunch lifecycle.

Evidence: `03_pocs/L5-packaging-signing-update/poc-report.md` §"electron-forge introduced";
`05_distillation/playbooks/PB-09-wiring-electron-updater-with-local-fixture.md`.

### Real Crash Minidump Upload

`crashReporter.start()` is wired in both L5 and the capstone with a `submitURL`
pointing to a local fixture. The pre-ready startup order is verified (R-L5-1,
R-C-4). What was NOT tested: actually crashing the renderer, generating a real
minidump file, uploading it to a crash server, and reading the symbolicated stack
trace.

Evidence: `03_pocs/L5-packaging-signing-update/poc-report.md` §"What landed — crash.ts";
`05_distillation/open-questions.md` (no OQ entry for this — it was documented as
"wiring verified; minidump upload not verified" in the capstone poc-report).

### Cross-Platform (Windows / Linux)

All POCs were built and tested on macOS (Apple Silicon / arm64). Windows and Linux are
documented in the research files but were not actively built for. Surfaces that behave
differently cross-platform include: notifications (different presentation APIs), Tray
(available on Linux/Windows but rendered differently), deep links (handled via
`second-instance` on Windows/Linux, not `open-url`), auto-launch (different mechanism
on each OS), packaging makers (NSIS for Windows, Snap/AppImage/deb for Linux).

Evidence: `00_metadata/scope.md`; `01_research/01-capabilities-overview.md`
(cross-platform notes throughout).

---

## Out of Scope by Design

The following topics were explicitly excluded in `docs/context/command-intent.md`
and `00_metadata/scope.md`:

- **Building Electron from source** — out of scope.
- **Custom Chromium patches** — out of scope.
- **Mobile / Capacitor** — out of scope.
- **Production CI/CD pipelines** — capstone is locally packaged; no pipeline to a
  distribution channel was built or documented beyond the `npm run make` command.
- **Windows-specific code signing / MSIX** — out of scope.
- **Linux-specific packaging (Snap, AppImage, deb)** — research-mentioned, not built.
- **Tauri / NW.js comparison** — documented only in expectation-gap context; not a
  comparison degree.
- **App Store (MAS) submission** — MAS sandboxing and `globalShortcut` in MAS builds
  are documented as open questions (OQ-02) but the degree does not target MAS.

---

## Open Questions Carried Forward

From `05_distillation/open-questions.md` (15 items):

| ID | Question | Status |
|----|----------|--------|
| OQ-01 | Can `Notification` with `actions` (buttons) be tested unsigned? | Partially answered: basic show fails; action buttons require signing. Handler-invocation path tested via IPC seam only. |
| OQ-02 | `globalShortcut` in MAS (App Store) sandboxed builds | Not verified. MAS build not produced in this degree. |
| OQ-03 | `setLoginItemSettings` with Service Management API on macOS 13+ (signed) | Not verified. Non-determinism documented for unsigned dev; signed-build round-trip deferred. |
| OQ-04 | `better-sqlite3` universal binary rebuild (both arches, fat binary) | Not exercised. BT-L5-4 skipped as `@long-running`. Config correct; build not run. |
| OQ-05 | `promptTouchID` entitlements for hardened-runtime packaged build | Not verified. Env-flag stub only. Real biometric prompt requires enrolled fingerprint + user presence. |
| OQ-06 | Tray icon asset path (`process.resourcesPath` vs `__dirname`) when shipping real PNGs | Partially answered: embedded base64 buffer sidesteps the problem. Real per-state PNGs not shipped. |
| OQ-07 | `powerMonitor.querySystemIdleState` vs `getSystemIdleState` | Answered: `querySystemIdleState` does not exist in Electron 42; `getSystemIdleState(threshold)` is the synchronous API. |
| OQ-08 | Notification behavior in Focus / DND mode on macOS | Not verified. Requires a signed build + manual Focus-mode enable during test. |
| OQ-09 | `electron-forge` + Vite hot reload in main process | Not tested. Degree uses `tsc + esbuild` build chain throughout. |
| OQ-10 | `safeStorage` decryption across bundle-ID migration | Not verified. Hypothesis: bundle-ID change breaks decryption. |
| OQ-11 | `Tray.popUpContextMenu` position behavior on macOS | Documented, not tested. macOS silently ignores explicit `position` argument on some versions. |
| OQ-12 | `fs.watch` rename latency tightening (sub-200ms) | Accepted with slack at `< 1500ms`. Sub-200ms requires `@parcel/watcher` or `chokidar`. |
| OQ-13 | Universal binary + `better-sqlite3` V8 patch script on x64 | Not tested. Patch targets V8 version preprocessors; should work for x64 but unverified. |
| OQ-14 | `LSUIElement: true` in dev vs `app.dock.hide()` | Confirmed in parallel (BT-C-10): both paths exercised. |
| OQ-15 | Real notarization timing in 2026 | Simulated only. No Apple Dev creds in environment. |
