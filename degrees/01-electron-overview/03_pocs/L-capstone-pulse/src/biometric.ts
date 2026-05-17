/**
 * Touch ID wrapper for Pulse — RED commit stub.
 *
 * Capability resolution:
 *   - If env `TOUCH_ID_UNAVAILABLE === '1'`, always return false (BT-C-6).
 *   - If env `TOUCH_ID_FORCE_AVAILABLE === '1'`, always return true (BT-C-8).
 *   - Otherwise, delegate to `systemPreferences.canPromptTouchID()`.
 *
 * Real Touch ID can't be invoked from Playwright. Test code path:
 *   - BT-C-6: TOUCH_ID_UNAVAILABLE=1 ⇒ canUseTouchId() returns false ⇒
 *     `journal:list` returns `{ requiresFallback: true, reason: 'touch-id-unavailable' }`.
 *   - BT-C-8: TOUCH_ID_FORCE_AVAILABLE=1 ⇒ canUseTouchId() returns true ⇒
 *     a STUBBED `promptUnlock()` resolves true ⇒ `journal:list` returns `{ ok: true, entries }`.
 *
 * RED: every entry point throws.
 */

export interface BiometricService {
  canUseTouchId(): boolean
  /**
   * Prompts the user. Returns true on success, false on cancellation / failure
   * / Touch ID unavailable. Never throws.
   */
  promptUnlock(reason: string): Promise<boolean>
}

export interface InstallBiometricServiceOptions {
  /**
   * Optional injected prompt function. When provided (e.g. tests),
   * `promptUnlock` calls this instead of `systemPreferences.promptTouchID`.
   * The capstone main process uses the default — undefined — so the real
   * API is exercised on hardware.
   */
  readonly promptOverride?: (reason: string) => Promise<void>
}

export function installBiometricService(_opts?: InstallBiometricServiceOptions): BiometricService {
  throw new Error('biometric: installBiometricService not implemented (RED)')
}
