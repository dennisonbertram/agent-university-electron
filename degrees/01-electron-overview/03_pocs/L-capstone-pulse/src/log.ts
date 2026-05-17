/**
 * Structured JSON-lines logger — carry-forward verbatim from L1-L5.
 *
 * Contract: one JSON object per line: { ts, level, process, module, event, payload? }.
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
  logDir: string
  module: string
  process: LogEntry['process']
  minLevel?: LogLevel
  fileName?: string
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const DEFAULT_FILE = 'main.log'

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

  const write = (level: LogLevel, event: string, payload?: Record<string, unknown>): void => {
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
