# L5 — Packaging, Code Signing, Auto-Update

POC #5. Introduces `electron-forge` (deferred from L1 per Decision 1) and
wires three new subsystems on top of the L4 menu-bar shell:

1. **Packaging** — `npm run package` and `npm run make` produce real
   distributable artifacts (`.app`, `.dmg`, `.zip`) for darwin-arm64.
   Universal binaries are supported by the config but not exercised in
   the default test run (`@long-running`).
2. **Signing / Notarization** — entirely SIMULATED because no Apple
   Developer account is available on this machine. The forge config
   guards `osxSign` + `osxNotarize` behind `process.env.APPLE_ID`. When
   no creds are in the env, the `packageAfterCopy` hook emits a
   `simulated-signing.md` file describing the full real-credentials flow,
   plus a `test-results/packaging-skip.log` marker for the e2e test.
3. **Auto-Update** — `electron-updater` configured with `provider:generic`
   against a Node HTTP server serving a `latest-mac.yml` manifest from
   `scripts/fixtures/`. A test-only IPC channel (`test:check-for-updates`)
   drives the updater explicitly so the Playwright spec can assert the
   `update-available` / `update-not-available` event without packaging.
4. **crashReporter** — `crashReporter.start()` is invoked at module-load
   time in `src/main.ts`, BEFORE the ready promise resolves. R-L5-1
   enforces this statically.

## Quick start

```bash
npm install              # one-time
npm run build            # tsc + esbuild preload + copy renderer
npm run start            # dev run via electron-forge (uses dist/)

# Packaging
npm run package          # produces out/<name>-darwin-arm64/<name>.app
npm run make             # adds out/make/{dmg,zip}/...
npm run make:universal   # universal arm64+x64 binary (slow; ~5 min)

# Tests
npm test                 # vitest (unit)
npm run test:e2e         # Playwright (e2e)
```

Default feed/sink URLs (used by `src/updater.ts` and `src/crash.ts`):
- `UPDATE_URL` — `http://127.0.0.1:8765/updates`
- `CRASH_URL`  — `http://127.0.0.1:8766/crashes`

Both are overridable by env var. Neither server has to actually exist for
the wiring tests to pass — the assertion is on the log events, not on
receipt.

## Behavioral test status

| Test     | Description                                                                                       | Status                |
|----------|---------------------------------------------------------------------------------------------------|-----------------------|
| BT-L5-1  | `npm run package` produces a `.app` bundle with MacOS/Resources/Info.plist                        | PASS                  |
| BT-L5-2  | `npm run make` produces a `.dmg` AND a `.zip` artifact under `out/make/`                          | PASS                  |
| BT-L5-3  | packaged `Info.plist` has `CFBundleURLTypes` (electron-l5) + version + copyright                  | PASS                  |
| BT-L5-4  | universal binary build                                                                            | **SKIP** @long-running |
| BT-L5-5  | no Apple creds → signing/notarization skipped + `simulated-signing.md` emitted                    | PASS                  |
| BT-L5-6  | newer-version manifest → `update-available` event + log                                           | PASS                  |
| BT-L5-7  | same-version manifest → `update-not-available` event + log                                        | PASS                  |
| BT-L5-8  | `crashReporter.start()` is wired pre-ready; `getUploadedReports()` is reachable                   | PASS                  |
| BT-L5-9  | `entitlements.mac.plist` declares the required hardened-runtime entries                           | PASS                  |
| BT-L5-10 | packaged `.app` emits canonical lifecycle log entries on boot                                     | PASS                  |
| R-L5-1   | `crashReporter.start()` call appears BEFORE `app.whenReady()` in `src/main.ts`                    | PASS                  |
| R-L5-2   | `forge.config.ts` registers `FusesPlugin` with `RunAsNode:false` + `EnableNodeOptionsEnvironmentVariable:false` | PASS  |
| R-L5-3   | `src/updater.ts` uses `provider:'generic'` (NEVER 'github' / 's3')                                | PASS                  |
| R-L5-4   | `forge.config.ts` gates `osxSign` + `osxNotarize` on `process.env.APPLE_ID`                       | PASS                  |
| R-L5-5   | `Info.plist.template` AND the packaged `Info.plist` declare `CFBundleURLTypes` with electron-l5   | PASS                  |

