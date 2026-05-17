/**
 * entitlements.mac.plist — hardened-runtime keys.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import plist from 'plist'

const POC_ROOT = path.resolve(__dirname, '..', '..')
const ENTITLEMENTS = path.join(POC_ROOT, 'entitlements.mac.plist')

describe('entitlements.mac.plist (Pulse)', () => {
  it('exists', () => {
    expect(existsSync(ENTITLEMENTS)).toBe(true)
  })
  it('declares the required hardened-runtime keys', () => {
    const obj = plist.parse(readFileSync(ENTITLEMENTS, 'utf8')) as Record<string, unknown>
    expect(obj['com.apple.security.cs.allow-jit']).toBe(true)
    expect(obj['com.apple.security.cs.disable-library-validation']).toBe(true)
    expect(obj['com.apple.security.network.client']).toBe(true)
    expect(
      Object.prototype.hasOwnProperty.call(obj, 'com.apple.security.cs.allow-unsigned-executable-memory'),
    ).toBe(true)
  })
})
