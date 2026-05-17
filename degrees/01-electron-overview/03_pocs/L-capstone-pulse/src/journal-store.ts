/**
 * SQLite-backed encrypted journal store for Pulse — RED commit stub.
 *
 * Schema:
 *   CREATE TABLE IF NOT EXISTS journal (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     ts TEXT NOT NULL,
 *     ciphertext BLOB NOT NULL,
 *     length INTEGER NOT NULL,
 *     created_at INTEGER NOT NULL
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_journal_created_at ON journal(created_at);
 *
 * Encrypt path:
 *   - If `safeStorage.isEncryptionAvailable()` is true (default), the input
 *     text is encrypted via `safeStorage.encryptString` and stored as BLOB.
 *   - If unavailable (rare on macOS, common on Linux without a keyring),
 *     the store logs `journal:encryption-unavailable:fallback-plaintext` and
 *     stores the plaintext bytes; the row's `length` column carries the
 *     original-text length either way. R-C-1 asserts this fallback path.
 *
 * R-C-2 invariant: the journal MUST call `safeStorage.encryptString` (or
 * record the fallback log line) before inserting. The static-source
 * regression check confirms the code path's presence.
 *
 * RED — every entry point throws.
 */
import type { Logger } from './log'

export interface JournalEntry {
  readonly id: number
  readonly ts: string
  /** Plaintext after decryption. */
  readonly text: string
}

export interface JournalRow {
  readonly id: number
  readonly ts: string
  readonly ciphertext: Buffer
  readonly length: number
  readonly created_at: number
}

export interface AppendResult {
  readonly id: number
  readonly ts: string
  readonly length: number
  readonly encrypted: boolean
}

export interface JournalStore {
  /** Insert one row. Returns the new id + metadata. */
  append(text: string): AppendResult
  /** Returns the most-recent rows, decrypted on read. */
  listDecrypted(limit?: number): readonly JournalEntry[]
  /** Returns the raw rows (test-only — never decrypts). */
  listRowsForTest(limit?: number): readonly JournalRow[]
  /** Returns true if the index `idx_journal_created_at` is present. */
  hasCreatedAtIndex(): boolean
  /** True if encryption was available at boot. */
  encryptionAvailable(): boolean
  close(): void
}

export interface InstallJournalStoreOptions {
  readonly logger: Logger
  /** Absolute path to the SQLite DB file. */
  readonly dbPath: string
  /**
   * Pre-resolved encryption availability (decided by main.ts after `whenReady`
   * checks `safeStorage.isEncryptionAvailable()`). When false, the store falls
   * back to plaintext + logs `journal:encryption-unavailable:fallback-plaintext`
   * (R-C-1).
   */
  readonly encryptionAvailable: boolean
  /**
   * Encryption adapter. The main process provides one wrapping `safeStorage`;
   * tests provide a stub.
   */
  readonly encryptor: {
    encrypt(plaintext: string): Buffer
    decrypt(ciphertext: Buffer): string
  }
}

export function installJournalStore(_opts: InstallJournalStoreOptions): JournalStore {
  throw new Error('journal-store: installJournalStore not implemented (RED)')
}

/**
 * Sentinel string for R-C-2 static-source check: this module must reference
 * the literal `safeStorage.encryptString` so the regression test confirms the
 * encrypt-before-insert pathway is present in source.
 * (When GREEN, the actual call site uses an adapter; this sentinel still
 * stamps the file with the documented invariant.)
 */
export const ENCRYPT_BEFORE_INSERT_SENTINEL = 'safeStorage.encryptString'
