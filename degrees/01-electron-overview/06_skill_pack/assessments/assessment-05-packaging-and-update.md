# Assessment 05 — Packaging, Signing, and Auto-Update

Tests understanding of Electron Forge, asar, fuses, code signing, and electron-updater.

Back to [../index.md](../index.md) | [assessment-04-macos-integration.md](./assessment-04-macos-integration.md) | [assessment-06-capstone-readiness.md](./assessment-06-capstone-readiness.md)

---

## Questions

**Q1.** After running `npm run package`, a tester reports that the app crashes on launch with `Error: Cannot find module 'dist/main.js'`. What are the two most likely causes and how do you verify each?

**Q2.** Why must `asar: true` be set in `packagerConfig` when `OnlyLoadAppFromAsar: true` fuse is enabled? What exactly happens at runtime if asar is false but the fuse is true?

**Q3.** `npx @electron/asar list app.asar | grep '\.ts$'` returns TypeScript files. What is the consequence, and what configuration change fixes it?

**Q4.** Describe the G-09 gotcha: using both `packagerConfig.protocols` AND `extendInfo.CFBundleURLTypes`. What symptom appears and what is the fix?

**Q5.** `osxSign` is configured unconditionally in `forge.config.ts`. A CI job for feature branches (no Apple credentials) tries to build. What happens? How do you fix it?

**Q6.** What is `forceDevUpdateConfig` and why does it require a TypeScript type cast? What happens in development if it is not set?

**Q7.** A developer sets up `electron-updater` with a local fixture server. The update `version: 9.9.9` is higher than the app's `package.json` version `1.0.0`. `checkForUpdatesAndNotify()` is called. The `update-available` event never fires. Name 3 possible causes.

**Q8.** The `xcrun stapler validate` command returns `Could not find stapled notarization ticket`. What does this mean and what must be done?

---

## Answer Key

**A1.**
- Cause 1: `package.json` `"main"` field points to `src/main.ts` instead of `dist/main.js`. Verify: `cat package.json | grep '"main"'` — must be `"dist/main.js"`.
- Cause 2: `npm run build` was not run before `npm run package`. The `dist/` directory doesn't exist or is stale. Verify: `ls -la dist/main.js` — check the modification time. Fix: `npm run build && npm run package`.

**A2.** `OnlyLoadAppFromAsar: true` is a binary-level fuse that makes Electron refuse to load app code from a plain directory. When this fuse is set but `asar: false`, Forge creates a directory-based bundle (no `app.asar` file). At launch, Electron checks for `app.asar`, doesn't find it, and fails to boot: the app crashes with an error about not finding the asar file. Both must be consistently set: `asar: true` in packagerConfig AND `OnlyLoadAppFromAsar: true` in FusesPlugin.

**A3.** Consequence: the packaged app contains `.ts` TypeScript source files. Electron cannot execute TypeScript natively. If any of these files are loaded (e.g., if `main.ts` is referenced in `package.json` instead of `dist/main.js`), the app crashes. Even if not loaded, it wastes bundle size and leaks source code. Fix: add an `ignore` pattern to `packagerConfig`:
```typescript
ignore: [/^\/src\//, /\.ts$/, /^\/tests?\//, /forge\.config\./, /tsconfig/]
```

**A4.** G-09: `packagerConfig.protocols` generates a `CFBundleURLTypes` entry in `Info.plist`. If `extendInfo.CFBundleURLTypes` is ALSO set, Forge merges them, but one typically overrides or duplicates the other depending on Forge version. Symptom: deep links don't work, or the wrong scheme is registered, or both schemes appear with one being incomplete. Fix: use exactly ONE mechanism. Recommended: `packagerConfig.protocols`. Remove any `CFBundleURLTypes` from `extendInfo`. Verify: `plutil -p <App>.app/Contents/Info.plist | grep -A5 CFBundleURLTypes` — should show exactly the intended entries.

**A5.** If `osxSign` is configured unconditionally, Forge will attempt to sign on every build. Without `APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_APP_SPECIFIC_PASSWORD`, the signing step fails and the entire build fails. CI feature branches can't produce any build at all. Fix: use the `HAS_APPLE_CREDS` conditional pattern:
```typescript
const HAS_APPLE_CREDS = Boolean(process.env.APPLE_ID && process.env.APPLE_TEAM_ID && ...)
...(HAS_APPLE_CREDS && { osxSign: { ... }, osxNotarize: { ... } })
```
Only signing CI environments (main branch / release builds) set the credentials.

**A6.** `forceDevUpdateConfig` is an `electron-updater` runtime property that enables update checking when `app.isPackaged` is false (i.e., in development). The TypeScript type definitions for `autoUpdater` (from `electron-updater`) don't include this property in the type — it was added as an undocumented runtime escape hatch. Therefore TypeScript rejects `autoUpdater.forceDevUpdateConfig = true` as a type error. Fix: `(autoUpdater as any).forceDevUpdateConfig = true`. Without it in development, `checkForUpdatesAndNotify()` silently does nothing — the updater checks `isPackaged` and skips.

**A7.** Possible causes:
1. `forceDevUpdateConfig` not set (G-10) — updater silently skips check in development
2. Server not running or returns 404 — `curl http://localhost:8080/latest-mac.yml` fails; server not started
3. Server returns 404 for URL with `?noCache=<token>` (G-08) — `electron-updater` appends cache-busting query; server must strip it

**A8.** The app was notarized (Apple scanned it), but the notarization ticket was not stapled to the `.app` bundle. Stapling embeds the ticket in the bundle so Gatekeeper can verify it offline. Without stapling, Gatekeeper must contact Apple's servers to verify — this fails when offline. What must be done: `xcrun stapler staple <App>.app`, then verify with `xcrun stapler validate <App>.app` → "The validate action worked!". In Forge with `osxNotarize` configured, stapling happens automatically. If done manually: submit with `xcrun notarytool submit --wait`, then staple.

---

## Relevant Files

- [../lessons/08-packaging-with-electron-forge.md](../lessons/08-packaging-with-electron-forge.md)
- [../lessons/09-code-signing-and-notarization.md](../lessons/09-code-signing-and-notarization.md)
- [../lessons/10-auto-update.md](../lessons/10-auto-update.md)
- [../recipes/recipe-forge-config-with-fuses.md](../recipes/recipe-forge-config-with-fuses.md)
- [../recipes/recipe-electron-updater-generic-provider.md](../recipes/recipe-electron-updater-generic-provider.md)
- [../checklists/packaging-checklist.md](../checklists/packaging-checklist.md)
- [../checklists/production-readiness-checklist.md](../checklists/production-readiness-checklist.md)
- [../troubleshooting/packaged-app-wont-launch.md](../troubleshooting/packaged-app-wont-launch.md)
- [../troubleshooting/code-signing-failure.md](../troubleshooting/code-signing-failure.md)
