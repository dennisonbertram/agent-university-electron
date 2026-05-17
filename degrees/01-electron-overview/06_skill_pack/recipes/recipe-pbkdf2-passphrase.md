# Recipe — PBKDF2 Passphrase Hashing

**Use when**: Storing and verifying a user-chosen passphrase.

## Code

```typescript
// src/passphrase.ts
import crypto from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const PBKDF2_ITERS = 100_000   // ~50ms on modern hardware
const PBKDF2_KEYLEN = 32
const PBKDF2_DIGEST = 'sha256'

export function hashPassphrase(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    passphrase, salt, PBKDF2_ITERS, PBKDF2_KEYLEN, PBKDF2_DIGEST
  )
}

export interface PassphraseStore {
  isSet(): boolean
  setPassphrase(passphrase: string): { ok: boolean }
  verify(passphrase: string): boolean
}

export function installPassphraseStore(opts: {
  userDataDir: string
  encryptor?: { encrypt(s: string): Buffer; decrypt(b: Buffer): string }
}): PassphraseStore {
  const saltPath = path.join(opts.userDataDir, 'passphrase.salt')
  const hashPath = path.join(opts.userDataDir, 'passphrase.bin')
  const useWrap = !!opts.encryptor

  return {
    isSet: () => existsSync(saltPath) && existsSync(hashPath),

    setPassphrase(passphrase: string) {
      const salt = crypto.randomBytes(16)
      writeFileSync(saltPath, salt)
      const hash = hashPassphrase(passphrase, salt)
      if (useWrap) {
        // Wrap hash with safeStorage for defense in depth
        const wrapped = opts.encryptor!.encrypt(hash.toString('base64'))
        writeFileSync(hashPath, wrapped.toString('base64'), 'utf8')
      } else {
        writeFileSync(hashPath, hash)
      }
      return { ok: true }
    },

    verify(passphrase: string): boolean {
      if (!existsSync(saltPath) || !existsSync(hashPath)) return false
      try {
        const salt = readFileSync(saltPath)
        const stored: Buffer = useWrap
          ? Buffer.from(
              opts.encryptor!.decrypt(
                Buffer.from(readFileSync(hashPath, 'utf8'), 'base64')
              ),
              'base64'
            )
          : readFileSync(hashPath)
        const candidate = hashPassphrase(passphrase, salt)
        if (candidate.length !== stored.length) return false
        return crypto.timingSafeEqual(candidate, stored)
      } catch {
        return false
      }
    },
  }
}
```

## Test Pattern

```typescript
import { tmpdir } from 'node:os'
import { mkdtempSync } from 'node:fs'

it('passphrase roundtrip: set and verify', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'test-pp-'))
  const store = installPassphraseStore({ userDataDir: dir })
  store.setPassphrase('correct-horse-battery-staple')
  expect(store.verify('correct-horse-battery-staple')).toBe(true)
  expect(store.verify('wrong-passphrase')).toBe(false)
})

it('timing safe: verify does not throw for different-length hashes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'test-pp-'))
  const store = installPassphraseStore({ userDataDir: dir })
  store.setPassphrase('hello')
  // Corrupt the hash file to simulate length mismatch
  writeFileSync(path.join(dir, 'passphrase.bin'), Buffer.alloc(16))
  expect(store.verify('hello')).toBe(false)  // should not throw
})
```

## Watch Out For

- `crypto.timingSafeEqual` requires both buffers to have the SAME LENGTH — it throws otherwise. Guard with `if (candidate.length !== stored.length) return false` before calling it.
- 100K PBKDF2 iterations takes ~50ms synchronously. This is acceptable for interactive use. For higher security, consider 200K iterations or `crypto.scryptSync`.
- The salt and hash files must be kept together — storing in separate files is acceptable but requires both to be present to verify.
- `safeStorage.encryptString` wrapping the hash adds defense-in-depth: even if an attacker gets the `.bin` file, they can't run offline PBKDF2 against the wrapped hash.

Evidence: `../../05_distillation/patterns/P-16-passphrase-fallback-with-pbkdf2.md`
