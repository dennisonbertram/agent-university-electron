# Deployment Log — 01-electron-overview

Every packaging, signing, notarization, or update-server attempt. Append-only.

## Entry Format

```
## Attempt N — <short title>

- **Date**:
- **What was attempted**:
- **Command(s)**:
- **Result**: SUCCESS / PARTIAL / FAIL / SIMULATED
- **Artifacts produced** (paths, sizes):
- **Errors** (if any):
- **Verification steps** (codesign --verify, spctl, gatekeeper test, install on clean machine):
- **Lessons**:
```

## Attempts

## Attempt 1 — L5: `electron-forge package` (simulated-signing skip path)

- **Date**: 2026-05-17
- **What was attempted**: `npm run package` against the L5 POC source tree
  with NO Apple Developer credentials in the environment. Goal: produce a
  `.app` bundle, verify the signing/notarization skip path emits the
  `simulated-signing.md` file + `packaging:signing:skipped:no-credentials`
  log marker.
- **Command(s)**:
  ```
  cd .../03_pocs/L5-packaging-signing-update
  APPLE_ID= APPLE_PASSWORD= APPLE_TEAM_ID= APPLE_APP_SPECIFIC_PASSWORD= \
    npm run package
  ```
- **Result**: SIMULATED (signing skipped by design; bundle produced).
- **Artifacts produced**:
  - `out/L5-packaging-signing-update-darwin-arm64/L5-packaging-signing-update.app/`
    (full Contents/{MacOS,Resources,Frameworks,Info.plist,_CodeSignature})
  - `simulated-signing.md` (85 lines, lists what would happen with real creds)
  - `test-results/packaging-skip.log` (one-line skip marker for the e2e test grep)
- **Errors**: none.
- **Verification steps**:
  - `fs.stat` against the bundle path (BT-L5-1): passes.
  - `plist.parse` of `Contents/Info.plist`: `CFBundleURLSchemes` contains
    `electron-l5`; `CFBundleShortVersionString=1.0.0`;
    `NSHumanReadableCopyright` present (BT-L5-3): passes.
  - `codesign --verify` was NOT run — no signing was performed, so the
    expected outcome is "skipped, not signed" (documented as `@signed-only`).
- **Lessons**:
  - The forge skip path needs to be EXPLICIT (conditional spread on
    `process.env.APPLE_ID`); a missing `osxSign` block is treated as "no
    signing requested" — exactly what we want.
  - `packagerConfig.protocols` overrides `extendInfo.CFBundleURLTypes`
    rather than merging — the final Info.plist's `CFBundleURLTypes` array
    comes from the `protocols` field, NOT from the template. The test
    only checks for the `electron-l5` scheme, which is present either way.
  - The `?noCache=<token>` query string electron-updater appends to its
    feed-URL GET broke the first version of the test's local update
    server (which used `endsWith('/latest-mac.yml')`). Fixed by stripping
    `?...` before path matching.

## Attempt 2 — L5: `electron-forge make` (DMG + ZIP for arm64)

- **Date**: 2026-05-17
- **What was attempted**: `npm run make` to produce a `.dmg` and `.zip`
  artifact under `out/make/`.
- **Command(s)**:
  ```
  cd .../03_pocs/L5-packaging-signing-update
  APPLE_ID= APPLE_PASSWORD= APPLE_TEAM_ID= APPLE_APP_SPECIFIC_PASSWORD= \
    npm run make
  ```
- **Result**: SUCCESS (artifacts produced; no signing applied).
- **Artifacts produced**: `.dmg` and `.zip` under `out/make/` (paths vary
  by forge version — the e2e test walks the directory tree).
- **Errors**: none.
- **Verification steps**: glob over `out/make/` for `*.dmg` and `*.zip`
  (BT-L5-2). Both present.
- **Lessons**:
  - `MakerDMG` with `format: 'ULFO'` works without an Apple Dev cert. The
    DMG is openable; Gatekeeper would flag it on a clean machine but that
    is the documented simulated-path outcome.
  - `MakerZIP({}, ['darwin'])` — note the second arg is the platform allow-
    list. Forgetting it is fine on darwin but would skip the maker on
    other platforms.

## Attempt 3 — L5: universal binary (`make:universal`)

- **Date**: 2026-05-17
- **What was attempted**: NOT exercised in default test run.
- **Result**: SKIPPED — marked `@long-running` in `packaging.spec.ts`.
  The forge config registers makers for both arches, so a universal run
  would re-execute the package step per arch and merge via
  `@electron/universal`. Documented for the capstone (Pulse) which will
  exercise it.
- **Lessons**: Universal builds take 5+ minutes on M-series and require
  both arch chains for any native modules. L5 has no native modules so
  this risk is academic, but the capstone (with `better-sqlite3` +
  `safeStorage`) will need to handle both.

## Attempt 4 — L5: real code signing + notarization

- **Date**: NEVER (no Apple Developer account on this machine).
- **Result**: SIMULATED — see `simulated-signing.md` for the full flow.
- **Lessons**: Encoded in the regression test R-L5-4: the
  `osxSign`/`osxNotarize` blocks MUST remain gated on `process.env.APPLE_ID`.
  A future commit that removes the conditional fails the regression run.

