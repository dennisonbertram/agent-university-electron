/**
 * entitlements.mac.plist — hardened-runtime entry inspection (BT-L5-9).
 *
 * We parse the plist file and assert that the hardened-runtime entries
 * required for notarization are present with the expected boolean values.
 *
 * Per research 17-code-signing-notarization.md the minimal hardened-runtime
 * surface for an Electron app is:
 *   - com.apple.security.cs.allow-jit (true) — Electron's V8 needs JIT.
 *   - com.apple.security.cs.disable-library-validation (true) — Electron
 *     loads its own framework dylib chain.
 *   - com.apple.security.network.client (true) — auto-update + crash report
 *     upload need outbound HTTP.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import plist from 'plist'

const POC_ROOT = path.resolve(__dirname, '..', '..')
const ENTITLEMENTS_PATH = path.join(POC_ROOT, 'entitlements.mac.plist')

interface PlistDict {
  [key: string]: unknown
}

function readPlist(): PlistDict {
  if (!existsSync(ENTITLEMENTS_PATH)) {
    throw new Error(`entitlements file missing: ${ENTITLEMENTS_PATH}`)
  }
  const xml = readFileSync(ENTITLEMENTS_PATH, 'utf8')
  const parsed = plist.parse(xml) as PlistDict
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('entitlements.mac.plist did not parse to a dictionary')
  }
  return parsed
}

describe('entitlements.mac.plist — hardened-runtime entries (BT-L5-9)', () => {
  it('plist file exists at the POC root', () => {
    expect(existsSync(ENTITLEMENTS_PATH)).toBe(true)
  })

  it('declares com.apple.security.cs.allow-jit = true', () => {
    const entries = readPlist()
    expect(entries['com.apple.security.cs.allow-jit']).toBe(true)
  })

  it('declares com.apple.security.cs.disable-library-validation = true', () => {
    const entries = readPlist()
    expect(entries['com.apple.security.cs.disable-library-validation']).toBe(true)
  })

  it('declares com.apple.security.network.client = true', () => {
    const entries = readPlist()
    expect(entries['com.apple.security.network.client']).toBe(true)
  })

  it('declares com.apple.security.cs.allow-unsigned-executable-memory key explicitly', () => {
    // We accept either true OR false, but the key must be present — leaving
    // it undefined falls back to the default which differs by Electron
    // version. Explicit declaration is the safe play.
    const entries = readPlist()
    expect(
      Object.prototype.hasOwnProperty.call(entries, 'com.apple.security.cs.allow-unsigned-executable-memory'),
    ).toBe(true)
  })
})
