/**
 * Passphrase storage + verification for the journal fallback path — RED stub.
 *
 * Algorithm (per prompt):
 *   - PBKDF2-SHA-256 with a per-install salt.
 *   - Salt stored at `${userData}/passphrase.salt` (16 random bytes).
 *   - Hash stored at `${userData}/passphrase.bin` (32 bytes after PBKDF2).
 *   - Verify via `crypto.timingSafeEqual` (R-C-7's "constant-time compare"
 *     thematic equivalent for the journal fallback path).
 *
 * If safeStorage is available, we additionally wrap the hash via
 * `safeStorage.encryptString` before persisting — so even root-on-disk access
 * doesn't yield the raw hash. The fallback path stores plaintext bytes with
 * a `journal:passphrase:plaintext-fallback` log warning.
 *
 * RED — every entry point throws.
 */

export interface PassphraseStore {
  /** True if a passphrase has been set (the salt + hash files exist). */
  isSet(): boolean
  /** Sets / replaces the passphrase. Idempotent. */
  setPassphrase(passphrase: string): { ok: true }
  /** Constant-time verify. */
  verify(passphrase: string): boolean
}

export interface InstallPassphraseStoreOptions {
  readonly userDataDir: string
  /**
   * If true, the on-disk salt + hash are NOT wrapped by safeStorage even when
   * safeStorage is available. Used by tests to keep fixture files portable.
   */
  readonly disableSafeStorageWrap?: boolean
  /**
   * Encryption adapter (same shape as journal-store). Optional.
   */
  readonly encryptor?: {
    encrypt(plaintext: string): Buffer
    decrypt(ciphertext: Buffer): string
  }
}

export function installPassphraseStore(_opts: InstallPassphraseStoreOptions): PassphraseStore {
  throw new Error('passphrase: installPassphraseStore not implemented (RED)')
}

/**
 * Pure helper used by the unit tests. RED stub.
 */
export function hashPassphrase(_passphrase: string, _salt: Buffer): Buffer {
  throw new Error('passphrase: hashPassphrase not implemented (RED)')
}
