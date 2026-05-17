# Lesson 08 — Packaging with Electron Forge

**Prerequisites**: [07-app-lifecycle-and-single-instance.md](./07-app-lifecycle-and-single-instance.md)  
**Next**: [09-code-signing-and-notarization.md](./09-code-signing-and-notarization.md)

## What Electron Forge Does

Electron Forge packages your compiled JS into a `.app` bundle (macOS), `.exe` installer (Windows), or `.deb`/`.rpm` package (Linux). It:

1. Copies compiled files into `<App>.app/Contents/Resources/`
2. Packs them into an `app.asar` archive
3. Applies binary fuses (security hardening)
4. Runs code signing and notarization
5. Produces distributable artifacts (DMG, ZIP, etc.)

## Minimal forge.config.ts

```typescript
import type { ForgeConfig } from '@electron-forge/shared-types'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerZIP } from '@electron-forge/maker-zip'
import path from 'node:path'

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.example.myapp',
    name: 'MyApp',
    executableName: 'MyApp',
    asar: true,   // REQUIRED — pack into asar archive
    ignore: [     // Exclude dev files from the bundle
      /^\/tests\b/,
      /^\/test-results\b/,
      /^\/test-output\b/,
      /^\/\.git\b/,
      /^\/src\//,            // exclude TypeScript source
      /forge\.config\.ts$/,
      /playwright\.config\.ts$/,
      /vitest\.config\.ts$/,
      /tsconfig.*\.json$/,
    ],
    extendInfo: {
      CFBundleURLTypes: [
        {
          CFBundleURLName: 'MyApp URL',
          CFBundleURLSchemes: ['myapp'],
        },
      ],
      LSUIElement: true,  // For menu-bar-only apps: hides Dock icon
    },
  },
  plugins: [
    new AutoUnpackNativesPlugin({}),  // native .node files outside asar
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  makers: [
    new MakerDMG({ format: 'ULFO' }),
    new MakerZIP({}, ['darwin']),
  ],
}

export default config
```

## The Build Chain

For a hybrid build (tsc + esbuild + forge), `package.json` scripts:

```json
{
  "scripts": {
    "build:main": "tsc -p tsconfig.json",
    "build:preload": "esbuild src/preload.ts --bundle --platform=node --external:electron --outfile=dist/preload.js",
    "build:renderer": "esbuild src/renderer/renderer.ts --bundle --outfile=dist/renderer/renderer.js && cp src/renderer/index.html dist/renderer/",
    "build": "npm run build:main && npm run build:preload && npm run build:renderer",
    "package": "npm run build && electron-forge package",
    "make": "npm run build && electron-forge make"
  },
  "main": "dist/main.js"
}
```

`package.json` `main` field MUST point at the compiled JS entry (`dist/main.js`), not the TypeScript source.

## asar and What Goes In

`asar: true` packs `dist/` into `app.asar`. Critically, the packager reads from your project directory and copies according to the `ignore` list. Without `ignore`:
- Your `src/*.ts` files end up in the bundle (wasted space, source leakage)
- `node_modules/.cache` goes in (sometimes 100MB+)
- Test files go in

The `ignore` array takes regex patterns matched against the packaged path (relative to project root).

Verify after packaging:
```bash
# List contents of the asar:
npx @electron/asar list out/<App>-darwin-arm64/<App>.app/Contents/Resources/app.asar

# Confirm native .node is unpacked (not inside asar):
ls out/<App>-darwin-arm64/<App>.app/Contents/Resources/app.asar.unpacked/
```

## Protocols Gotcha (G-09)

If you use both `packagerConfig.protocols` and `extendInfo.CFBundleURLTypes`, Forge silently uses ONLY `protocols` — the extendInfo entry is dropped.

Choose one:
- **`packagerConfig.protocols`**: simpler, no role/icon metadata
- **`extendInfo.CFBundleURLTypes`**: full control over metadata, but drop `protocols`

## packageAfterCopy Hook Gotcha (G-12)

If you add a `packageAfterCopy` hook in forge config:

```typescript
packagerConfig: {
  afterCopy: [async (buildPath, electronVersion, platform, arch) => {
    // buildPath is the STAGING dir (inside Forge's temp tree), NOT the final .app
    // Writing to buildPath → ends up inside app.asar
    // To write to git-tracked files → use absolute paths to your source tree
  }],
}
```

`buildPath` is a temporary staging directory. Anything written there ends up inside `app.asar`. To produce files outside the bundle (e.g., `simulated-signing.md` for CI), use absolute paths.

## Info.plist Content

Key Info.plist entries via `extendInfo`:

```typescript
extendInfo: {
  // URL scheme (choose extendInfo OR packagerConfig.protocols — not both)
  CFBundleURLTypes: [{
    CFBundleURLName: 'MyApp URL',
    CFBundleURLSchemes: ['myapp'],
    CFBundleTypeRole: 'Viewer',
  }],
  // Hide from Dock (menu-bar-only apps)
  LSUIElement: true,
  // App category (affects App Store categorization)
  LSApplicationCategoryType: 'public.app-category.productivity',
  // Version string shown in About
  CFBundleShortVersionString: '1.0.0',
}
```

Verify the plist after packaging:
```bash
plutil -p out/<App>-darwin-arm64/<App>.app/Contents/Info.plist | grep -A 8 CFBundleURLTypes
```

## Fuses — Why They Matter

Fuses modify bytes in the Electron binary. They are applied AFTER bundling and BEFORE signing.

| Fuse | Effect |
|---|---|
| `RunAsNode: false` | Binary can't be used as `node` interpreter via `ELECTRON_RUN_AS_NODE=1` |
| `EnableNodeOptionsEnvironmentVariable: false` | Blocks `NODE_OPTIONS='--inspect-brk=...'` |
| `EnableNodeCliInspectArguments: false` | Blocks `--inspect`, `--inspect-brk` CLI flags |
| `EnableCookieEncryption: true` | Encrypts cookie storage at rest |
| `OnlyLoadAppFromAsar: true` | App only loads from its asar; sideloading blocked |
| `EnableEmbeddedAsarIntegrityValidation: true` | Hash check on asar at startup |

## Commands Reference

```bash
# Install Forge CLI
npm install --save-dev @electron-forge/cli

# Package (creates .app but no DMG):
npx electron-forge package

# Make (creates DMG/ZIP installers):
npx electron-forge make

# Start in dev mode:
npx electron-forge start
```

## Key Takeaways

1. `asar: true` is required — without it the bundle ships unpacked source files.
2. `ignore` list is critical — exclude `src/`, `tests/`, `*.ts`, forge config, etc.
3. `AutoUnpackNativesPlugin` is required for native modules.
4. All 6 fuses must be set for production.
5. `packagerConfig.protocols` and `extendInfo.CFBundleURLTypes` do not merge — pick one.
6. `afterCopy` hooks: `buildPath` is a staging dir, not the final `.app`.

Evidence: `../../05_distillation/patterns/P-14-fuses-hardening-for-production.md`, `../../05_distillation/patterns/P-15-auto-unpack-natives-for-better-sqlite3.md`, `../../05_distillation/gotchas/G-09-packager-protocols-overrides-extendinfo-bundleurltypes.md`, `../../05_distillation/gotchas/G-12-forge-packageaftercopy-buildpath-is-staging.md`, `../../01_research/16-packaging-electron-forge.md`
