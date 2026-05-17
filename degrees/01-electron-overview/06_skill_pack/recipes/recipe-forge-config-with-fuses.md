# Recipe — Forge Config with Fuses

**Use when**: Packaging an Electron app for distribution.

## Code

```typescript
// forge.config.ts
import type { ForgeConfig } from '@electron-forge/shared-types'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerZIP } from '@electron-forge/maker-zip'
import path from 'node:path'

const HAS_APPLE_CREDS =
  !!process.env.APPLE_ID &&
  !!process.env.APPLE_TEAM_ID &&
  !!process.env.APPLE_APP_SPECIFIC_PASSWORD

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.example.myapp',
    appCategoryType: 'public.app-category.productivity',
    name: 'MyApp',
    executableName: 'MyApp',
    asar: true,
    ignore: [
      /^\/tests\b/,
      /^\/test-results\b/,
      /^\/test-output\b/,
      /^\/\.git\b/,
      /^\/src\b/,
      /forge\.config\.ts$/,
      /playwright\.config\.ts$/,
      /vitest\.config\.ts$/,
      /tsconfig.*\.json$/,
    ],
    extendInfo: {
      LSUIElement: true,  // Remove for non-menu-bar apps
      CFBundleURLTypes: [
        { CFBundleURLName: 'MyApp URL', CFBundleURLSchemes: ['myapp'] },
      ],
    },
    ...(HAS_APPLE_CREDS ? {
      osxSign: {
        optionsForFile: () => ({
          entitlements: path.join(__dirname, 'entitlements.mac.plist'),
          hardenedRuntime: true,
          'gatekeeper-assess': false,
        }),
      },
      osxNotarize: {
        appleId: process.env.APPLE_ID!,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
    } : {}),
  },
  plugins: [
    new AutoUnpackNativesPlugin({}),
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

## Test Pattern

```typescript
it('R-fuses-01: all 6 hardening fuses set', () => {
  const src = readFileSync('forge.config.ts', 'utf8')
  expect(src).toMatch(/RunAsNode\]:\s*false/)
  expect(src).toMatch(/EnableNodeOptionsEnvironmentVariable\]:\s*false/)
  expect(src).toMatch(/EnableNodeCliInspectArguments\]:\s*false/)
  expect(src).toMatch(/EnableCookieEncryption\]:\s*true/)
  expect(src).toMatch(/OnlyLoadAppFromAsar\]:\s*true/)
  expect(src).toMatch(/EnableEmbeddedAsarIntegrityValidation\]:\s*true/)
})
```

## Watch Out For

- Fuses are applied AFTER bundling and BEFORE signing. Order of operations: bundle → fuses → sign → notarize. Forge handles this automatically.
- `OnlyLoadAppFromAsar: true` means the packaged binary cannot load from outside the asar. This only affects packaged builds — dev mode (`electron dist/main.js`) is unaffected.
- `packagerConfig.protocols` OVERRIDES `extendInfo.CFBundleURLTypes` (G-09). This example uses `extendInfo` only. If you need both URL scheme AND protocols, use only one.
- The `ignore` array uses regex matched against paths relative to the project root (starting with `/`). Test your regexes before packaging a large app.

Evidence: `../../05_distillation/patterns/P-14-fuses-hardening-for-production.md`, `../../05_distillation/patterns/P-15-auto-unpack-natives-for-better-sqlite3.md`, `../../05_distillation/gotchas/G-09-packager-protocols-overrides-extendinfo-bundleurltypes.md`
