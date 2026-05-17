# L5 Test Plan

Mapping each behavioral / regression test to its file, the assertion it
makes, and the kind of failure it surfaces if regressed.

## Behavioral tests (BT-L5-N)

| ID       | File                                    | Test                                                                                                  | Failure mode if regressed                                                                                |
|----------|-----------------------------------------|-------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| BT-L5-1  | `tests/e2e/packaging.spec.ts`           | `npm run package` produces `<App>.app` with `Contents/MacOS/<exe>`, `Resources/app.asar`, `Info.plist` | forge config drift (wrong productName / arch); ignore rules over-pruning sources                          |
| BT-L5-2  | `tests/e2e/packaging.spec.ts`           | `npm run make` produces `*.dmg` AND `*.zip` under `out/make/`                                          | MakerDMG or MakerZIP removed/disabled; platform allow-list mismatch                                       |
| BT-L5-3  | `tests/e2e/packaging.spec.ts`           | Packaged `Info.plist` has `CFBundleURLTypes` (electron-l5), `CFBundleShortVersionString`, `NSHumanReadableCopyright` | `packagerConfig.protocols` removed; `extendInfo` stops merging the template                       |
| BT-L5-4  | `tests/e2e/packaging.spec.ts`           | Universal binary build                                                                                | SKIPPED (`@long-running`). Manually verified once; forge config has both arches registered through makers |
| BT-L5-5  | `tests/e2e/signing-simulation.spec.ts`  | No Apple creds → `simulated-signing.md` written + `packaging-skip.log` marker present                  | `packageAfterCopy` hook removed; `HAS_APPLE_CREDS` gate inverted                                          |
| BT-L5-6  | `tests/e2e/updater.spec.ts`             | Newer manifest version → `updater:update-available` log entry fires                                    | Updater wiring broken; `forceDevUpdateConfig` removed; provider changed                                   |
| BT-L5-7  | `tests/e2e/updater.spec.ts`             | Same manifest version → `updater:update-not-available` log entry fires (and `update-available` does NOT) | Manifest comparator regressed; same/different-version detection swapped                                 |
| BT-L5-8  | `tests/e2e/crash-reporter.spec.ts`      | `crashReporter.start()` is wired; `startedBeforeWhenReady=true`; `getUploadedReports()` callable        | Crash module moved inside `whenReady()` callback; `submitURL` resolution broken                          |
| BT-L5-9  | `tests/e2e/packaging.spec.ts`           | `entitlements.mac.plist` declares allow-jit, disable-library-validation, network.client                | Hardened-runtime entries removed                                                                          |
| BT-L5-10 | `tests/e2e/packaged-boot.spec.ts`       | Packaged `.app` spawned; logs `app:starting` and `app:ready` in LOG_DIR                                | Bundle launches but crashes; LOG_DIR override not respected                                              |

## Regression tests (R-L5-N)

| ID     | File                                          | Test                                                                                       | Failure mode if regressed                                                                       |
|--------|-----------------------------------------------|--------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| R-L5-1 | `tests/e2e/regression.spec.ts`, `tests/unit/crash-start-ordering.test.ts` | `startCrashReporter(` call appears BEFORE `.whenReady(` in `src/main.ts`               | crashReporter moved inside whenReady or after — silently drops renderer monitoring               |
| R-L5-2 | `tests/e2e/regression.spec.ts`, `tests/unit/forge-config.test.ts` | `forge.config.ts` has `FusesPlugin` with `RunAsNode:false` + `EnableNodeOptionsEnvironmentVariable:false` | Hardening fuses removed — attacker can spawn the packaged app as a node interpreter        |
| R-L5-3 | `tests/e2e/regression.spec.ts`, `tests/unit/updater-config.test.ts` | `src/updater.ts` uses `provider:'generic'` (NEVER 'github'/'s3')                  | Updater switched to a provider that needs real auth — breaks the local-fixture test pattern     |
| R-L5-4 | `tests/e2e/regression.spec.ts`, `tests/e2e/signing-simulation.spec.ts` | `forge.config.ts` gates `osxSign` + `osxNotarize` on `process.env.APPLE_ID`     | Conditional removed — CI run without creds would fail loudly instead of skipping cleanly         |
| R-L5-5 | `tests/e2e/regression.spec.ts`, `tests/unit/info-plist-template.test.ts` | `Info.plist.template` AND packaged `Info.plist` declare `CFBundleURLTypes` with `electron-l5` | Deep-link registration lost — packaged app can no longer be launched via `electron-l5://` URL  |

## Skipped categories

### `@signed-only` (require Apple Dev cert)

These were intentionally NOT added to the suite because they would always
fail on this machine for an unrelated reason. Documented in
`simulated-signing.md`:

- `codesign --verify --deep --strict <App>.app` → 0
- `xcrun stapler validate <App>.app` → success
- `spctl --assess --type exec <App>.app` → "source=Notarized Developer ID"

### `@long-running` (universal binary)

- BT-L5-4: `npm run make:universal`. Forge config has the makers registered
  for both arches; the actual run takes 5+ minutes. Marked skip and
  manually verified once.

## How a future commit reaches RED in this POC

1. Touching `forge.config.ts`:
   - Remove `FusesPlugin` → R-L5-2 fails.
   - Remove the `process.env.APPLE_ID` ternary → R-L5-4 fails.
   - Remove `MakerDMG`/`MakerZIP` → BT-L5-2 fails after re-run.
2. Touching `src/main.ts`:
   - Move `startCrashReporter(` below `app.whenReady()` → R-L5-1 fails.
3. Touching `src/updater.ts`:
   - Change `provider` to anything other than `generic` → R-L5-3 fails;
     BT-L5-6/7 likely also fail at runtime.
4. Touching `entitlements.mac.plist`:
   - Remove `cs.allow-jit=true` → BT-L5-9 fails. (Notarization would also
     fail in production but that's not in the suite.)
5. Touching `Info.plist.template`:
   - Remove `CFBundleURLTypes` → R-L5-5 fails (template assertion).
6. Touching `packagerConfig.protocols`:
   - Remove the electron-l5 entry → R-L5-5 fails (packaged-plist
     assertion).

## Performance budget

Recorded May 17, 2026 on M-series macOS 15.7.7, node 24.15.0, npm 11.12.1.

| Stage              | Time (cold)  | Time (warm-memo) |
|--------------------|--------------|------------------|
| `tsc -p`           | ~3s          | ~1s              |
| `npm run build`    | ~4s          | ~2s              |
| `npm run package`  | ~30s         | reused           |
| `npm run make`     | ~10s (after package) | reused   |
| `npx vitest run`   | ~1s          | ~1s              |
| `npx playwright test` (full, with package memo'd) | ~12s | ~12s |
| `npx playwright test` (full, including first package) | ~50s | ~12s |
