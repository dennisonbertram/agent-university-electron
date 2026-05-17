# P-17 — Touch ID gating with env-flag test seam

**When to use**: any sensitive read path that uses `systemPreferences.promptTouchID`.
**Evidence**: capstone `biometric.ts` (`03_pocs/L-capstone-pulse/src/biometric.ts`).

## Pattern

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
    if (process.env.TOUCH_ID_UNAVAILABLE === '1') return false
    if (process.env.TOUCH_ID_FORCE_AVAILABLE === '1') return true
    try {
      return systemPreferences.canPromptTouchID()
    } catch {
      return false
    }
  }
  return {
    canUseTouchId: () => can(),
    async promptUnlock(reason: string) {
      if (!can()) return false
      if (opts.promptOverride) {
        try { await opts.promptOverride(reason); return true } catch { return false }
      }
      // Force-available test seam: skip real prompt; tests that need this asserted
      // pass a promptOverride OR rely on this no-op resolution.
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

In tests:

```typescript
// tests/e2e/biometric-unavailable.spec.ts (BT-C-6)
const app = await launchApp({ env: { TOUCH_ID_UNAVAILABLE: '1' } })
const result = await window.api.journalList()
expect(result).toMatchObject({ ok: false, requiresFallback: true, reason: 'touch-id-unavailable' })

// tests/e2e/biometric-force-available.spec.ts (BT-C-8)
const app = await launchApp({ env: { TOUCH_ID_FORCE_AVAILABLE: '1' } })
const result = await window.api.journalList()
expect(result).toMatchObject({ ok: true, source: 'touch-id' })
```

## Why it works

- Two env flags (`TOUCH_ID_UNAVAILABLE`, `TOUCH_ID_FORCE_AVAILABLE`) cover the "no hardware" and "yes hardware" branches deterministically.
- The `promptOverride` parameter is the injection seam for unit tests; the env-flag seam is for e2e tests where the renderer can't inject a function.
- The real `systemPreferences.promptTouchID` call is reachable when neither flag is set, so dev/manual testing uses the real hardware.
- The `try/catch around `canPromptTouchID()` defends against platforms where the method throws (Windows, Linux).

## Tradeoffs

- The env-flag seam is checked on every call to `canUseTouchId()`. For very hot paths, cache the value.
- The `TOUCH_ID_FORCE_AVAILABLE === '1' → return true` no-op short-circuits the real prompt; manual testing of the real Touch ID prompt requires unsetting the flag.

## Variants

- **`promptOverride` injection** for unit tests of the journal IPC handler. Lets the test reject the prompt deterministically.

## Evidence

- `03_pocs/L-capstone-pulse/src/biometric.ts`
- `03_pocs/L-capstone-pulse/poc-report.md` BT-C-6, BT-C-8
- `04_logs/decision-log.md#decision-10` (env-flag test seam pattern carried forward)
