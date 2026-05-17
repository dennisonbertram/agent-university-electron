# Storage and safeStorage — Electron

Version: Electron 42.1.0 [S10, S11]

## app.getPath() — Key Paths

```typescript
import { app } from 'electron'
import path from 'node:path'

// macOS paths:
app.getPath('userData')
// ~/Library/Application Support/<AppName>
// IMPORTANT: Store in a subdirectory, not directly here

app.getPath('logs')
// ~/Library/Logs/<AppName>

app.getPath('temp')
// /var/folders/.../T/

app.getPath('crashDumps')
// ~/Library/Application Support/<AppName>/Crashpad
// Override with: app.setPath('crashDumps', customPath)
```

### userData Layout Best Practice

```
~/Library/Application Support/<AppName>/
  Cache/              ← Chromium: DO NOT touch
  GPUCache/           ← Chromium: DO NOT touch
  Local Storage/      ← Chromium: DO NOT touch
  myapp/              ← YOUR data directory
    journal.db        ← SQLite database
    settings.json     ← App settings
    encrypted.bin     ← safeStorage encrypted data
```

```typescript
const APP_DATA_DIR = path.join(app.getPath('userData'), 'myapp')
// Ensure directory exists on startup
import { mkdirSync } from 'node:fs'
mkdirSync(APP_DATA_DIR, { recursive: true })
```

[S10]

## JSON File Persistence with Atomic Writes

For small config files, atomic write-rename prevents corruption:

```typescript
import { writeFileSync, renameSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const SETTINGS_PATH = path.join(app.getPath('userData'), 'myapp', 'settings.json')
const SETTINGS_TMP = SETTINGS_PATH + '.tmp'

interface Settings {
  theme: 'light' | 'dark' | 'system'
  openAtLogin: boolean
}

export function writeSettings(settings: Settings): void {
  const json = JSON.stringify(settings, null, 2)
  writeFileSync(SETTINGS_TMP, json, 'utf-8')
  renameSync(SETTINGS_TMP, SETTINGS_PATH)
  // rename is atomic on POSIX systems; on Windows it may fail if target exists
  // For Windows: use writeFileSync directly or handle EXDEV error
}

export function readSettings(): Settings | null {
  if (!existsSync(SETTINGS_PATH)) return null
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8')) as Settings
  } catch {
    return null
  }
}
```

## SQLite with better-sqlite3

For L3+ POCs and the capstone, use SQLite via `better-sqlite3`:

```typescript
import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

const DB_PATH = path.join(app.getPath('userData'), 'myapp', 'journal.db')

// Synchronous API — intentional for better-sqlite3
const db = new Database(DB_PATH)

// Setup
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    encrypted_text BLOB,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`)

// Prepared statements (use parameters to prevent SQL injection)
const insertEntry = db.prepare(
  'INSERT INTO entries (text) VALUES (?) RETURNING id, created_at'
)
const getEntries = db.prepare(
  'SELECT id, text, created_at FROM entries ORDER BY created_at DESC LIMIT ?'
)

export function appendEntry(text: string): { id: number; created_at: number } {
  return insertEntry.get(text) as { id: number; created_at: number }
}

export function listEntries(limit = 50) {
  return getEntries.all(limit)
}

// Close on quit
app.on('will-quit', () => {
  db.close()
})
```

REBUILD REQUIRED: better-sqlite3 is a native module and MUST be rebuilt for Electron's Node ABI. See `14-native-modules.md`.

## safeStorage API [S11]

### Platform Behavior

| Platform | Backend | Protection |
|----------|---------|-----------|
| macOS | macOS Keychain | Protects against other users and apps in same userspace; may block thread for user input |
| Windows | DPAPI | Protects against other users; NOT against other apps running as same user |
| Linux | kwallet / gnome-libsecret / fallback | `basic_text` backend = unencrypted; check `getSelectedStorageBackend()` |

### Usage Pattern (Async API — Recommended)

```typescript
import { safeStorage } from 'electron'

// Check availability
if (!safeStorage.isEncryptionAvailable()) {
  console.warn('[safeStorage] encryption not available — storing plaintext fallback')
  return
}

// Encrypt
const encrypted: Buffer = safeStorage.encryptString('my-secret-value')

// Decrypt
const plaintext: string = safeStorage.decryptString(encrypted)

// Async API (recommended — non-blocking, supports key rotation)
const encryptedBuf = await safeStorage.encryptStringAsync('my-secret')
const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(encryptedBuf)
if (shouldReEncrypt) {
  // Key rotated — re-encrypt and store the new buffer
  const newBuf = await safeStorage.encryptStringAsync(result)
  storeEncryptedData(newBuf)
}
```

### Storing Encrypted Data

safeStorage returns a `Buffer`. Store as binary (e.g., in SQLite BLOB column or binary file):

```typescript
// In SQLite
const insertEncrypted = db.prepare(
  'INSERT INTO entries (encrypted_text, created_at) VALUES (?, unixepoch())'
)

export async function appendEncryptedEntry(text: string): Promise<void> {
  const buf = await safeStorage.encryptStringAsync(text)
  insertEncrypted.run(buf) // Buffer stored directly as BLOB
}

export async function getDecryptedEntry(id: number): Promise<string | null> {
  const row = db.prepare('SELECT encrypted_text FROM entries WHERE id = ?').get(id)
  if (!row || !row.encrypted_text) return null
  const { result } = await safeStorage.decryptStringAsync(row.encrypted_text)
  return result
}
```

### isEncryptionAvailable() Timing

- macOS: available after `ready` event if Keychain is accessible
- Windows: available after `ready`
- Linux: available after `ready` AND secret store is running

INVARIANT: Call `isEncryptionAvailable()` AFTER `app.whenReady()`. Never before. [S11]

### Sync API Deprecation

The synchronous API (`encryptString`, `decryptString`) may be deprecated in a future Electron version. Prefer async from the start. [S11]

## Key Management

safeStorage does NOT manage key versioning itself. The OS keychain stores a derived key per app + user. If you need:

- **Key rotation**: use the async API's `shouldReEncrypt` signal
- **Backup/export**: encrypted buffers are NOT portable across machines (keychain-backed key is machine-specific on macOS)
- **Migration**: if app bundle ID changes, the keychain key changes → data becomes unreadable

CRITICAL: Encrypted data is tied to the app's bundle ID and the user's Keychain. Changing the bundle ID is a data migration event.

## When to Choose JSON vs SQLite

| Scenario | Choice |
|----------|--------|
| App settings (< 1KB, read on launch) | JSON with atomic write |
| Configuration with complex schema | JSON or SQLite |
| User data (> few KB, growing over time) | SQLite |
| Full-text search, relationships | SQLite |
| Encrypted entries | SQLite (BLOB column) + safeStorage |
| Session state (temporary) | In-memory object |
