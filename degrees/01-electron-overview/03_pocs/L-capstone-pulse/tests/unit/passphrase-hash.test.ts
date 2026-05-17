/**
 * Passphrase hash + verify with timing-safe compare.
 *
 * RED: hashPassphrase + installPassphraseStore throw.
 * GREEN: PBKDF2-SHA256 hashes round-trip; verify() uses timingSafeEqual.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

vi.mock('electron', () => ({}))

import { hashPassphrase, installPassphraseStore } from '../../src/passphrase'

let userDataDir: string
beforeEach(() => {
  userDataDir = mkdtempSync(path.join(os.tmpdir(), 'pulse-pass-test-'))
})
afterEach(() => {
  rmSync(userDataDir, { recursive: true, force: true })
})

describe('hashPassphrase — pure', () => {
  it('returns a 32-byte buffer for any input', () => {
    const salt = crypto.randomBytes(16)
    const hash = hashPassphrase('hello', salt)
    expect(hash).toBeInstanceOf(Buffer)
    expect(hash.length).toBe(32)
  })
  it('different passphrases produce different hashes', () => {
    const salt = crypto.randomBytes(16)
    const a = hashPassphrase('aaaa', salt)
    const b = hashPassphrase('bbbb', salt)
    expect(a.equals(b)).toBe(false)
  })
  it('same passphrase + same salt produces same hash', () => {
    const salt = crypto.randomBytes(16)
    const a = hashPassphrase('zzzz', salt)
    const b = hashPassphrase('zzzz', salt)
    expect(a.equals(b)).toBe(true)
  })
})

describe('installPassphraseStore', () => {
  it('isSet() is false before setPassphrase', () => {
    const store = installPassphraseStore({ userDataDir, disableSafeStorageWrap: true })
    expect(store.isSet()).toBe(false)
  })
  it('after setPassphrase, isSet() is true and verify(correct) is true', () => {
    const store = installPassphraseStore({ userDataDir, disableSafeStorageWrap: true })
    store.setPassphrase('correct horse battery staple')
    expect(store.isSet()).toBe(true)
    expect(store.verify('correct horse battery staple')).toBe(true)
  })
  it('verify(wrong) is false', () => {
    const store = installPassphraseStore({ userDataDir, disableSafeStorageWrap: true })
    store.setPassphrase('right')
    expect(store.verify('wrong')).toBe(false)
  })
  it('survives reload (salt + hash persisted)', () => {
    const a = installPassphraseStore({ userDataDir, disableSafeStorageWrap: true })
    a.setPassphrase('persist-me')
    const b = installPassphraseStore({ userDataDir, disableSafeStorageWrap: true })
    expect(b.isSet()).toBe(true)
    expect(b.verify('persist-me')).toBe(true)
    expect(b.verify('not-me')).toBe(false)
  })
})
