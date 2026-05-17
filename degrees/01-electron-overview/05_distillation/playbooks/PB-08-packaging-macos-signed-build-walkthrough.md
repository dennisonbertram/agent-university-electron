# PB-08 — Packaging a signed + notarized macOS Electron build

End-to-end walkthrough from `npm run package` to a Gatekeeper-accepted `.app`.

## Prerequisites

- Apple Developer Program membership ($99/yr).
- Developer ID Application certificate installed in Keychain.
- App-Specific Password generated at https://appleid.apple.com/account/manage → "Sign-In and Security" → "App-Specific Passwords".
- Environment variables:
  ```bash
  export APPLE_ID="you@example.com"
  export APPLE_TEAM_ID="ABCD123456"  # 10-character team ID from developer.apple.com
  export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
  ```

## Step 1 — `forge.config.ts`

```typescript
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import path from 'node:path'

const HAS_APPLE_CREDS =
  !!process.env.APPLE_ID && !!process.env.APPLE_TEAM_ID && !!process.env.APPLE_APP_SPECIFIC_PASSWORD

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.example.pulse',
    appCategoryType: 'public.app-category.productivity',
    name: 'Pulse',
    executableName: 'Pulse',
    asar: true,
    ignore: [/^\/tests\b/, /^\/test-results\b/, /^\/src\/.*\.ts$/ /* ... */],
    extendInfo: { /* CFBundleURLTypes, LSUIElement, etc. */ },
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
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
    new AutoUnpackNativesPlugin({}),
  ],
  makers: [
    new MakerDMG({ format: 'ULFO' }),
    new MakerZIP({}, ['darwin']),
  ],
}
```

## Step 2 — `entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>            <true/>
  <key>com.apple.security.cs.disable-library-validation</key> <true/>
  <key>com.apple.security.network.client</key>          <true/>
  <!-- For Touch ID: -->
  <!-- <key>com.apple.security.app-sandbox</key>        <false/> -->
</dict>
</plist>
```

## Step 3 — Run the package + make

```bash
npm run package  # creates out/<App>-darwin-arm64/Pulse.app
npm run make     # creates out/make/...dmg + out/make/zip/...
```

Forge will:
1. Bundle `dist/` into `<App>.app/Contents/Resources/app.asar`.
2. Apply the FusesPlugin (modifies binary bytes).
3. Re-sign the binary (fuses changed bytes; signature must be re-applied).
4. Submit to Apple's notarization service (`xcrun notarytool submit ... --wait`).
5. Staple the notarization ticket.

## Step 4 — Verify

```bash
# Signed?
codesign --verify --deep --strict out/<App>-darwin-arm64/Pulse.app

# Notarization stapled?
xcrun stapler validate out/<App>-darwin-arm64/Pulse.app

# Gatekeeper accepts?
spctl --assess --type exec --verbose out/<App>-darwin-arm64/Pulse.app
# expected: "...: accepted"
```

If any of these fail, the build will not run on a clean machine.

## Common errors

| Error | Cause | Fix |
| --- | --- | --- |
| `errSecCSReqFailed` | Missing entitlement (often `disable-library-validation`) | Add to `entitlements.mac.plist` |
| `notarytool: A required argument is missing` | Forgot APPLE_TEAM_ID | Set env var |
| Notarization stuck > 30 min | Apple service load | Wait; max recently seen ~30 min |
| `Invalid Bundle. The bundle ... does not support arm64` | Universal binary missing arm64 | Run universal maker, or per-arch builds |

## Skip path for school / dev (no creds)

The capstone uses a conditional spread: when `HAS_APPLE_CREDS === false`, `osxSign`/`osxNotarize` are NOT entered into `packagerConfig`. A `packageAfterCopy` hook writes `simulated-signing.md` to surface the skip path deterministically.

## Evidence

- `01_research/16-packaging-electron-forge.md`
- `01_research/17-code-signing-notarization.md`
- `03_pocs/L5-packaging-signing-update/forge.config.ts`
- `03_pocs/L5-packaging-signing-update/entitlements.mac.plist`
- `03_pocs/L5-packaging-signing-update/simulated-signing.md` (the full real-creds flow)
