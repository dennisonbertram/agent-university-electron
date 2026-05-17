/**
 * Atomic JSON-array journal storage for L3.
 *
 * Contract (BT-L3-1, BT-L3-2, R-L3-2, R-L3-4):
 *
 *   - Append-only journal of `{ id, ts, text }` entries.
 *
 *   - `append(text)` writes the new array to `journal.json.tmp`, then
 *     `fs.rename`s it into place. On the same filesystem, rename is atomic
 *     at the kernel level, so a partial write cannot leave `journal.json`
 *     in a corrupted state.
 *
 *   - `list()` parses the file. On `JSON.parse` failure it
 *       (a) renames the corrupted file to `journal.json.corrupt-<ms-ts>`,
 *       (b) writes an empty `[]` to a fresh `journal.json`,
 *       (c) logs a structured `storage:journal:corrupted` event.
 *
 *   - In-flight writes are tracked in a `Set<Promise<void>>` so the
 *     `before-quit` flush hook (R-L3-4) can `await` them all before allowing
 *     the app to exit.
 *
 *   - Test seam: when `process.env.JOURNAL_SIMULATE_CRASH === '1'`, the
 *     writer throws after the temp file is written but before the rename
 *     completes — used by R-L3-2 to validate the recovery guarantee.
 *
 * Concurrency: appends are serialized through a single chained Promise. This
 * keeps the implementation simple and avoids the lost-update race that would
 * otherwise occur when two appends read the same baseline + each rename a
 * different new array on top. A more performant per-file lock-free design is
 * not in scope at L3.
 */
import { promises as fsp, existsSync, renameSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Logger } from './log'

export interface JournalEntry {
  readonly id: string
  readonly ts: string
  readonly text: string
}

export interface StorageOptions {
  readonly journalPath: string
  readonly logger: Logger
}

export interface JournalStorage {
  readonly journalPath: string
  append(text: string): Promise<JournalEntry>
  list(): Promise<readonly JournalEntry[]>
  inflightCount(): number
  flush(): Promise<void>
}

function isJournalEntry(value: unknown): value is JournalEntry {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.ts === 'string' &&
    typeof obj.text === 'string'
  )
}

export function createJournalStorage(opts: StorageOptions): JournalStorage {
  const { journalPath, logger } = opts
  const tmpPath = journalPath + '.tmp'

  let chain: Promise<unknown> = Promise.resolve()
  const inflight = new Set<Promise<void>>()

  /** Read + parse the journal file. Recovers from corruption synchronously. */
  async function readEntries(): Promise<JournalEntry[]> {
    let raw: string
    try {
      raw = await fsp.readFile(journalPath, 'utf8')
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return []
      throw err
    }

    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        throw new SyntaxError('journal root is not an array')
      }
      const entries: JournalEntry[] = []
      for (const item of parsed) {
        if (!isJournalEntry(item)) {
          throw new SyntaxError('journal entry has invalid shape')
        }
        entries.push(item)
      }
      return entries
    } catch (err) {
      // Corruption: rotate, log, return [].
      const stamp = Date.now()
      const backupPath = `${journalPath}.corrupt-${stamp}`
      try {
        // Sync rename to keep the post-corruption ordering deterministic
        // (the fresh empty file is created right after).
        renameSync(journalPath, backupPath)
      } catch (renameErr) {
        logger.error('storage:journal:corrupt-backup-failed', {
          path: journalPath,
          backupPath,
          message: renameErr instanceof Error ? renameErr.message : String(renameErr),
        })
      }
      try {
        await fsp.writeFile(journalPath, '[]', 'utf8')
      } catch (writeErr) {
        logger.error('storage:journal:fresh-write-failed', {
          path: journalPath,
          message: writeErr instanceof Error ? writeErr.message : String(writeErr),
        })
      }
      logger.warn('storage:journal:corrupted', {
        path: journalPath,
        backupPath,
        parseError: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }

  /** Atomically replace the journal file with the new entries array. */
  async function writeEntries(entries: readonly JournalEntry[]): Promise<void> {
    const json = JSON.stringify(entries, null, 2)
    await fsp.writeFile(tmpPath, json, 'utf8')

    // R-L3-2 test seam: simulate a crash between write and rename.
    if (process.env.JOURNAL_SIMULATE_CRASH === '1') {
      throw new Error('JOURNAL_SIMULATE_CRASH: throwing between write and rename')
    }

    await fsp.rename(tmpPath, journalPath)
  }

  /** Schedule a unit of work; the chain serializes appends. */
  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = chain.then(fn, fn)
    const tracked: Promise<void> = next.then(
      () => undefined,
      () => undefined,
    )
    inflight.add(tracked)
    tracked.finally(() => inflight.delete(tracked))
    chain = tracked
    return next
  }

  async function append(text: string): Promise<JournalEntry> {
    return enqueue(async () => {
      const existing = await readEntries()
      const entry: JournalEntry = {
        id: randomUUID(),
        ts: new Date().toISOString(),
        text,
      }
      const next = [...existing, entry]
      await writeEntries(next)
      return entry
    })
  }

  async function list(): Promise<readonly JournalEntry[]> {
    return enqueue(async () => {
      return readEntries()
    })
  }

  function inflightCount(): number {
    return inflight.size
  }

  async function flush(): Promise<void> {
    while (inflight.size > 0) {
      await Promise.allSettled(Array.from(inflight))
    }
  }

  // Touch existsSync to placate noUnusedLocals — used in tests for assertions
  // on the tmp file; we keep the import so the module documents the surface.
  void existsSync

  return { journalPath, append, list, inflightCount, flush }
}
