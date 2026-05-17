# Recipe — safeStorage Encryption

**Use when**: Encrypting secrets using the OS keyring (macOS Keychain, Windows DPAPI, Linux keyring).

## Code

```typescript
// src/encryption.ts
import { safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export function buildEncryptor(opts: { logger: Logger }) {
  const available = safeStorage.isEncryptionAvailable()
  if (!available) {
    opts.logger.warn('encryption:unavailable:fallback-plaintext', {})
  }

  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),

    encrypt(plaintext: string): Buffer {
      if (!safeStorage.isEncryptionAvailable()) {
        opts.logger.warn('encryption:unavailable:returning-plaintext', {})
        return Buffer.from(plaintext, 'utf8')
      }
      return safeStorage.encryptString(plaintext)
    },

    decrypt(ciphertext: Buffer): string {
      if (!safeStorage.isEncryptionAvailable()) {
        return ciphertext.toString('utf8')
      }
      return safeStorage.decryptString(ciphertext)
    },

    async saveToFile(filePath: string, plaintext: string): Promise<void> {
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })
      const encrypted = this.encrypt(plaintext)
      await fs.writeFile(filePath, encrypted)
    },

    async loadFromFile(filePath: string): Promise<string | null> {
      try {
        const buf = await fs.readFile(filePath)
        return this.decrypt(buf)
      } catch {
        return null
      }
    },
  }
}
```

## Usage in journal-store pattern

```typescript
// Encrypt each row:
const ciphertext = encryptor.encrypt(journalText)
insertStmt.run(ciphertext, Date.now())

// Decrypt on read:
const rows = db.prepare('SELECT ciphertext FROM journal').all()
return rows.map(r => encryptor.decrypt(r.ciphertext))
```

## Test Pattern

```typescript
it('R-enc-01: journal-store.ts references safeStorage.encryptString', () => {
  const src = readFileSync('src/journal-store.ts', 'utf8')
  expect(src).toMatch(/safeStorage\.encryptString/)
})

// E2E test — encryption unavailable path (CI without keyring):
const { app, window } = await launchApp({
  env: { ELECTRON_SAFESTORE_UNAVAILABLE: '1' }  // your custom flag
})
// Verify: fallback warning logged, data still stored (as plaintext in test)
```

## Watch Out For

- `safeStorage` is scoped to the **bundle ID** (`CFBundleIdentifier`). Changing the bundle ID between dev and prod makes all existing encrypted data unreadable. Never change bundle IDs mid-lifecycle.
- `isEncryptionAvailable()` returns `false` on Linux without a keyring daemon (GNOME Keyring, KDE Wallet) and on some CI environments. ALWAYS check before calling `encryptString`.
- `encryptString` returns a `Buffer` containing platform-specific binary data — NOT a human-readable string. Store as binary (`Buffer.from(...)`) or base64 — never UTF-8 decode it.
- `decryptString` can throw if the data was encrypted by a different user, machine, or bundle ID. Wrap in try/catch.

Evidence: `../../05_distillation/patterns/P-04-journal-as-sqlite-with-safestorage.md`, `../../01_research/13-storage-and-safestorage.md`
