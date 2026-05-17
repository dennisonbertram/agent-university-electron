# Code Signing and Notarization — Electron

Version: Electron 42.1.0, @electron/notarize 3.1.1 [S15, S16]

## What Code Signing Is

Code signing certifies that:
1. The app came from a known developer (identity)
2. The app hasn't been modified since signing (integrity)

macOS Gatekeeper checks both for all apps from the internet (quarantine bit).

## Two-Step Process for macOS Distribution

1. **Code sign** — embed Developer ID Application certificate in the binary
2. **Notarize** — submit to Apple's servers for automated malware scan; Apple returns a ticket
3. **Staple** — attach the notarization ticket to the app bundle (offline verification)

Without both steps, macOS Sequoia (15+) shows "App is damaged" or blocks opening. [S15]

## Prerequisites

- Enroll in Apple Developer Program ($99/year)
- Install Xcode
- Generate "Developer ID Application" certificate in Xcode or developer.apple.com
- Verify: `security find-identity -p codesigning -v`

## osxSign Configuration

```typescript
// forge.config.ts — packagerConfig
osxSign: {
  // With defaults, @electron/osx-sign finds the cert automatically
  // For custom entitlements:
  optionsForFile: (filePath: string) => ({
    entitlements: path.join(__dirname, 'entitlements.mac.plist'),
    'entitlements-inherit': path.join(__dirname, 'entitlements.mac.inherit.plist'),
    hardenedRuntime: true,
  }),
}
```

[S16]

## entitlements.mac.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Hardened Runtime — required for notarization -->
  <key>com.apple.security.cs.allow-jit</key>
  <false/>

  <!-- Allow loading of unsigned frameworks (needed for Electron's dynamic libs) -->
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <false/>

  <!-- Disable library validation for Electron frameworks -->
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>

  <!-- Allow DYLD environment variables (Electron may need this) -->
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <false/>

  <!-- App Sandbox — false for most Electron apps outside MAS -->
  <key>com.apple.security.app-sandbox</key>
  <false/>

  <!-- If you need network access -->
  <key>com.apple.security.network.client</key>
  <true/>
</dict>
</plist>
```

[S16]

## osxNotarize Configuration

```typescript
// Three authentication options:

// Option 1: App-specific password (simplest, store in env)
osxNotarize: {
  appleId: process.env.APPLE_ID!,
  appleIdPassword: process.env.APPLE_PASSWORD!,  // app-specific password, NOT your Apple ID password
  teamId: process.env.APPLE_TEAM_ID!,
}

// Option 2: App Store Connect API key (better for CI)
osxNotarize: {
  appleApiKey: process.env.API_KEY_PATH!,        // path to .p8 file
  appleApiKeyId: process.env.API_KEY_ID!,        // 10-char key ID
  appleApiIssuer: process.env.API_ISSUER!,       // UUID
}

// Option 3: Keychain profile (stored via xcrun notarytool)
osxNotarize: {
  keychainProfile: 'my-notarize-profile',
}
```

Store credentials via keychain for CI:
```bash
xcrun notarytool store-credentials "my-notarize-profile" \
  --apple-id "developer@example.com" \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --team-id "XXXXXXXXXX"
```

## Notarization Flow

1. Electron Forge packages the app (`package`)
2. `@electron/osx-sign` signs all executables and frameworks with Developer ID cert + hardened runtime
3. `@electron/notarize` zips the signed app and submits to Apple notarization API
4. Apple's server scans (seconds to 30 minutes historically; typically < 2 minutes now)
5. If approved: Apple returns a notarization ticket
6. `@electron/notarize` staples the ticket to the app bundle
7. Gatekeeper can verify offline via the stapled ticket

The DMG made AFTER notarization inherits the notarization. [S15, S16]

## Stapling

```bash
# Manual staple (if automatic stapling by notarize fails)
xcrun stapler staple "My App.app"

# Verify
xcrun stapler validate "My App.app"

# Gatekeeper assessment
spctl --assess --verbose "My App.app"
```

## Simulated Signing Path (No Apple Developer Account)

When no Apple Developer account is available (our case per environment.md), we simulate:

### Option 1: Ad-hoc signing (development/testing)

```bash
# Sign with ad-hoc identity (no certificate required)
# The '-' is the ad-hoc signing identity
codesign --force --deep --sign - "My App.app"

# Verify
codesign --verify --verbose "My App.app"
```

Ad-hoc signed apps will be quarantined by Gatekeeper (shows "damaged" warning) unless:
- User right-clicks and selects "Open" (bypasses Gatekeeper once)
- Gatekeeper quarantine is removed: `xattr -d com.apple.quarantine "My App.app"`
- Gatekeeper disabled: `sudo spctl --master-disable` (NOT for production; testing only)

### Option 2: Skip signing in Forge config

```typescript
// forge.config.ts — skip signing when no credentials
packagerConfig: {
  // Conditionally include osxSign/osxNotarize based on environment
  ...(process.env.APPLE_ID ? {
    osxSign: {},
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD!,
      teamId: process.env.APPLE_TEAM_ID!,
    },
  } : {}),
}
```

### What Changes Between Simulated and Real Signing

| Feature | Simulated (ad-hoc) | Real (Developer ID) |
|---------|-------------------|---------------------|
| Gatekeeper | Blocked ("damaged") | Passes |
| Notifications | Fail (unsigned) | Work |
| safeStorage | Works (dev keychain) | Works |
| Auto-update | Not testable with signature check | Works |
| Touch ID | May work | Works |
| Deep links (packaged) | Works | Works |
| Distribution | NOT distributable | Distributable |

## Fuses Post-Sign

`@electron/fuses` must be run AFTER signing but BEFORE notarization:

```typescript
// In forge hooks or a post-package script:
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses'

await flipFuses(pathToApp, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
})
```

Re-signing is required after flipping fuses. Use the FusesPlugin in Forge config (handled automatically). [S3]

## Entitlements Verify Command

```bash
# Inspect entitlements of a built/signed app
codesign --display --entitlements :- "My App.app"

# Verify deep signature
codesign --verify --deep --strict "My App.app"

# Check Gatekeeper
spctl --assess --type exec "My App.app"
```
