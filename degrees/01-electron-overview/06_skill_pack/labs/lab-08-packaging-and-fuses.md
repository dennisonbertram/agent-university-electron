# Lab 08 — Packaging and Fuses

**Goal**: Package an Electron app with Electron Forge, apply all 6 hardening fuses, and verify the output.

**Prerequisites**: [lab-07-deep-link-router.md](./lab-07-deep-link-router.md), [lessons/08-packaging-with-electron-forge.md](../lessons/08-packaging-with-electron-forge.md)

**Duration**: ~30 minutes

**POC Reference**: [examples/example-l5-packaging.md](../examples/example-l5-packaging.md)

## Goal

By the end, you should have:
- A working `forge.config.ts` with asar, ignore list, and all 6 fuses
- A packaged `.app` that passes the fuse static-source check
- Verified: asar created, native `.node` files unpacked (if any)

## Steps

### 1. Install Forge

```bash
npm install --save-dev @electron-forge/cli @electron-forge/maker-dmg @electron-forge/maker-zip
npm install --save-dev @electron-forge/plugin-fuses @electron-forge/plugin-auto-unpack-natives
npm install --save-dev @electron/fuses
```

### 2. Create forge.config.ts

See [recipes/recipe-forge-config-with-fuses.md](../recipes/recipe-forge-config-with-fuses.md):

```typescript
import type { ForgeConfig } from '@electron-forge/shared-types'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerZIP } from '@electron-forge/maker-zip'

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.example.myapp',
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
  makers: [new MakerDMG({}), new MakerZIP({}, ['darwin'])],
}
export default config
```

### 3. Add package.json scripts

```json
{
  "scripts": {
    "package": "npm run build && electron-forge package",
    "make": "npm run build && electron-forge make"
  }
}
```

### 4. Run the packager

```bash
npm run package
```

Expected output: `out/MyApp-darwin-arm64/MyApp.app`

### 5. Verify

```bash
# 1. asar exists?
ls out/MyApp-darwin-arm64/MyApp.app/Contents/Resources/app.asar

# 2. List asar contents (should NOT contain src/ *.ts files)
npx @electron/asar list out/MyApp-darwin-arm64/MyApp.app/Contents/Resources/app.asar | head -30

# 3. Source files NOT in asar:
npx @electron/asar list out/MyApp-darwin-arm64/MyApp.app/Contents/Resources/app.asar | grep "\.ts$"
# Expected: empty output

# 4. App runs:
open out/MyApp-darwin-arm64/MyApp.app
```

### 6. Static regression test for fuses

```typescript
it('R-fuses-01: forge.config.ts contains all 6 hardening fuses', () => {
  const src = readFileSync('forge.config.ts', 'utf8')
  expect(src).toMatch(/RunAsNode\]:\s*false/)
  expect(src).toMatch(/EnableNodeOptionsEnvironmentVariable\]:\s*false/)
  expect(src).toMatch(/EnableNodeCliInspectArguments\]:\s*false/)
  expect(src).toMatch(/EnableCookieEncryption\]:\s*true/)
  expect(src).toMatch(/OnlyLoadAppFromAsar\]:\s*true/)
  expect(src).toMatch(/EnableEmbeddedAsarIntegrityValidation\]:\s*true/)
})
```

## Verify

- `out/MyApp-darwin-arm64/MyApp.app` exists
- `app.asar` is inside `Contents/Resources/`
- asar does NOT contain `.ts` source files or `tests/`
- App launches successfully (`open out/.../MyApp.app`)
- Static regression test passes

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| asar contains `src/` | Missing ignore regex | Add `/^\/src\b/` to ignore list |
| App crashes on launch (packaged) | `__dirname` resolves to asar, not unpacked | Use `process.resourcesPath` for assets |
| `open` returns "damaged" | Gatekeeper rejection (unsigned) | Ad-hoc sign: `codesign --sign - MyApp.app` |
| `OnlyLoadAppFromAsar` blocks `electron .` | Expected — only affects packaged binary | Use `npm start` for dev |

See [troubleshooting/packaged-app-wont-launch.md](../troubleshooting/packaged-app-wont-launch.md).

Evidence: [recipes/recipe-forge-config-with-fuses.md](../recipes/recipe-forge-config-with-fuses.md), `../../05_distillation/patterns/P-14-fuses-hardening-for-production.md`, `../../03_pocs/L5-packaging-signing-update/`
