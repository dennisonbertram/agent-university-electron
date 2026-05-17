# Troubleshooting — Code Signing and Notarization Failures

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Symptom

- `codesign --verify --deep --strict <App>.app` fails
- `spctl --assess` returns "rejected" or "source=no usable signature"
- `xcrun notarytool submit` returns error or times out
- `xcrun stapler validate` fails
- Gatekeeper blocks the app even after signing

---

## Cause → Diagnostic → Fix

### Cause 1: Wrong certificate type

For direct distribution (not Mac App Store), you need **Developer ID Application** certificate, not "Apple Development" or "Mac Development".

**Diagnostic**

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
# Should show at least one entry
```

**Fix**

- Open Xcode → Settings → Accounts → Manage Certificates
- Create "Developer ID Application" certificate
- Download and install in Keychain

---

### Cause 2: Hardened runtime not enabled

Notarization requires the hardened runtime flag.

**Diagnostic**

```bash
codesign --display --verbose=4 <App>.app 2>&1 | grep flags
# Should contain "runtime"
```

**Fix**

In `forge.config.ts`:
```typescript
osxSign: {
  identity: 'Developer ID Application: ...',
  hardenedRuntime: true,
  entitlements: 'entitlements.mac.plist',
  entitlementsInherit: 'entitlements.mac.plist',
}
```

---

### Cause 3: Missing entitlements (`allow-jit` or `disable-library-validation`)

Electron requires specific entitlements to run. Missing entitlements cause the signed app to crash at runtime.

**Required entitlements**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

**Diagnostic**

```bash
codesign --display --entitlements - <App>.app 2>&1
# Both allow-jit and disable-library-validation must appear
```

**Fix**

Create `entitlements.mac.plist` with the content above. Reference it in `osxSign`.

---

### Cause 4: Notarization credentials missing or wrong

`electron-forge` uses `APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_APP_SPECIFIC_PASSWORD` environment variables.

**Diagnostic**

```bash
echo $APPLE_ID           # Should be your Apple ID email
echo $APPLE_TEAM_ID      # 10-char team ID
echo $APPLE_APP_SPECIFIC_PASSWORD  # App-specific password (not your Apple ID password)
```

**Fix**

Generate an app-specific password at https://appleid.apple.com → Sign-In and Security → App-Specific Passwords.

Set in CI/CD secrets, or for local builds:
```bash
export APPLE_ID="you@example.com"
export APPLE_TEAM_ID="XXXXXXXXXX"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

---

### Cause 5: Notarization ticket not stapled

After notarization succeeds, you must staple the ticket to the `.app` so Gatekeeper can verify offline.

**Diagnostic**

```bash
xcrun stapler validate <App>.app
# Must print "The validate action worked!" — anything else means not stapled
```

**Fix**

`electron-forge` with `osxNotarize` config staples automatically. If doing it manually:

```bash
xcrun notarytool submit <App>.dmg \
  --apple-id $APPLE_ID \
  --team-id $APPLE_TEAM_ID \
  --password $APPLE_APP_SPECIFIC_PASSWORD \
  --wait

xcrun stapler staple <App>.app
xcrun stapler validate <App>.app
```

---

### Cause 6: `osxSign` applied unconditionally (blocks builds without credentials)

If `osxSign` is not conditional on credentials being present, builds without signing credentials fail entirely.

**Fix**

Use `HAS_APPLE_CREDS` conditional:
```typescript
const HAS_APPLE_CREDS = Boolean(
  process.env.APPLE_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_APP_SPECIFIC_PASSWORD
)

export default {
  packagerConfig: {
    // ...
    ...(HAS_APPLE_CREDS && {
      osxSign: {
        identity: `Developer ID Application: ${process.env.APPLE_TEAM_ID}`,
        hardenedRuntime: true,
        entitlements: 'entitlements.mac.plist',
        entitlementsInherit: 'entitlements.mac.plist',
      },
      osxNotarize: {
        tool: 'notarytool',
        appleId: process.env.APPLE_ID!,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
    }),
  },
}
```

---

### Cause 7: Quarantine attribute blocks app from unsigned download

If the app was downloaded from the internet (not installed via package manager), macOS adds a quarantine attribute.

**Diagnostic**

```bash
xattr <App>.app | grep quarantine
# com.apple.quarantine  means it's quarantined
```

**Fix** (for testing only — production apps should be properly signed):
```bash
xattr -dr com.apple.quarantine <App>.app
```

---

## Verification Sequence After Signing

```bash
# 1. Verify code signature
codesign --verify --deep --strict <App>.app && echo "Signature OK"

# 2. Verify notarization and staple
xcrun stapler validate <App>.app

# 3. Gatekeeper assessment
spctl --assess --type exec --verbose <App>.app

# 4. Check entitlements
codesign --display --entitlements - <App>.app

# 5. Check for hardened runtime
codesign --display --verbose=4 <App>.app 2>&1 | grep -E "flags|runtime"
```

---

## Related

- [../lessons/09-code-signing-and-notarization.md](../lessons/09-code-signing-and-notarization.md) — complete signing workflow
- [../recipes/recipe-forge-config-with-fuses.md](../recipes/recipe-forge-config-with-fuses.md) — forge config with conditional signing
- [../checklists/production-readiness-checklist.md](../checklists/production-readiness-checklist.md) — items 6–11
- [../checklists/packaging-checklist.md](../checklists/packaging-checklist.md) — code signing section
- [../reference/entitlements-reference.md](../reference/entitlements-reference.md) — entitlements reference

Evidence: `../../../05_distillation/playbooks/PB-08-packaging-macos-signed-build-walkthrough.md`, `../../../05_distillation/playbooks/PB-08-packaging-macos-signed-build-walkthrough.md`
