/**
 * Journal store tests — CRUD with a stub encryptor.
 *
 * We exercise the real better-sqlite3 (loaded under system Node, not Electron
 * — see research/14-native-modules.md: the module is portable to system Node
 * for unit tests; the rebuild is only required to LOAD it inside Electron's
 * renderer/main process).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

vi.mock('electron', () => ({}))

import { installJournalStore } from '../../src/journal-store'

function silentLogger() {
  return { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never
}

// Stub encryptor — uses a simple XOR so we can verify decrypt round-trips
// without depending on the OS keychain.
const KEY = Buffer.from('pulse-test-key')
function xor(b: Buffer): Buffer {
  const out = Buffer.alloc(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b[i]! ^ KEY[i % KEY.length]!
  return out
}
const stubEncryptor = {
  encrypt: (s: string): Buffer => xor(Buffer.from(s, 'utf8')),
  decrypt: (b: Buffer): string => xor(b).toString('utf8'),
}

let tmpDir: string
let dbPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'pulse-journal-test-'))
  dbPath = path.join(tmpDir, 'journal.db')
})
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('journal-store — encrypted CRUD', () => {
  it('append() stores a row with ciphertext (NOT plaintext)', () => {
    const store = installJournalStore({
      logger: silentLogger(), dbPath,
      encryptionAvailable: true, encryptor: stubEncryptor,
    })
    const out = store.append('hello world')
    expect(out.id).toBeGreaterThan(0)
    expect(out.encrypted).toBe(true)
    const rows = store.listRowsForTest()
    expect(rows.length).toBe(1)
    expect(rows[0]!.ciphertext).toBeInstanceOf(Buffer)
    expect(rows[0]!.ciphertext.toString('utf8')).not.toBe('hello world')
    expect(rows[0]!.length).toBe('hello world'.length)
    store.close()
  })

  it('listDecrypted() decrypts roundtrip', () => {
    const store = installJournalStore({
      logger: silentLogger(), dbPath,
      encryptionAvailable: true, encryptor: stubEncryptor,
    })
    store.append('alpha')
    store.append('beta')
    const decrypted = store.listDecrypted()
    expect(decrypted.length).toBe(2)
    const texts = decrypted.map((e) => e.text).sort()
    expect(texts).toEqual(['alpha', 'beta'])
    store.close()
  })

  it('hasCreatedAtIndex() is true after install (R-C-3)', () => {
    const store = installJournalStore({
      logger: silentLogger(), dbPath,
      encryptionAvailable: true, encryptor: stubEncryptor,
    })
    expect(store.hasCreatedAtIndex()).toBe(true)
    store.close()
  })

  it('fallback path: encryptionAvailable=false stores plaintext bytes (R-C-1)', () => {
    const store = installJournalStore({
      logger: silentLogger(), dbPath,
      encryptionAvailable: false, encryptor: stubEncryptor,
    })
    const out = store.append('plain-fallback')
    expect(out.encrypted).toBe(false)
    const rows = store.listRowsForTest()
    expect(rows[0]!.ciphertext.toString('utf8')).toBe('plain-fallback')
    store.close()
  })
})
