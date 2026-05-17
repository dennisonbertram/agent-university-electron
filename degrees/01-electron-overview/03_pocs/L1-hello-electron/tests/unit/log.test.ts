/**
 * Unit tests for the hand-rolled JSON-lines logger (src/log.ts).
 *
 * These exercise the contract documented in 02_planning/observability-strategy.md §2
 * — every log entry is one JSON line containing { ts, level, process, module, event }
 * — file path is { logDir }/{ fileName } (default fileName = 'main.log')
 * — minLevel filters lower-severity entries before they reach the file
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createLogger, logFilePath, type LogEntry } from '../../src/log'

let logDir: string

beforeEach(() => {
  logDir = mkdtempSync(path.join(tmpdir(), 'l1-log-'))
})

function readLines(file: string): LogEntry[] {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((s) => s.length > 0)
    .map((line) => JSON.parse(line) as LogEntry)
}

describe('logFilePath', () => {
  it('Given a logDir, when called with default fileName, then returns logDir/main.log', () => {
    expect(logFilePath(logDir)).toBe(path.join(logDir, 'main.log'))
  })

  it('Given a logDir and explicit fileName, when called, then returns logDir/fileName', () => {
    expect(logFilePath(logDir, 'custom.log')).toBe(path.join(logDir, 'custom.log'))
  })
})

describe('createLogger — file output', () => {
  it('Given a logger, when info() is called, then the log file contains exactly one JSON line with the contract fields', () => {
    const logger = createLogger({ logDir, module: 'unit', process: 'main' })
    logger.info('something:happened', { count: 3 })

    const file = path.join(logDir, 'main.log')
    const lines = readLines(file)
    expect(lines).toHaveLength(1)
    const entry = lines[0]
    expect(entry.level).toBe('info')
    expect(entry.process).toBe('main')
    expect(entry.module).toBe('unit')
    expect(entry.event).toBe('something:happened')
    expect(entry.payload).toEqual({ count: 3 })
    expect(typeof entry.ts).toBe('string')
    // ISO-8601 with 'T' and 'Z' (UTC) per observability-strategy.md §2.
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('Given multiple writes, when read back, then one JSON object per line preserving order', () => {
    const logger = createLogger({ logDir, module: 'unit', process: 'main' })
    logger.debug('a')
    logger.info('b')
    logger.warn('c')
    logger.error('d')

    const lines = readLines(path.join(logDir, 'main.log'))
    expect(lines.map((l) => l.event)).toEqual(['a', 'b', 'c', 'd'])
    expect(lines.map((l) => l.level)).toEqual(['debug', 'info', 'warn', 'error'])
  })

  it('Given minLevel=info, when debug() is called, then nothing is written', () => {
    const logger = createLogger({ logDir, module: 'unit', process: 'main', minLevel: 'info' })
    logger.debug('skipped')
    logger.info('kept')

    const lines = readLines(path.join(logDir, 'main.log'))
    expect(lines).toHaveLength(1)
    expect(lines[0].event).toBe('kept')
  })

  it('Given minLevel=warn, when info() is called, then nothing is written', () => {
    const logger = createLogger({ logDir, module: 'unit', process: 'main', minLevel: 'warn' })
    logger.info('skipped')
    logger.warn('kept')

    const lines = readLines(path.join(logDir, 'main.log'))
    expect(lines).toHaveLength(1)
    expect(lines[0].event).toBe('kept')
  })

  it('Given a custom fileName, when info() is called, then that file is written (not main.log)', () => {
    const logger = createLogger({
      logDir,
      module: 'unit',
      process: 'main',
      fileName: 'custom.log',
    })
    logger.info('hi')

    expect(existsSync(path.join(logDir, 'main.log'))).toBe(false)
    expect(readLines(path.join(logDir, 'custom.log'))).toHaveLength(1)
  })

  it('Given the logDir does not exist, when info() is called, then the directory is created', () => {
    const nested = path.join(logDir, 'nested', 'deep')
    rmSync(logDir, { recursive: true, force: true })
    const logger = createLogger({ logDir: nested, module: 'unit', process: 'main' })
    logger.info('hi')
    expect(existsSync(path.join(nested, 'main.log'))).toBe(true)
  })

  it('Given a payload, when info() is called, then the payload survives JSON round-trip unchanged', () => {
    const logger = createLogger({ logDir, module: 'unit', process: 'main' })
    const payload = { nested: { value: 42 }, arr: [1, 2, 3], flag: true }
    logger.info('event', payload)
    const [entry] = readLines(path.join(logDir, 'main.log'))
    expect(entry.payload).toEqual(payload)
  })

  it('Given the process field is "renderer", when info() is called, then the entry reflects that', () => {
    const logger = createLogger({ logDir, module: 'ui', process: 'renderer' })
    logger.info('ready')
    const [entry] = readLines(path.join(logDir, 'main.log'))
    expect(entry.process).toBe('renderer')
    expect(entry.module).toBe('ui')
  })
})