The `@signed-only` tests (`codesign --verify`, `xcrun stapler validate`,
`spctl --assess`) are NOT included in the suite — they require an Apple
Developer cert and would fail on this machine for reasons unrelated to
the POC. See `simulated-signing.md` for the commands a developer with
creds would run.

## Layout

```
L5-packaging-signing-update/
├── README.md                       (this file)
├── test-plan.md                    (mapping BT/R tests → test files)
├── poc-report.md                   (decisions, findings, invariants)
├── simulated-signing.md            (auto-generated by forge skip hook)
├── package.json
├── tsconfig.json / tsconfig.test.json
├── forge.config.ts                 (electron-forge configuration)
├── entitlements.mac.plist          (hardened-runtime entitlements)
├── Info.plist.template             (CFBundleURLTypes, version, copyright)
├── playwright.config.ts            (5-min test timeout for packaging)
├── vitest.config.ts
├── scripts/
│   ├── build-preload.mjs           (esbuild bundle of src/preload.ts)
│   ├── copy-renderer.mjs           (copies *.html into dist/renderer/)
│   ├── local-update-server.mjs     (manual update-server driver)
│   └── fixtures/
│       ├── latest-mac.yml.update   (version 1.0.1 → triggers update-available)
│       └── latest-mac.yml.current  (version 1.0.0 → triggers update-not-available)
├── src/                             (carried forward from L4 + L5 additions)
│   ├── main.ts                     (crashReporter.start() at module-load)
│   ├── crash.ts                    (NEW — crashReporter wrapper)
│   ├── updater.ts                  (NEW — electron-updater wiring)
│   ├── ipc.ts                      (extended with L5 test seams)
│   ├── ipc-validation.ts           (extended with L5 validators)
│   ├── preload.ts                  (exposes L5 test IPC)
│   └── ... (autolaunch, dock, lifecycle, log, menu, notifications, power,
│            protocol, security, shortcuts, storage, theme, tray, watch,
│            window — all from L4, with the deep-link scheme renamed to
│            electron-l5)
└── tests/
    ├── unit/                       (vitest)
    │   ├── forge-config.test.ts
    │   ├── entitlements.test.ts
    │   ├── info-plist-template.test.ts
    │   ├── updater-config.test.ts
    │   ├── crash-start-ordering.test.ts
    │   └── ... (carry-forward from L4)
    └── e2e/                        (Playwright)
        ├── helpers.ts              (launchApp, runPackage, runMake,
        │                            launchPackagedApp, startUpdateServer)
        ├── packaging.spec.ts       (BT-L5-1, BT-L5-2, BT-L5-3, BT-L5-4,
        │                            BT-L5-9)
        ├── signing-simulation.spec.ts (BT-L5-5)
        ├── updater.spec.ts         (BT-L5-6, BT-L5-7)
        ├── crash-reporter.spec.ts  (BT-L5-8)
        ├── packaged-boot.spec.ts   (BT-L5-10)
        └── regression.spec.ts      (R-L5-1..R-L5-5)
```

## Build chain choice

This POC keeps the L4 build chain (tsc + esbuild for preload + static copy
for renderer) and wraps it with electron-forge via the `prepackage` /
`premake` npm scripts. The alternative — scaffolding a fresh Vite +
electron-forge template and porting the L4 source into it — would have
required rewriting preload bundling for Vite's plugin pipeline, with no
behavior payoff for L5's specific test surface. Decision recorded in
`04_logs/decision-log.md` (Decision 11).

## Re-running the slow tests

The Playwright spec memoizes `npm run package` and `npm run make`: only
one of each runs per test session, regardless of how many specs depend
on the output. To force a full re-package, delete `out/` first:

```bash
rm -rf out/
npx playwright test
```

Expect ~30-60s for package + ~10s for make on M-series hardware.
