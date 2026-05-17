# P-16 — Passphrase fallback with PBKDF2 + `crypto.timingSafeEqual`

**When to use**: any sensitive read path that's primarily gated by biometrics but needs a non-biometric fallback.
**Evidence**: capstone `passphrase.ts` (`03_pocs/L-capstone-pulse/src/passphrase.ts`).

## Pattern

```typescript
// src/passphrase.ts
import crypto from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const PBKDF2_ITERS = 100_000
const PBKDF2_KEYLEN = 32
const PBKDF2_DIGEST = 'sha256'

export function hashPassphrase(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
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
    setPassphrase(passphrase) {
      const salt = crypto.randomBytes(16)
      writeFileSync(saltPath, salt)
      const h = hashPassphrase(passphrase, salt)
      if (useWrap) {
        writeFileSync(hashPath, opts.encryptor!.encrypt(h.toString('base64')).toString('base64'), 'utf8')
      } else {
        writeFileSync(hashPath, h)
      }
      return { ok: true }
    },
    verify(passphrase) {
      const salt = readFileSync(saltPath)
      const expected = useWrap
        ? Buffer.from(opts.encryptor!.decrypt(Buffer.from(readFileSync(hashPath, 'utf8'), 'base64')), 'base64')
        : readFileSync(hashPath)
      const candidate = hashPassphrase(passphrase, salt)
      if (candidate.length !== expected.length) return false
      try {
        return crypto.timingSafeEqual(candidate, expected)
      } catch {
        return false
      }
    },
  }
}
```

## Why it works

- **PBKDF2 with 100K iterations** — slow enough to deter brute-force; fast enough that a single check takes < 100ms.
- **Per-install salt** — same passphrase produces different hashes on different machines; rainbow tables are useless.
- **`crypto.timingSafeEqual`** — constant-time byte comparison; an attacker cannot infer the hash byte-by-byte via timing.
- **Wrapped with safeStorage** — even root-on-disk doesn't yield the raw hash (only the safeStorage-wrapped variant).
- **Falls back gracefully** when safeStorage is unavailable (raw hash storage).

## Tradeoffs

- PBKDF2 is dated; modern alternatives (Argon2, scrypt) are slower-by-design but require additional deps.
- The salt and hash are in two files; a future refactor that moves them must keep them paired.
- The fallback path stores the raw hash bytes — if an attacker gets the file AND knows it's an unwrapped variant, they can run offline PBKDF2.

## Variants

- **scrypt**: `crypto.scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1 })` — slower, memory-hard.
- **Argon2 via `argon2` npm**: requires native deps.

## Evidence

- `03_pocs/L-capstone-pulse/src/passphrase.ts`
- `03_pocs/L-capstone-pulse/poc-report.md` BT-C-7
