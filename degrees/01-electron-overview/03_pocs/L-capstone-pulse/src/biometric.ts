/**
 * Touch ID wrapper for Pulse — GREEN.
 *
 * Capability resolution:
 *   - `TOUCH_ID_UNAVAILABLE=1` ⇒ canUseTouchId() returns false (BT-C-6).
 *   - `TOUCH_ID_FORCE_AVAILABLE=1` ⇒ canUseTouchId() returns true (BT-C-8).
 *   - Otherwise, delegates to `systemPreferences.canPromptTouchID()`.
 *
 * promptUnlock:
 *   - If we cannot use Touch ID, return false (the journal IPC handler then
 *     surfaces `requiresFallback: true`).
 *   - If an override is provided (test injection), call it; resolve→true,
 *     reject→false.
 *   - Otherwise, call `systemPreferences.promptTouchID(reason)`.
 */
import { systemPreferences } from 'electron'

export interface BiometricService {
  canUseTouchId(): boolean
  promptUnlock(reason: string): Promise<boolean>
}

export interface InstallBiometricServiceOptions {
  readonly promptOverride?: (reason: string) => Promise<void>
}

export function installBiometricService(opts: InstallBiometricServiceOptions = {}): BiometricService {
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
    canUseTouchId(): boolean {
      return can()
    },
    async promptUnlock(reason: string): Promise<boolean> {
      if (!can()) return false
      // For BT-C-8 (TOUCH_ID_FORCE_AVAILABLE=1) on hardware without real Touch
      // ID, the real promptTouchID call would hang. The override seam lets
      // tests resolve/reject deterministically. The default for that env
      // branch is a no-op resolved promise.
      if (opts.promptOverride) {
        try {
          await opts.promptOverride(reason)
          return true
        } catch {
          return false
        }
      }
      if (process.env.TOUCH_ID_FORCE_AVAILABLE === '1') {
        // Test seam: with FORCE_AVAILABLE and no override, resolve true so the
        // Playwright suite can assert the `journal:unlocked:touch-id` path.
        return true
      }
      try {
        await systemPreferences.promptTouchID(reason)
        return true
      } catch {
        return false
      }
    },
  }
}
