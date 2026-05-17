# Example — L5: Packaging and Distribution

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Purpose

The L5 implementation covers the complete packaging pipeline: Forge configuration, asar bundling, fuses, optional code signing, and auto-update with a local fixture server.

---

## Patterns Demonstrated

| Pattern | File | Recipe/Lesson |
|---|---|---|
| Forge config with fuses | `forge.config.ts` | [../recipes/recipe-forge-config-with-fuses.md](../recipes/recipe-forge-config-with-fuses.md) |
| Conditional signing (HAS_APPLE_CREDS) | `forge.config.ts` | [../lessons/09-code-signing-and-notarization.md](../lessons/09-code-signing-and-notarization.md) |
| electron-updater with forceDevUpdateConfig | `src/updater.ts` | [../recipes/recipe-electron-updater-generic-provider.md](../recipes/recipe-electron-updater-generic-provider.md) |
| Local update fixture server | `local-update-server.mjs` | [../labs/lab-09-electron-updater-local-fixture.md](../labs/lab-09-electron-updater-local-fixture.md) |
| AutoUnpackNativesPlugin | `forge.config.ts` | [../recipes/recipe-better-sqlite3-with-auto-unpack.md](../recipes/recipe-better-sqlite3-with-auto-unpack.md) |

---

## Source File Map

| File | Description |
|---|---|
| `forge.config.ts` | Complete config: packagerConfig, osxSign (conditional), osxNotarize (conditional), FusesPlugin, AutoUnpackNativesPlugin |
| `entitlements.mac.plist` | `allow-jit` + `disable-library-validation` |
| `dev-app-update.yml` | `provider: generic; url: http://localhost:8080` |
| `src/updater.ts` | `installUpdater()` with `forceDevUpdateConfig` cast, all 6 events logged |
| `local-update-server.mjs` | Static HTTP server stripping `?noCache` query |
| `fixtures/latest-mac.yml` | Update manifest with `version: 9.9.9` |
| `tests/updater.spec.ts` | Playwright: `updater:update-available` fires for fixture manifest |
| `tests/packaging.spec.ts` | Static regressions: all 6 fuses, no .ts in asar, etc. |

---

## Key Learning Points

1. **`forceDevUpdateConfig` cast (G-10)**: TypeScript doesn't include this property in the type. Use `(autoUpdater as any).forceDevUpdateConfig = true`.
2. **`?noCache` stripping (G-08)**: `electron-updater` appends this to cache-bust. Servers must strip the query or return 404.
3. **HAS_APPLE_CREDS pattern**: Conditional signing prevents build failures on machines without Apple credentials. CI sets the env vars; dev builds skip signing.
4. **asar + fuses dependency**: `OnlyLoadAppFromAsar: true` requires `asar: true` in packagerConfig. Setting the fuse without the asar causes the packaged app to fail to launch.
5. **packageAfterCopy gotcha (G-12)**: `npm run package` only creates the `.app`; `npm run make` creates the distributable `.dmg`/`.zip`. For verification, use `npm run package`.

---

## Verification Commands

```bash
# After npm run package:
npx @electron/asar list out/<App>-darwin-arm64/<App>.app/Contents/Resources/app.asar | grep '\.ts$'
# Empty output = correct

npx @electron/fuses read --app out/<App>-darwin-arm64/<App>.app
# All 6 fuses must show correct state

open out/<App>-darwin-arm64/<App>.app
# App must launch
```

---

## Corresponding Labs

- [../labs/lab-08-packaging-and-fuses.md](../labs/lab-08-packaging-and-fuses.md)
- [../labs/lab-09-electron-updater-local-fixture.md](../labs/lab-09-electron-updater-local-fixture.md)

---

## Corresponding Lessons

- [../lessons/08-packaging-with-electron-forge.md](../lessons/08-packaging-with-electron-forge.md)
- [../lessons/09-code-signing-and-notarization.md](../lessons/09-code-signing-and-notarization.md)
- [../lessons/10-auto-update.md](../lessons/10-auto-update.md)

Evidence: `../../../05_distillation/patterns/P-12-electron-updater-with-generic-provider.md`, `../../../05_distillation/patterns/P-14-fuses-hardening-for-production.md`, `../../../05_distillation/playbooks/PB-08-packaging-macos-signed-build-walkthrough.md`
