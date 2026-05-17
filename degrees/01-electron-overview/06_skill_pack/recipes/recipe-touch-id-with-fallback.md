# Recipe — Touch ID with Env-Flag Test Seam

**Use when**: Gating a sensitive operation behind biometric authentication with a passphrase fallback.

## Code

```typescript
// src/biometric.ts
import { systemPreferences } from 'electron'

export interface BiometricService {
  canUseTouchId(): boolean
  promptUnlock(reason: string): Promise<boolean>
}

export function installBiometricService(opts: {
  promptOverride?: (reason: string) => Promise<void>
} = {}): BiometricService {
  const can = (): boolean => {
    // Test seam: force unavailable
    if (process.env.TOUCH_ID_UNAVAILABLE === '1') return false
    // Test seam: force available (skip real hardware check)
    if (process.env.TOUCH_ID_FORCE_AVAILABLE === '1') return true
    try {
      return systemPreferences.canPromptTouchID()
    } catch {
      return false  // Windows, Linux, or method throws
    }
  }

  return {
    canUseTouchId: () => can(),

    async promptUnlock(reason: string): Promise<boolean> {
      if (!can()) return false

      // Injection seam for unit tests
      if (opts.promptOverride) {
        try { await opts.promptOverride(reason); return true }
        catch { return false }
      }

      // Force-available seam: bypass real hardware prompt
      if (process.env.TOUCH_ID_FORCE_AVAILABLE === '1') return true

      try {
        await systemPreferences.promptTouchID(reason)
        return true
      } catch {
        return false
      }
    },
  }
}
```

## Entitlements Required (packaged builds)

```xml
<!-- entitlements.mac.plist -->
<key>com.apple.security.cs.disable-library-validation</key>
<true/>
<!-- Note: Touch ID requires a signed packaged build; dev mode may hang without enrolled finger -->
```

## Test Patterns

```typescript
// E2E: Touch ID unavailable path
const { app, window } = await launchApp({ env: { TOUCH_ID_UNAVAILABLE: '1' } })
const result = await window.evaluate(() => window.api.journalList())
expect(result).toMatchObject({ ok: false, requiresFallback: true })
await app.close()

// E2E: Touch ID force-available path
const { app: app2, window: window2 } = await launchApp({ env: { TOUCH_ID_FORCE_AVAILABLE: '1' } })
const result2 = await window2.evaluate(() => window2.api.journalList())
expect(result2).toMatchObject({ ok: true })
await app2.close()

// Unit: injection seam
const biometric = installBiometricService({
  promptOverride: async (reason) => { /* auto-succeed */ },
})
expect(await biometric.promptUnlock('test')).toBe(true)
```

## Watch Out For

- `systemPreferences.canPromptTouchID()` throws on Windows and Linux — wrap in try/catch.
- On macOS without an enrolled fingerprint, `promptTouchID` hangs indefinitely — NEVER call it without first checking `canPromptTouchID()`.
- `TOUCH_ID_FORCE_AVAILABLE=1` bypasses the real prompt — intended only for CI. Never set in production.
- Touch ID in a signed packaged build requires `com.apple.security.cs.disable-library-validation` entitlement, because `LocalAuthentication.framework` is an Apple framework but needs dynamic linking.

Evidence: `../../05_distillation/patterns/P-17-touch-id-with-env-flag-test-seam.md`, `../../01_research/15-system-preferences-touchid.md`
