/**
 * Hand-rolled structured JSON-lines logger for POC L1.
 *
 * Contract (see 02_planning/observability-strategy.md §2):
 *   Every log entry is ONE JSON object on ONE line containing:
 *     { ts, level, process, module, event, payload? }
 *   ts is ISO-8601 UTC with millisecond precision.
 *
 * Writes append-only to {logDir}/{fileName} (default fileName = 'main.log').
 * Directory is created on first write if missing.
 *
 * NOTE: This is intentionally not electron-log. L4 will migrate to electron-log
 * per observability-strategy.md (logging library decision). For L1 we want a
 * dependency-free, fully synchronous logger that tests can read deterministically.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: string
  level: LogLevel
  process: 'main' | 'renderer' | 'preload' | 'utility'
  module: string
  event: string
  payload?: Record<string, unknown>
}

export interface Logger {
  debug(event: string, payload?: Record<string, unknown>): void
  info(event: string, payload?: Record<string, unknown>): void
  warn(event: string, payload?: Record<string, unknown>): void
  error(event: string, payload?: Record<string, unknown>): void
}

export interface CreateLoggerOptions {
  /** Absolute path to a directory. Created on first write if missing. */
  logDir: string
  /** Module name, e.g. 'app', 'window', 'ipc'. Stamped on every entry. */
  module: string
  /** Which Electron process is producing the log. */
  process: LogEntry['process']
  /** Minimum severity to write. Default 'debug'. */
  minLevel?: LogLevel
  /** File name inside logDir. Default 'main.log'. */
  fileName?: string
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const DEFAULT_FILE = 'main.log'

/** Returns the absolute path the logger will write to for the given options. */
export function logFilePath(logDir: string, fileName: string = DEFAULT_FILE): string {
  return path.join(logDir, fileName)
}

export function createLogger(opts: CreateLoggerOptions): Logger {
  const file = logFilePath(opts.logDir, opts.fileName ?? DEFAULT_FILE)
  const minRank = LEVEL_RANK[opts.minLevel ?? 'debug']
  let dirEnsured = false

  const ensureDir = (): void => {
    if (dirEnsured) return
    mkdirSync(path.dirname(file), { recursive: true })
    dirEnsured = true
  }

  const write = (
    level: LogLevel,
    event: string,
    payload?: Record<string, unknown>,
  ): void => {
    if (LEVEL_RANK[level] < minRank) return
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      process: opts.process,
      module: opts.module,
      event,
    }
    if (payload !== undefined) entry.payload = payload
    ensureDir()
    appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')
  }

  return {
    debug: (event, payload) => write('debug', event, payload),
    info: (event, payload) => write('info', event, payload),
    warn: (event, payload) => write('warn', event, payload),
    error: (event, payload) => write('error', event, payload),
  }
}
