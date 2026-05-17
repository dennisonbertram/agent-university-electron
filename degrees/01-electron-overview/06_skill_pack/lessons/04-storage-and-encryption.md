# Lesson 04 — Storage and Encryption

**Prerequisites**: [03-ipc-patterns-and-validation.md](./03-ipc-patterns-and-validation.md)  
**Next**: [05-native-modules-and-rebuild.md](./05-native-modules-and-rebuild.md)

## Where to Store Data

```
app.getPath('userData')          — per-user app data (preferences, DB)
app.getPath('logs')              — log files
app.getPath('documents')         — user-facing files (open in Finder)
app.getPath('temp')              — ephemeral; cleaned by OS
```

Set the `userData` path BEFORE `app.whenReady` to support test isolation:

```typescript
// src/main.ts — module-load scope
if (process.env.USER_DATA_DIR) {
  app.setPath('userData', process.env.USER_DATA_DIR)
}
```

## Atomic JSON Writes

A plain `fs.writeFile` overwrites the target — if the process crashes mid-write, the file is corrupt. Use write-rename:

```typescript
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export async function atomicWriteJson(targetPath: string, data: unknown): Promise<void> {
  const dir = path.dirname(targetPath)
  await fs.mkdir(dir, { recursive: true })
  const tmpPath = path.join(dir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`)
  await fs.writeFile(tmpPath, JSON.stringify(data), 'utf8')
  // fs.rename is atomic on POSIX and NTFS within the same filesystem
  await fs.rename(tmpPath, targetPath)
}
```

A crash between `writeFile` and `rename` leaves the original file intact. The temp file is orphaned — sweep them on app start with:

```typescript
const orphans = (await fs.readdir(dir)).filter(f => f.endsWith('.tmp'))
await Promise.all(orphans.map(f => fs.unlink(path.join(dir, f)).catch(() => {})))
```

## safeStorage — OS Keyring Encryption

`safeStorage` encrypts strings using the OS keyring (macOS Keychain). The encrypted blob is machine-local and user-local — only the same app on the same machine decrypts it.

```typescript
import { safeStorage } from 'electron'

// Encrypt
if (safeStorage.isEncryptionAvailable()) {
  const encrypted: Buffer = safeStorage.encryptString('my-secret')
  await fs.writeFile(secretPath, encrypted)
}

// Decrypt
const buf = await fs.readFile(secretPath)
if (safeStorage.isEncryptionAvailable()) {
  const plaintext = safeStorage.decryptString(buf)
}
```

Always check `isEncryptionAvailable()` first — returns false on Linux without a keyring and in some CI environments. Log a warning and fall back to plaintext storage (not plaintext transmission — different risk).

**Important**: `safeStorage` is scoped to the bundle ID (`CFBundleIdentifier`). Changing the bundle ID between dev and prod makes existing encrypted data unreadable.

## SQLite with better-sqlite3

For structured data, SQLite via `better-sqlite3` is the production pattern:

```typescript
import Database from 'better-sqlite3'

const db = new Database(path.join(app.getPath('userData'), 'app.db'))
db.pragma('journal_mode = WAL')   // Write-Ahead Logging for concurrent reads
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content BLOB NOT NULL,
    created_at INTEGER NOT NULL
  )
`)

const insert = db.prepare('INSERT INTO entries (content, created_at) VALUES (?, ?)')
insert.run(Buffer.from(text, 'utf8'), Date.now())
```

SQLite + WAL gives:
- Crash-safe atomic writes
- Concurrent readers without locking writers
- Row-level granularity (no rewriting the whole file for each append)

Row-level encryption with safeStorage:

```typescript
const ciphertext = safeStorage.isEncryptionAvailable()
  ? safeStorage.encryptString(text)
  : Buffer.from(text, 'utf8')
insert.run(ciphertext, Date.now())
```

See [recipes/recipe-better-sqlite3-with-auto-unpack.md](../recipes/recipe-better-sqlite3-with-auto-unpack.md) for packaging requirements (native module auto-unpack).

## PBKDF2 Passphrase Hashing

For user-chosen passphrases (fallback when biometrics unavailable):

```typescript
import crypto from 'node:crypto'

const ITERS = 100_000
const KEYLEN = 32

function hashPassphrase(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, ITERS, KEYLEN, 'sha256')
}

// Store:
const salt = crypto.randomBytes(16)
const hash = hashPassphrase(passphrase, salt)

// Verify (timing-safe comparison):
const candidate = hashPassphrase(passphrase, storedSalt)
return crypto.timingSafeEqual(candidate, storedHash)
```

- 100K iterations is slow enough to deter brute force, fast enough for interactive use (~50ms)
- Per-install random salt defeats rainbow tables
- `crypto.timingSafeEqual` prevents timing-oracle attacks

## File Watching

`fs.watch` is adequate for watching config files or data directories:

```typescript
import { watch } from 'node:fs'

const watcher = watch(dataDir, (eventType, filename) => {
  if (filename?.endsWith('.json')) {
    reload()
  }
})

app.on('will-quit', () => watcher.close())
```

macOS gotcha (G-04): `fs.watch` on macOS emits `rename` for file modifications in some edge cases, not just for actual renames. Handle both `change` and `rename` events if you need reliable file-change detection.

## Storage Design Rules

1. All file I/O in main process only — never renderer.
2. Use `app.getPath('userData')` as the root, not `__dirname`.
3. Atomic write-rename for any file that must survive crashes.
4. `safeStorage` for secrets tied to the OS keyring; PBKDF2 for user-chosen passphrases.
5. SQLite + WAL for structured data with high write frequency.
6. Set `USER_DATA_DIR` env var path before `app.whenReady` for test isolation.

## Key Takeaways

1. `app.getPath('userData')` is the canonical storage root.
2. Write-rename (atomic) is the only correct pattern for crash-safe file writes.
3. `safeStorage` uses OS keyring; it's machine+bundle-scoped.
4. SQLite + WAL is better than JSON files for structured data.
5. PBKDF2 + `timingSafeEqual` for passphrase verification.
6. Override `userData` via env var for test isolation.

Evidence: `../../05_distillation/patterns/P-03-atomic-write-rename-for-json-persistence.md`, `../../05_distillation/patterns/P-04-journal-as-sqlite-with-safestorage.md`, `../../05_distillation/patterns/P-16-passphrase-fallback-with-pbkdf2.md`, `../../01_research/13-storage-and-safestorage.md`
