/**
 * Unit tests for `src/storage.ts` — atomic JSON-array journal.
 *
 * Covers:
 *   - append + list round-trip (BT-L3-1 unit-level)
 *   - corruption recovery: malformed JSON → list returns [], file backed up,
 *     storage:journal:corrupted log fires (BT-L3-2 unit-level)
 *   - atomic write: under `JOURNAL_SIMULATE_CRASH=1` the temp file may be
 *     present but the canonical file remains unchanged (R-L3-2 unit-level)
 *   - flush() awaits in-flight writes (R-L3-4 unit-level)
 *
 * Storage runs against a freshly-`mkdtemp`'d directory per test so writes
 * don't leak.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createJournalStorage } from '../../src/storage'

interface LogCall {
  level: 'debug' | 'info' | 'warn' | 'error'
  event: string
  payload?: Record<string, unknown>
}

function makeFakeLogger(): { calls: LogCall[]; logger: Parameters<typeof createJournalStorage>[0]['logger'] } {
  const calls: LogCall[] = []
  const record = (level: LogCall['level']) =>
    (event: string, payload?: Record<string, unknown>): void => {
      calls.push({ level, event, payload })
    }
  return {
    calls,
    logger: {
      debug: record('debug'),
      info: record('info'),
      warn: record('warn'),
      error: record('error'),
    },
  }
}

let tempDir = ''
let journalPath = ''

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'l3-storage-'))
  journalPath = path.join(tempDir, 'journal.json')
  delete process.env.JOURNAL_SIMULATE_CRASH
})

afterEach(() => {
  delete process.env.JOURNAL_SIMULATE_CRASH
  try {
    rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // best-effort
  }
})

describe('createJournalStorage — happy path', () => {
  it('Given a fresh storage, when listed, then returns []', async () => {
    const { logger } = makeFakeLogger()
    const s = createJournalStorage({ journalPath, logger })
    const entries = await s.list()
    expect(entries).toEqual([])
  })

  it('Given two appended entries, when listed, then both are returned in order', async () => {
    const { logger } = makeFakeLogger()
    const s = createJournalStorage({ journalPath, logger })
    const a = await s.append('first')
    const b = await s.append('second')
    expect(a.text).toBe('first')
    expect(b.text).toBe('second')
    expect(typeof a.id).toBe('string')
    expect(a.id.length).toBeGreaterThan(0)
    expect(typeof a.ts).toBe('string')
    // ISO-8601: YYYY-MM-DDTHH:MM:SS.sssZ — at minimum 20 chars.
    expect(a.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(a.id).not.toBe(b.id)

    const listed = await s.list()
    expect(listed.length).toBe(2)
    expect(listed[0].text).toBe('first')
    expect(listed[1].text).toBe('second')
  })

  it('Given append, when complete, then the canonical file exists and tmp file is gone', async () => {
    const { logger } = makeFakeLogger()
    const s = createJournalStorage({ journalPath, logger })
    await s.append('hello')
    expect(existsSync(journalPath)).toBe(true)
    expect(existsSync(journalPath + '.tmp')).toBe(false)
    const raw = readFileSync(journalPath, 'utf8')
    const parsed = JSON.parse(raw)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(1)
    expect(parsed[0].text).toBe('hello')
  })
})

describe('createJournalStorage — corruption recovery (BT-L3-2)', () => {
  it('Given malformed JSON in journal.json, when list is called, then returns [] and rotates the corrupt file', async () => {
    writeFileSync(journalPath, '{not-json', 'utf8')

    const { calls, logger } = makeFakeLogger()
    const s = createJournalStorage({ journalPath, logger })
    const entries = await s.list()

    expect(entries).toEqual([])

    // A backup with the journal.json.corrupt-<ts> prefix exists in the same dir.
    const dirEntries = readdirSync(tempDir)
    const backup = dirEntries.find((e) => e.startsWith('journal.json.corrupt-'))
    expect(backup, `expected a journal.json.corrupt-* backup in ${tempDir}, found: ${dirEntries.join(', ')}`).toBeDefined()

    // Fresh empty journal exists.
    expect(existsSync(journalPath)).toBe(true)
    expect(JSON.parse(readFileSync(journalPath, 'utf8'))).toEqual([])

    // Structured log fired.
    const corruptionEvent = calls.find((c) => c.event === 'storage:journal:corrupted')
    expect(corruptionEvent, `expected storage:journal:corrupted log; saw events: ${calls.map((c) => c.event).join(', ')}`).toBeDefined()
    expect(corruptionEvent?.payload?.path).toBe(journalPath)
  })

  it('Given corruption, when append is called after recovery, then the append succeeds', async () => {
    writeFileSync(journalPath, '{not-json', 'utf8')
    const { logger } = makeFakeLogger()
    const s = createJournalStorage({ journalPath, logger })
    await s.list() // triggers recovery
    const entry = await s.append('after-recovery')
    expect(entry.text).toBe('after-recovery')
    const listed = await s.list()
    expect(listed.map((e) => e.text)).toEqual(['after-recovery'])
  })
})

describe('createJournalStorage — atomic crash recovery (R-L3-2)', () => {
  it('Given JOURNAL_SIMULATE_CRASH=1, when append throws between write and rename, then the canonical file is unaffected', async () => {
    const { logger } = makeFakeLogger()
    const s = createJournalStorage({ journalPath, logger })
    // Land a valid entry first.
    await s.append('A')
    const beforeCrash = readFileSync(journalPath, 'utf8')

    process.env.JOURNAL_SIMULATE_CRASH = '1'
    let threw = false
    try {
      await s.append('B')
    } catch {
      threw = true
    }
    expect(threw, 'append must throw under JOURNAL_SIMULATE_CRASH').toBe(true)

    // The canonical file remains unchanged — entry A is still readable.
    const afterCrash = readFileSync(journalPath, 'utf8')
    expect(afterCrash).toBe(beforeCrash)

    delete process.env.JOURNAL_SIMULATE_CRASH
    // A subsequent list does not see entry B.
    const listed = await s.list()
    expect(listed.map((e) => e.text)).toEqual(['A'])
  })
})

describe('createJournalStorage — flush (R-L3-4)', () => {
  it('Given append in-flight, when flush is called, then it awaits the pending write', async () => {
    const { logger } = makeFakeLogger()
    const s = createJournalStorage({ journalPath, logger })
    const p1 = s.append('one')
    const p2 = s.append('two')
    // We don't await yet; immediately call flush.
    await s.flush()
    // After flush, both writes should have settled.
    await Promise.all([p1, p2])
    expect(s.inflightCount()).toBe(0)
    const listed = await s.list()
    expect(listed.length).toBe(2)
  })
})
