/**
 * File-watcher abstraction for L3 (BT-L3-7).
 *
 * Watch scope is narrow: only `${userData}/watched-folder/`. The implementation
 * uses Node's `fs.watch` directly (no chokidar dependency). On macOS, rename
 * surfaces as a `rename` event from `fs.watch`; we resolve the new path by
 * scanning the directory immediately after the event fires and pairing the
 * vanished filename with the new one.
 *
 * If `fs.watch` proves flaky for rename detection, the GREEN commit will switch
 * to chokidar — that decision is logged in `04_logs/decision-log.md`.
 *
 * NOTE — RED commit: stub only; throws on `start`.
 */
import type { Logger } from './log'

export type WatchEventKind = 'rename' | 'add' | 'change' | 'unlink'

export interface WatchEvent {
  readonly kind: WatchEventKind
  readonly path?: string
  readonly oldPath?: string
  readonly newPath?: string
}

export interface WatcherOptions {
  /** Absolute directory path to watch. Created if it does not exist. */
  readonly directory: string
  readonly logger: Logger
  /** Callback fired on every observed event. */
  readonly onEvent: (event: WatchEvent) => void
}

export interface Watcher {
  readonly directory: string
  /** Stop watching and release resources. */
  stop(): Promise<void>
}

export function startWatcher(_opts: WatcherOptions): Watcher {
  throw new Error('watch.startWatcher: not implemented (RED commit stub)')
}
