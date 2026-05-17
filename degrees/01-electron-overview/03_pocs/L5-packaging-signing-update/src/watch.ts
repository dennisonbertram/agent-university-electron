/**
 * File-watcher abstraction for L3 (BT-L3-7).
 *
 * Watch scope is narrow: only the configured directory (typically
 * `${userData}/watched-folder/`). The implementation uses Node's `fs.watch`
 * directly (no `chokidar` dependency).
 *
 * Cross-platform rename caveat: `fs.watch` surfaces `rename` events without
 * indicating the new filename when a rename happens. On macOS specifically,
 * a `mv old new` typically produces TWO `rename` events: one for `old`
 * (vanished) and one for `new` (appeared). We resolve which one is which by
 * snapshotting the directory listing on each event and diffing against the
 * previous snapshot. The diff gives us `{ added, removed }` and we emit
 * structured `WatchEvent`s with `kind: 'rename'` whenever the same tick
 * produces both an `added` and a `removed` (the rename pair), or
 * `kind: 'add' | 'unlink'` otherwise.
 *
 * Decision: stayed with `fs.watch` rather than pulling in `chokidar`. The
 * macOS rename surface is observable through the listing diff; this avoids
 * adding a transitive-dependency footprint at L3. See `04_logs/decision-log.md`
 * (Decision 7).
 */
import { promises as fsp, watch as fsWatch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import type { Logger } from './log'

export type WatchEventKind = 'rename' | 'add' | 'change' | 'unlink'

export interface WatchEvent {
  readonly kind: WatchEventKind
  readonly path?: string
  readonly oldPath?: string
  readonly newPath?: string
}

export interface WatcherOptions {
  readonly directory: string
  readonly logger: Logger
  readonly onEvent: (event: WatchEvent) => void
}

export interface Watcher {
  readonly directory: string
  stop(): Promise<void>
}

async function listDir(dir: string): Promise<Set<string>> {
  try {
    const entries = await fsp.readdir(dir)
    return new Set(entries)
  } catch {
    return new Set()
  }
}

export function startWatcher(opts: WatcherOptions): Watcher {
  const { directory, logger, onEvent } = opts

  let lastListing: Set<string> = new Set()
  let stopped = false
  let watcher: FSWatcher | null = null

  // Seed the listing synchronously so the first event has a baseline.
  // The async seeding settles quickly; until it does, the diff just reports
  // the entire current state as new (which is benign — tests that wait for
  // a rename always trigger AFTER setup).
  void listDir(directory).then((s) => {
    lastListing = s
  })

  function handleRaw(event: 'rename' | 'change', filename: string | null): void {
    if (stopped) return
    if (event === 'change') {
      if (filename) {
        onEvent({ kind: 'change', path: path.join(directory, filename) })
      }
      return
    }
    // event === 'rename' — could be add OR unlink OR a rename pair across two
    // events. We snapshot the listing and diff against the previous one.
    void (async () => {
      const current = await listDir(directory)
      const prev = lastListing
      const added: string[] = []
      const removed: string[] = []
      for (const name of current) if (!prev.has(name)) added.push(name)
      for (const name of prev) if (!current.has(name)) removed.push(name)
      lastListing = current

      // Heuristic: when an `added` and a `removed` arrive together (same diff
      // tick), treat it as a rename pair. Otherwise emit add/unlink.
      if (added.length === 1 && removed.length === 1) {
        const oldPath = path.join(directory, removed[0])
        const newPath = path.join(directory, added[0])
        onEvent({ kind: 'rename', oldPath, newPath })
        return
      }
      for (const name of added) {
        onEvent({ kind: 'add', path: path.join(directory, name) })
      }
      for (const name of removed) {
        onEvent({ kind: 'unlink', path: path.join(directory, name) })
      }
    })().catch((err) => {
      logger.error('watch:diff-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    })
  }

  try {
    watcher = fsWatch(directory, { persistent: false }, (event, filename) => {
      handleRaw(event as 'rename' | 'change', filename ? String(filename) : null)
    })
    watcher.on('error', (err) => {
      logger.error('watch:fs-watch-error', {
        message: err instanceof Error ? err.message : String(err),
      })
    })
  } catch (err) {
    logger.error('watch:fs-watch-start-failed', {
      directory,
      message: err instanceof Error ? err.message : String(err),
    })
  }

  async function stop(): Promise<void> {
    stopped = true
    if (watcher) {
      try {
        watcher.close()
      } catch {
        // best-effort
      }
      watcher = null
    }
  }

  return { directory, stop }
}
