/**
 * Passphrase storage + verification for the journal fallback path — GREEN.
 *
 * Algorithm:
 *   - PBKDF2-SHA-256 with 100_000 iterations + a per-install 16-byte salt.
 *   - Salt stored at `${userData}/passphrase.salt`.
 *   - Hash stored at `${userData}/passphrase.bin`.
 *   - Verify via `crypto.timingSafeEqual`.
 *
 * If an encryptor is provided and `disableSafeStorageWrap !== true`, the
 * hash is wrapped via `encryptor.encrypt(hash.toString('base64'))` before
 * persistence — so even root-on-disk doesn't yield the raw hash.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface PassphraseStore {
  isSet(): boolean
  setPassphrase(passphrase: string): { ok: true }
  verify(passphrase: string): boolean
}

export interface InstallPassphraseStoreOptions {
  readonly userDataDir: string
  readonly disableSafeStorageWrap?: boolean
  readonly encryptor?: {
    encrypt(plaintext: string): Buffer
    decrypt(ciphertext: Buffer): string
  }
}

const PBKDF2_ITERS = 100_000
const PBKDF2_KEYLEN = 32
const PBKDF2_DIGEST = 'sha256'

export function hashPassphrase(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
}

export function installPassphraseStore(opts: InstallPassphraseStoreOptions): PassphraseStore {
  const { userDataDir } = opts
  mkdirSync(userDataDir, { recursive: true })
  const saltPath = path.join(userDataDir, 'passphrase.salt')
  const hashPath = path.join(userDataDir, 'passphrase.bin')
  const useWrap = !opts.disableSafeStorageWrap && !!opts.encryptor

  const readHash = (): Buffer | null => {
    if (!existsSync(hashPath)) return null
    const raw = readFileSync(hashPath)
    if (useWrap && opts.encryptor) {
      try {
        const wrappedAsString = raw.toString('utf8')
        // If the previous write was unwrapped (e.g. before useWrap landed),
        // raw is 32 bytes; decryption would throw. Fall back to raw.
        if (raw.length === PBKDF2_KEYLEN) return raw
        const b64 = opts.encryptor.decrypt(Buffer.from(wrappedAsString, 'base64'))
        return Buffer.from(b64, 'base64')
      } catch {
        // unwrap failed — treat as if no passphrase set (rather than crash)
        return null
      }
    }
    return raw
  }

  const writeHash = (h: Buffer): void => {
    if (useWrap && opts.encryptor) {
      const wrapped = opts.encryptor.encrypt(h.toString('base64'))
      writeFileSync(hashPath, wrapped.toString('base64'), 'utf8')
    } else {
      writeFileSync(hashPath, h)
    }
  }

  const readSalt = (): Buffer | null => {
    if (!existsSync(saltPath)) return null
    return readFileSync(saltPath)
  }

  const writeSalt = (s: Buffer): void => {
    writeFileSync(saltPath, s)
  }

  return {
    isSet(): boolean {
      return existsSync(saltPath) && existsSync(hashPath)
    },
    setPassphrase(passphrase: string): { ok: true } {
      const salt = crypto.randomBytes(16)
      writeSalt(salt)
      writeHash(hashPassphrase(passphrase, salt))
      return { ok: true }
    },
    verify(passphrase: string): boolean {
      const salt = readSalt()
      const expected = readHash()
      if (!salt || !expected) return false
      const candidate = hashPassphrase(passphrase, salt)
      // Constant-time compare.
      if (candidate.length !== expected.length) return false
      try {
        return crypto.timingSafeEqual(candidate, expected)
      } catch {
        return false
      }
    },
  }
}
