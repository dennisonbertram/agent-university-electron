# Entitlements Reference

macOS entitlements for signed Electron apps. Required for notarization with hardened runtime.

Back to [../index.md](../index.md) | [fuses-reference.md](./fuses-reference.md)

---

## What Are Entitlements?

Entitlements are permissions declared in a plist file (`entitlements.mac.plist`) and embedded into the code signature. macOS enforces them at runtime. With the hardened runtime enabled (required for notarization), capabilities not in the entitlements plist are blocked.

---

## Minimum Required Entitlements for Electron

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Required: Electron's JIT compiler (V8) -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>

  <!-- Required: Electron loads private frameworks -->
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

`allow-jit` and `disable-library-validation` are the minimum. Without them, the app crashes after signing.

---

## Optional Entitlements

Add these only if your app uses the corresponding capability.

| Entitlement | Purpose | When to Add |
|---|---|---|
| `com.apple.security.device.camera` | Camera access | App captures video |
| `com.apple.security.device.microphone` | Microphone access | App records audio |
| `com.apple.security.files.user-selected.read-write` | Open/save file dialogs | App uses `dialog.showOpenDialog` to let users pick files |
| `com.apple.security.files.downloads.read-write` | Downloads folder access | App reads/writes `~/Downloads` |
| `com.apple.security.network.client` | Outbound network | App makes HTTP requests (usually already allowed) |
| `com.apple.security.network.server` | Inbound network | App serves local HTTP (e.g., update server) |
| `com.apple.security.automation.apple-events` | Send Apple Events | App uses AppleScript or controls other apps |
| `com.apple.security.personal-information.location` | Location | App uses `CoreLocation` |

---

## Touch ID Entitlement

If your app uses `systemPreferences.promptTouchID()`:

```xml
<key>com.apple.security.cs.disable-library-validation</key>
<true/>
```

This is already in the minimum set. No additional entitlement needed for Touch ID itself, but the app must be signed.

---

## Forge Configuration

```typescript
// forge.config.ts
osxSign: {
  identity: 'Developer ID Application: Your Name (XXXXXXXXXX)',
  hardenedRuntime: true,
  entitlements: 'entitlements.mac.plist',
  entitlementsInherit: 'entitlements.mac.plist',
}
```

`entitlementsInherit` applies to embedded frameworks and helper executables. Use the same file as `entitlements`.

---

## Verifying Applied Entitlements

```bash
codesign --display --entitlements - <App>.app
```

Expected output for minimum entitlements:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC ...>
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

---

## Entitlements vs. Fuses vs. Info.plist

| Mechanism | Purpose | When Applied |
|---|---|---|
| **Entitlements** | OS capabilities (camera, JIT, etc.) | At code-signing time |
| **Fuses** | Binary-level hardening (RunAsNode, etc.) | At packaging time (Forge) |
| **Info.plist** | App metadata (bundle ID, URL schemes, UI mode) | At packaging time (Forge `extendInfo`) |

These are orthogonal. A production app needs all three configured correctly.

---

## `Info.plist` Keys (not entitlements)

These go in `packagerConfig.extendInfo`, not in the entitlements plist:

| Key | Purpose |
|---|---|
| `LSUIElement: true` | Hide from Dock and App Switcher (menu-bar apps) |
| `CFBundleURLTypes` | Deep link URL scheme registration |
| `CFBundleShortVersionString` | Human-readable version string |
| `CFBundleIdentifier` | Bundle ID (must match `appBundleId` in Forge config) |
| `NSUserNotificationAlertStyle` | Notification style: `alert` (persistent) or `banner` |

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `killed: 9` on launch after signing | `allow-jit` missing | Add to entitlements.mac.plist |
| `Library not loaded` at runtime | `disable-library-validation` missing | Add to entitlements.mac.plist |
| Notarization rejected: "hardened runtime" | `hardenedRuntime: true` not in osxSign | Add to forge.config.ts |
| Camera/mic permission denied | Device entitlement missing | Add appropriate entitlement |

---

## Related

- [../lessons/09-code-signing-and-notarization.md](../lessons/09-code-signing-and-notarization.md) — signing workflow
- [../recipes/recipe-forge-config-with-fuses.md](../recipes/recipe-forge-config-with-fuses.md) — forge config with signing
- [../troubleshooting/code-signing-failure.md](../troubleshooting/code-signing-failure.md) — signing troubleshooting
- [../checklists/production-readiness-checklist.md](../checklists/production-readiness-checklist.md) — items 6–11

Evidence: `../../../05_distillation/playbooks/PB-08-packaging-macos-signed-build-walkthrough.md`, `../../../05_distillation/playbooks/PB-09-code-signing-and-notarization.md`
