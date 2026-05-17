/**
 * BT-L3-1: journal:append + journal:list round-trip with atomic write-rename.
 * BT-L3-2: corruption of journal.json → list returns [], file backed up,
 *          fresh empty journal created, storage:journal:corrupted log fires.
 */
import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { launchApp, waitForEvent, journalPath, type LaunchedApp } from './helpers'

let launched: LaunchedApp | null = null

test.afterEach(async () => {
  if (launched) {
    try {
      await launched.app.close()
    } catch {
      // best-effort
    }
    launched = null
  }
})

test('BT-L3-1: two journal:append calls persist, journal:list returns both in order, file is atomic JSON', async () => {
  launched = await launchApp()
  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const firstResult = await win.evaluate(async () => {
    return await (window as unknown as {
      api: { journalAppend: (v: unknown) => Promise<{ ok: true; entry: { id: string; ts: string; text: string } }> }
    }).api.journalAppend({ text: 'alpha' })
  })
  expect(firstResult.ok).toBe(true)
  expect(firstResult.entry.text).toBe('alpha')
  expect(typeof firstResult.entry.id).toBe('string')
  expect(firstResult.entry.id.length).toBeGreaterThan(0)
  expect(firstResult.entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)

  const secondResult = await win.evaluate(async () => {
    return await (window as unknown as {
      api: { journalAppend: (v: unknown) => Promise<{ ok: true; entry: { id: string; ts: string; text: string } }> }
    }).api.journalAppend({ text: 'beta' })
  })
  expect(secondResult.entry.text).toBe('beta')
  expect(secondResult.entry.id).not.toBe(firstResult.entry.id)

  const listed = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { journalList: () => Promise<readonly { id: string; ts: string; text: string }[]> }
    }).api.journalList()
  })) as readonly { id: string; ts: string; text: string }[]
  expect(listed.length).toBe(2)
  expect(listed[0].text).toBe('alpha')
  expect(listed[1].text).toBe('beta')

  // Canonical file is well-formed JSON; tmp file is gone.
  const file = journalPath(launched)
  expect(existsSync(file)).toBe(true)
  expect(existsSync(file + '.tmp')).toBe(false)
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Array<{ text: string }>
  expect(parsed.length).toBe(2)
  expect(parsed.map((p) => p.text)).toEqual(['alpha', 'beta'])
})

test('BT-L3-2: corrupted journal.json → list returns [], file is backed up, structured log fires', async () => {
  // Pre-seed the userData dir with a corrupt journal.
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const seededUserData = mkdtempSync(path.join(tmpdir(), 'l3-e2e-userdata-corrupt-'))
  mkdirSync(seededUserData, { recursive: true })
  const seededJournal = path.join(seededUserData, 'journal.json')
  writeFileSync(seededJournal, '{ this is :: not json', 'utf8')

  launched = await launchApp({ userDataDir: seededUserData })
  const { app, logFile } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const listed = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { journalList: () => Promise<readonly { id: string; ts: string; text: string }[]> }
    }).api.journalList()
  })) as readonly { id: string; ts: string; text: string }[]

  expect(listed).toEqual([])

  // Structured log entry fired with the journal path.
  const entry = await waitForEvent(logFile, 'storage:journal:corrupted')
  expect(entry.module).toBe('storage')
  const payload = entry.payload as { path?: unknown } | undefined
  expect(payload?.path).toBe(seededJournal)

  // Backup exists.
  const dirEntries = readdirSync(seededUserData)
  const backup = dirEntries.find((e) => e.startsWith('journal.json.corrupt-'))
  expect(backup, `expected journal.json.corrupt-* backup in ${seededUserData}, got ${dirEntries.join(', ')}`).toBeDefined()

  // Fresh empty journal.
  expect(JSON.parse(readFileSync(seededJournal, 'utf8'))).toEqual([])
})
