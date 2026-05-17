# systemPreferences and Touch ID — Electron

Version: Electron 42.1.0 [S12]

## Touch ID API (macOS only)

### Capability Check

```typescript
import { systemPreferences } from 'electron'

// Returns true if the device supports Touch ID
const hasTouchID = systemPreferences.canPromptTouchID()
// Hardware check only — does not guarantee successful authentication
```

### Authentication Prompt

```typescript
import { systemPreferences } from 'electron'

async function authenticateWithTouchID(): Promise<boolean> {
  if (!systemPreferences.canPromptTouchID()) {
    return false // No Touch ID on this device
  }

  try {
    await systemPreferences.promptTouchID('Authenticate to view your journal')
    return true // User authenticated successfully
  } catch (err) {
    // Authentication failed, cancelled, or device locked out
    console.warn('[touchid] authentication failed:', err)
    return false
  }
}
```

IMPORTANT: The promise resolves on success, rejects on failure (user cancellation, biometric failure, device locked, too many attempts). There are no specific error codes documented — handle all rejections the same way. [S12]

### Fallback Pattern

```typescript
async function gateJournalAccess(): Promise<boolean> {
  if (systemPreferences.canPromptTouchID()) {
    try {
      await systemPreferences.promptTouchID('View journal entries')
      return true
    } catch {
      // Touch ID failed — fall back to passphrase
      return promptPassphrase()
    }
  } else {
    // Device doesn't support Touch ID — require passphrase
    return promptPassphrase()
  }
}
```

[S12]

## Important Caveats

### 1. Touch ID is Not Data Protection

The Electron docs explicitly state: "This API itself will not protect your user data; rather, it is a mechanism to allow you to do so."

`promptTouchID` is just a biometric confirmation dialog. It does NOT encrypt data. Pair with:
- `safeStorage` for encrypting sensitive data
- Application-level key derivation gated by the Touch ID result
- Keychain integration (via native bindings or `node-keytar`) for production-grade security

[S12]

### 2. Entitlements for Packaged Apps

The docs do NOT explicitly list required entitlements for `promptTouchID` on this page. Based on Apple developer documentation and community evidence, the following entitlements are likely required for packaged builds:

```xml
<!-- entitlements.mac.plist -->
<key>com.apple.security.app-sandbox</key>
<false/>
<!-- OR with sandbox: -->
<key>com.apple.security.temporary-exception.shared-preference.read-only</key>
<array>...</array>
```

For Touch ID specifically, hardened runtime entitlements may require:
```xml
<key>com.apple.security.cs.disable-library-validation</key>
<true/>
```

OPEN QUESTION: Exact entitlements required for `promptTouchID` in a hardened-runtime packaged build. Validate in capstone. See `23-open-questions.md`.

### 3. Simulator vs Real Hardware

Touch ID only works on real macOS hardware with Touch ID sensor or Apple Watch. It will not work on:
- macOS VMs
- Machines without Touch ID / Apple Watch
- CI/CD environments (treat as unavailable; fallback must always work)

### 4. canPromptTouchID() vs Success

`canPromptTouchID()` returns true on machines with Touch ID hardware even when:
- Touch ID is not enrolled
- System is in a locked state
- User has disabled biometrics

If `canPromptTouchID()` is true, still wrap `promptTouchID()` in try/catch.

## Other systemPreferences Methods (macOS)

```typescript
// Dark mode / appearance
systemPreferences.getEffectiveAppearance()
// Returns: 'dark' | 'light' | 'highContrast'
// Better to use nativeTheme.shouldUseDarkColors for reactive updates

// Accessibility display
systemPreferences.getAnimationSettings()
// { shouldRenderRichAnimation, scrollAnimationsEnabledBySystem, prefersReducedMotion }

// Media access permissions
systemPreferences.getMediaAccessStatus('camera')
systemPreferences.getMediaAccessStatus('microphone')
// Returns: 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'

await systemPreferences.askForMediaAccess('microphone')
// Returns: boolean (granted or denied)
// Requires NSMicrophoneUsageDescription in Info.plist
```

NOTE: `systemPreferences.accessibilityDisplayShouldReduceTransparency` was deprecated in Electron 34. Use `nativeTheme.prefersReducedTransparency` instead. [S29]

## Testing Touch ID in Development

```typescript
// IPC handler for testing
ipcMain.handle('debug:touchid-test', async () => {
  const supported = systemPreferences.canPromptTouchID()
  if (!supported) return { supported: false, result: null }

  try {
    await systemPreferences.promptTouchID('Testing Touch ID integration')
    return { supported: true, result: 'success' }
  } catch (err) {
    return { supported: true, result: 'failed', error: String(err) }
  }
})
```
