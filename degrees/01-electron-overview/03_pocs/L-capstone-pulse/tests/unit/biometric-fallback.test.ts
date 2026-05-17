/**
 * Touch ID capability-check branch tests.
 *
 * The three env-flag branches:
 *   - TOUCH_ID_UNAVAILABLE=1   ⇒ canUseTouchId() === false
 *   - TOUCH_ID_FORCE_AVAILABLE=1 ⇒ canUseTouchId() === true (regardless of HW)
 *   - neither                  ⇒ delegates to systemPreferences.canPromptTouchID
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  systemPreferences: {
    canPromptTouchID: vi.fn(() => true),
    promptTouchID: vi.fn(async () => undefined),
  },
}))

import { installBiometricService } from '../../src/biometric'

const ENV_KEYS = ['TOUCH_ID_UNAVAILABLE', 'TOUCH_ID_FORCE_AVAILABLE']

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k]
})
afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k]
})

describe('biometric — capability branches', () => {
  it('TOUCH_ID_UNAVAILABLE=1 forces canUseTouchId()=false', () => {
    process.env.TOUCH_ID_UNAVAILABLE = '1'
    const svc = installBiometricService()
    expect(svc.canUseTouchId()).toBe(false)
  })
  it('TOUCH_ID_FORCE_AVAILABLE=1 forces canUseTouchId()=true', () => {
    process.env.TOUCH_ID_FORCE_AVAILABLE = '1'
    const svc = installBiometricService()
    expect(svc.canUseTouchId()).toBe(true)
  })
  it('default delegates to systemPreferences.canPromptTouchID', () => {
    const svc = installBiometricService()
    expect(svc.canUseTouchId()).toBe(true)
  })
  it('promptUnlock with no Touch ID returns false', async () => {
    process.env.TOUCH_ID_UNAVAILABLE = '1'
    const svc = installBiometricService()
    expect(await svc.promptUnlock('test')).toBe(false)
  })
  it('promptUnlock with TOUCH_ID_FORCE_AVAILABLE + injected override that resolves returns true', async () => {
    process.env.TOUCH_ID_FORCE_AVAILABLE = '1'
    const svc = installBiometricService({ promptOverride: async () => undefined })
    expect(await svc.promptUnlock('test')).toBe(true)
  })
  it('promptUnlock with TOUCH_ID_FORCE_AVAILABLE + injected override that rejects returns false', async () => {
    process.env.TOUCH_ID_FORCE_AVAILABLE = '1'
    const svc = installBiometricService({ promptOverride: async () => { throw new Error('cancel') } })
    expect(await svc.promptUnlock('test')).toBe(false)
  })
})
