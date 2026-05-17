# Packaging with Electron Forge — Electron

Version: Electron 42.1.0, @electron-forge/cli 7.11.1 [S14, S30, S31]

## What Electron Forge Does

Electron Forge is the official toolchain for packaging and distributing Electron apps. It unifies:
- `@electron/packager` — bundling app source into platform-specific app directories
- `@electron/rebuild` — rebuilding native modules for the target Electron ABI
- Makers — producing distributable artifacts (DMG, ZIP, NSIS, deb, etc.)
- Publishers — uploading artifacts (GitHub, S3, etc.)
- Plugins — build system integration (Vite, Webpack)

Commands:
- `npm run start` → dev mode (via Forge Vite/Webpack plugin with hot reload)
- `npm run package` → bundle into `out/<platform>-<arch>/` directory
- `npm run make` → produce distributable artifacts (DMG, ZIP, etc.) under `out/make/`
- `npm run publish` → upload artifacts to configured publisher

## Project Setup

```bash
# Create new Electron + TypeScript + Vite project
npm create electron-app@latest my-app -- --template=vite-typescript

# OR with create-electron-app:
npx create-electron-app my-app --template=vite-typescript
```

Produces:
```
my-app/
  src/
    main.ts
    preload.ts
    renderer.ts
    index.html
  forge.config.ts
  package.json
  tsconfig.json
  vite.main.config.ts
  vite.preload.config.ts
  vite.renderer.config.ts
```

## forge.config.ts Structure

```typescript
import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.example.myapp',
    appCategoryType: 'public.app-category.productivity',
    asar: {
      unpack: '**/*.node', // unpack native modules
    },
    osxSign: {}, // code signing — see 17-code-signing-notarization.md
    osxNotarize: {
      appleId: process.env.APPLE_ID ?? '',
      appleIdPassword: process.env.APPLE_PASSWORD ?? '',
      teamId: process.env.APPLE_TEAM_ID ?? '',
    },
    protocols: [
      {
        name: 'My App',
        schemes: ['myapp'],
      },
    ],
    extendInfo: {
      LSUIElement: true, // for menu-bar-only apps
    },
    icon: 'src/assets/icon', // without extension; Forge adds .icns/.ico
  },

  rebuildConfig: {},

  makers: [
    // macOS DMG
    new MakerDMG({
      background: './src/assets/dmg-background.png',
      format: 'ULFO',
    }),

    // macOS/Linux ZIP (needed for Squirrel.Mac auto-update)
    new MakerZIP({}, ['darwin', 'linux']),

    // Windows NSIS installer
    new MakerSquirrel({
      authors: 'My Company',
      description: 'My App description',
    }),
  ],

  plugins: [
    new VitePlugin({
      // Main process build
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      // Renderer process build
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),

    // Security fuses (disable risky features)
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

  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      // Custom post-copy steps
    },
  },

  publishers: [
    // GitHub publisher (optional)
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'myorg', name: 'my-app' },
        draft: true,
        prerelease: false,
        generateReleaseNotes: true,
      },
    },
  ],
}

export default config
```

[S30]

## Universal Binary (arm64 + x64)

```bash
# Make for both architectures (produces universal binary)
npm run make -- --arch=universal

# OR specify manually:
npm run make -- --platform=darwin --arch=universal
```

Forge's universal maker runs `electron-rebuild` for each architecture separately, then merges with `lipo`. Native modules must support both architectures.

## DMG Maker Options [S31]

```typescript
new MakerDMG({
  background: './src/assets/dmg-background.png',
  format: 'ULFO',    // Ultra-fast LZ77/LZFSE compressed; macOS 10.11+
  // Other format options: 'UDRW' (read/write), 'UDZO' (zlib), 'UDBZ' (bzip2)
})
```

Full option reference: `https://js.electronforge.io/classes/_electron_forge_maker_dmg.MakerDMG.html`

## AutoUnpackNativesPlugin

If using native modules with asar, use this plugin instead of manual `asar.unpack`:

```typescript
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'

plugins: [
  new VitePlugin({ ... }),
  new AutoUnpackNativesPlugin({}),
]
```

## Command Flow

```bash
# Development (with hot reload)
npm run start
# → Vite dev server starts
# → Forge starts Electron pointing at dev server URLs
# → Changes to renderer trigger HMR
# → Changes to main/preload trigger Electron restart

# Package (no distributable)
npm run package
# → Compiles TypeScript
# → Bundles via Vite
# → Runs @electron/rebuild for native modules
# → Copies everything to out/<platform>-<arch>/

# Make (distributable artifacts)
npm run make
# → All of package steps, THEN
# → Runs makers to produce DMG, ZIP, etc.
# → Artifacts in out/make/

# Publish
npm run publish
# → All of make steps, THEN
# → Uploads to configured publisher
```

## Checking Packaged App

```bash
# After `npm run make`:
ls out/make/                    # lists all distributable artifacts
ls out/darwin-arm64/My\ App.app/Contents/Resources/
# Should contain: app.asar, app.asar.unpacked/ (for native modules)

# Run packaged app directly
open out/darwin-arm64/My\ App.app
```

## Environment Variables for notarize

```bash
# Required in environment or .env (DO NOT COMMIT .env):
APPLE_ID="developer@example.com"
APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # app-specific password
APPLE_TEAM_ID="XXXXXXXXXX"

# Skip notarize in CI if credentials not set:
# Check: if (!process.env.APPLE_ID) skip osxNotarize config
```
