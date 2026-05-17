# Packaging Checklist — Electron App

Verify before running `npm run make` for distribution.

## Pre-Package

| # | Item | How to Verify |
|---|---|---|
| 1 | `npm run build` produces `dist/main.js`, `dist/preload.js`, `dist/renderer/` | `ls dist/` |
| 2 | `package.json` `"main"` points to `dist/main.js` | Read `package.json` |
| 3 | `package.json` `"version"` is the correct release version | Read |
| 4 | `appBundleId` in `forge.config.ts` is correct and consistent | Read |
| 5 | `asar: true` in `packagerConfig` | Read |

## Ignore List

| # | Item | How to Verify |
|---|---|---|
| 6 | `src/` excluded from bundle | `npx @electron/asar list app.asar \| grep '\.ts$'` → empty |
| 7 | `tests/` excluded | Same → no test files |
| 8 | `forge.config.ts`, `playwright.config.ts`, `vitest.config.ts` excluded | Same |
| 9 | `tsconfig*.json` excluded | Same |
| 10 | `test-results/`, `test-output/`, `.git/` excluded | Same |
| 11 | `node_modules/.cache` NOT included | Bundle size is reasonable |

## Native Modules

| # | Item | How to Verify |
|---|---|---|
| 12 | `AutoUnpackNativesPlugin` in `plugins` (if app uses native modules) | Source check `forge.config.ts` |
| 13 | `electron-rebuild` run before packaging | `package.json` `prepackage` script or manual step |
| 14 | `.node` files are in `app.asar.unpacked` | `ls <App>.app/Contents/Resources/app.asar.unpacked/` |

## Fuses

| # | Item | How to Verify |
|---|---|---|
| 15 | `RunAsNode: false` | Static check `forge.config.ts` |
| 16 | `EnableCookieEncryption: true` | Static check |
| 17 | `EnableNodeOptionsEnvironmentVariable: false` | Static check |
| 18 | `EnableNodeCliInspectArguments: false` | Static check |
| 19 | `EnableEmbeddedAsarIntegrityValidation: true` | Static check |
| 20 | `OnlyLoadAppFromAsar: true` | Static check |

## Info.plist

| # | Item | How to Verify |
|---|---|---|
| 21 | `CFBundleURLTypes` present for custom URL scheme | `plutil -p <App>.app/Contents/Info.plist` |
| 22 | `LSUIElement: true` for menu-bar apps | Same |
| 23 | `CFBundleShortVersionString` matches package.json version | Compare values |
| 24 | `CFBundleIdentifier` matches `appBundleId` | Compare |

## Post-Package Verification

| # | Item | How to Verify |
|---|---|---|
| 25 | App launches from `out/` directory | `open out/<App>-darwin-arm64/<App>.app` |
| 26 | No `.ts` source files leaked into bundle | `npx @electron/asar list app.asar \| grep '\.ts$'` |
| 27 | `app.asar` size is reasonable (< 50MB for typical apps) | `ls -la app.asar` |
| 28 | Tray icon appears on launch (if menu-bar app) | Visual check |
| 29 | Main window renders (if windowed app) | Visual check |

## Code Signing (if credentials available)

| # | Item | How to Verify |
|---|---|---|
| 30 | `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD` set | `echo $APPLE_ID` |
| 31 | `codesign --verify --deep --strict <App>.app` passes | Exit 0 |
| 32 | `xcrun stapler validate <App>.app` passes | "The validate action worked!" |
| 33 | `spctl --assess --type exec --verbose <App>.app` → "accepted" | Run command |

Back to [../index.md](../index.md)

Evidence: `../../05_distillation/production-readiness-checklist.md`, `../../05_distillation/playbooks/PB-08-packaging-macos-signed-build-walkthrough.md`
