/**
 * Atomic JSON-array journal storage for L3.
 *
 * Contract (BT-L3-1, BT-L3-2, R-L3-2):
 *   - Append-only journal of `{ id, ts, text }` entries.
 *   - `appendEntry` writes the new array to `journal.json.tmp`, then `fs.rename`s
 *     it into place. On the same filesystem, rename is atomic at the kernel
 *     level, so a partial write cannot leave `journal.json` in a corrupted state.
 *   - `listEntries` parses the file; on JSON.parse failure it (a) renames the
 *     corrupted file to `journal.json.corrupt-<ms-ts>`, (b) writes an empty
 *     `[]` to a fresh `journal.json`, (c) logs `storage:journal:corrupted`.
 *
 * Test seam: when `process.env.JOURNAL_SIMULATE_CRASH === '1'`, the writer
 * throws after the temp file is written but before the rename — used by R-L3-2
 * to validate the recovery guarantee.
 *
 * NOTE — RED commit: this file currently exports the API surface so imports
 * resolve, but the implementation throws `not implemented`. The GREEN commit
 * fills in the real atomic write + recovery logic.
 */
import type { Logger } from './log'

export interface JournalEntry {
  readonly id: string
  readonly ts: string
  readonly text: string
}

export interface StorageOptions {
  /** Absolute path to the journal file (e.g. `${userData}/journal.json`). */
  readonly journalPath: string
  /** Logger scoped to `module: 'storage'`. */
  readonly logger: Logger
}

export interface JournalStorage {
  readonly journalPath: string
  /** Append a new entry; resolves once the rename has completed. */
  append(text: string): Promise<JournalEntry>
  /** List entries; returns `[]` on corruption and triggers recovery. */
  list(): Promise<readonly JournalEntry[]>
  /** Number of currently in-flight writes (used by before-quit flush). */
  inflightCount(): number
  /** Promise that resolves when all in-flight writes have settled. */
  flush(): Promise<void>
}

export function createJournalStorage(_opts: StorageOptions): JournalStorage {
  throw new Error('storage.createJournalStorage: not implemented (RED commit stub)')
}
