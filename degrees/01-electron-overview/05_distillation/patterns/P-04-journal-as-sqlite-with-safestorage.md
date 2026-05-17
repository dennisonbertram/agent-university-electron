# P-04 — Journal-as-SQLite with safeStorage row-level encryption

**When to use**: persisting user-generated content that must be encrypted at rest.
**Evidence**: Capstone `journal-store.ts` (`03_pocs/L-capstone-pulse/src/journal-store.ts`).

## Pattern

```typescript
// src/journal-store.ts
import Database from 'better-sqlite3'

export function installJournalStore(opts: InstallJournalStoreOptions): JournalStore {
  const { logger, dbPath, encryptor } = opts
  const encrypt = opts.encryptionAvailable

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      ciphertext BLOB NOT NULL,
      length INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_journal_created_at ON journal(created_at);
  `)

  if (!encrypt) {
    logger.warn('journal:encryption-unavailable:fallback-plaintext', { dbPath })
  }

  const insertStmt = db.prepare(
    'INSERT INTO journal (ts, ciphertext, length, created_at) VALUES (?, ?, ?, ?)',
  )
  return {
    append(text: string): AppendResult {
      const ciphertext: Buffer = encrypt
        ? encryptor.encrypt(text)            // safeStorage.encryptString under the hood
        : Buffer.from(text, 'utf8')
      const ts = new Date().toISOString()
      const result = insertStmt.run(ts, ciphertext, text.length, Date.now())
      logger.info('journal:row:inserted', {
        id: Number(result.lastInsertRowid), length: text.length, encrypted: encrypt,
      })
      return { id: Number(result.lastInsertRowid), ts, length: text.length, encrypted: encrypt }
    },
    // listDecrypted / listRowsForTest / close ...
  }
}
```

The encryptor adapter is built in main.ts:

```typescript
function buildEncryptor() {
  return {
    encrypt(plaintext: string): Buffer {
      const { safeStorage } = require('electron')
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.encryptString(plaintext)
      }
      logger.warn('journal:encryption-unavailable:fallback-plaintext', {})
      return Buffer.from(plaintext, 'utf8')
    },
    decrypt(ciphertext: Buffer): string {
      const { safeStorage } = require('electron')
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(ciphertext)
      }
      return ciphertext.toString('utf8')
    },
  }
}
```

## Why it works

- **SQLite + WAL** gives crash-safe, atomic inserts. Row-level granularity beats one-big-file-rewrite for journals.
- **`safeStorage` per-row encryption** uses the OS keyring (macOS Keychain). Decryption only works on the same machine / same user / same bundle ID.
- **Fallback to plaintext** when `isEncryptionAvailable()` returns false (Linux without keyring, certain CI environments) — explicit warn log makes the fallback observable.
- **Static-source sentinel** `safeStorage.encryptString` literal in the file lets a regression test verify the file references the API even if the runtime path doesn't fire under e2e (the capstone's R-C-2 check).

## Tradeoffs

- `better-sqlite3` is a native module — bring `electron-rebuild` and possibly source patches (see G-13).
- `safeStorage` is scoped to bundle ID. Changing the bundle ID (dev → prod) makes existing data unreadable (`23-open-questions.md#OQ-10`).
- Per-row encryption pays the AES setup cost per row; for high write volumes, encrypt batches.

## Variants

- **PBKDF2 + per-app key** instead of safeStorage — portable but requires a passphrase prompt.
- **`crypto.createCipheriv` + key-from-keychain via `keytar`** — more flexible than `safeStorage` but adds a native dep.

## Evidence

- `03_pocs/L-capstone-pulse/src/journal-store.ts`
- `03_pocs/L-capstone-pulse/src/main.ts:196-233`
- `03_pocs/L-capstone-pulse/poc-report.md` §"Invariants" 3
- `01_research/13-storage-and-safestorage.md`
