/**
 * STUB — implemented in GREEN commit.
 * Tests for the logger are expected to FAIL on this stub.
 */

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

// Intentional stub. Throws to make red-commit failures unambiguous.
export function createLogger(_opts: CreateLoggerOptions): Logger {
  throw new Error('createLogger: not implemented (stub for RED commit)')
}

// Intentional stub.
export function logFilePath(_logDir: string, _fileName?: string): string {
  throw new Error('logFilePath: not implemented (stub for RED commit)')
}
