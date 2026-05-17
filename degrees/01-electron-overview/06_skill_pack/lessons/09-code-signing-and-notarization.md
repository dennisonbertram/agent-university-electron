# Lesson 09 — Code Signing and Notarization

**Prerequisites**: [08-packaging-with-electron-forge.md](./08-packaging-with-electron-forge.md)  
**Next**: [10-auto-update.md](./10-auto-update.md)

## Why Signing Matters

Without signing, macOS Gatekeeper blocks the app on clean machines ("unidentified developer"). With signing but without notarization, Gatekeeper still blocks it. With both, Gatekeeper lets it through.

Additionally:
- Notifications require signing (fail silently unsigned)
- Deep links require packaging + signing for reliable OS routing
- Touch ID requires signing + entitlement
- `safeStorage` encrypted data is tied to the signed bundle ID

## Prerequisites

1. Apple Developer Program membership ($99/yr)
2. Developer ID Application certificate in your Keychain
3. App-Specific Password from appleid.apple.com

```bash
export APPLE_ID="you@example.com"
export APPLE_TEAM_ID="ABCD123456"    # 10 chars from developer.apple.com
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
```

## forge.config.ts — Signing Config

```typescript
const HAS_APPLE_CREDS =
  !!process.env.APPLE_ID &&
  !!process.env.APPLE_TEAM_ID &&
  !!process.env.APPLE_APP_SPECIFIC_PASSWORD

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.example.myapp',
    // ... other config ...
    ...(HAS_APPLE_CREDS ? {
      osxSign: {
        optionsForFile: () => ({
          entitlements: path.join(__dirname, 'entitlements.mac.plist'),
          hardenedRuntime: true,
          'gatekeeper-assess': false,  // Forge assesses after notarization, not now
        }),
      },
      osxNotarize: {
        appleId: process.env.APPLE_ID!,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
    } : {}),
  },
}
```

The conditional spread means unsigned builds work without creds — CI can package without signing.

## entitlements.mac.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Required for JIT compilation (V8) -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <!-- Required for native modules that link against non-Apple dylibs -->
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  <!-- Required if your app makes HTTP/HTTPS requests -->
  <key>com.apple.security.network.client</key>
  <true/>
</dict>
</plist>
```

If you use Touch ID: add `com.apple.security.app-sandbox` must be `<false/>` (Electron doesn't support App Sandbox due to its multi-process architecture). Touch ID needs the LocalAuthentication framework, which `disable-library-validation` enables.

## Hardened Runtime

`hardenedRuntime: true` is required for notarization. It enforces:
- Library validation (unless disabled by entitlement)
- Execution prevention
- Restricted namespace

Without `allow-jit`, V8 cannot JIT-compile JavaScript — the app crashes at startup under hardened runtime.

## The Notarization Flow

Forge handles this automatically when creds are present:
1. Package the app into `.app`
2. Apply fuses (modifies binary bytes)
3. Sign with Developer ID certificate
4. Submit to Apple notarization service via `xcrun notarytool submit --wait`
5. Staple the notarization ticket to the `.app`

Step 4 typically takes 1-5 minutes. If it takes >30 minutes, Apple's service is overloaded — wait.

## Verification Commands

```bash
# Is it signed?
codesign --verify --deep --strict out/<App>-darwin-arm64/MyApp.app
# Exit 0 = success

# Is the notarization ticket stapled?
xcrun stapler validate out/<App>-darwin-arm64/MyApp.app
# Expected: "The validate action worked!"

# Does Gatekeeper accept it?
spctl --assess --type exec --verbose out/<App>-darwin-arm64/MyApp.app
# Expected: "...accepted"

# What entitlements are embedded?
codesign --display --entitlements - out/<App>-darwin-arm64/MyApp.app
```

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `errSecCSReqFailed` | Missing entitlement (often `disable-library-validation`) | Add to entitlements.mac.plist |
| `notarytool: A required argument is missing` | Missing APPLE_TEAM_ID | Set env var |
| Gatekeeper: "damaged and can't be opened" | Signed but not notarized | Run `make` with creds, not just `package` |
| App crashes on launch (hardened runtime) | Missing `allow-jit` entitlement | Add to entitlements |
| `errSecCSBadBundleFormat` | Native module not rebuilt post-fuse-flip | Run `electron-rebuild` before packaging |

## Skip Path (Dev / School — No Creds)

When `HAS_APPLE_CREDS === false`, `osxSign`/`osxNotarize` are not added to the packager config. The app packages unsigned and unnotarized. Use a `packageAfterCopy` hook to write a `simulated-signing.md` marker so CI can confirm the skip path ran cleanly:

```typescript
afterCopy: [async (buildPath) => {
  if (!HAS_APPLE_CREDS) {
    writeFileSync(
      path.join(process.cwd(), 'simulated-signing.md'),
      '# Simulated signing\nNo Apple credentials — signing was skipped.\n'
    )
  }
}]
```

## Bundle ID Stability

The bundle ID (`appBundleId`) must be stable across versions. Changing it:
- Breaks `safeStorage` encrypted data (can't decrypt with new ID)
- Breaks auto-launch settings
- Breaks Gatekeeper's recognition of the app

Use a consistent reverse-domain format: `com.yourcompany.appname`.

## Key Takeaways

1. Signing + notarization is required for distribution on macOS.
2. Entitlements: `allow-jit` (V8), `disable-library-validation` (native modules), `network.client` (HTTPS).
3. Hardened runtime is required for notarization — and requires `allow-jit`.
4. Conditional spread with `HAS_APPLE_CREDS` lets unsigned builds work without creds.
5. Verify with `codesign --verify`, `xcrun stapler validate`, and `spctl --assess`.
6. Bundle ID must be stable — changing it breaks safeStorage and auto-launch.

Evidence: `../../05_distillation/playbooks/PB-08-packaging-macos-signed-build-walkthrough.md`, `../../01_research/17-code-signing-notarization.md`, `../../05_distillation/production-readiness-checklist.md`
