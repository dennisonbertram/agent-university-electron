/**
 * R-L5-1 / R-C-5 (static-source) — crashReporter.start() runs BEFORE
 * app.whenReady() in main.ts.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const POC_ROOT = path.resolve(__dirname, '..', '..')
const MAIN_PATH = path.join(POC_ROOT, 'src', 'main.ts')
const CRASH_PATH = path.join(POC_ROOT, 'src', 'crash.ts')

describe('crashReporter pre-ready ordering (R-C-5)', () => {
  it('src/crash.ts exists and exports startCrashReporter', () => {
    expect(existsSync(CRASH_PATH)).toBe(true)
    expect(readFileSync(CRASH_PATH, 'utf8')).toMatch(/export\s+function\s+startCrashReporter/)
  })

  it('startCrashReporter is invoked at module-load time in main.ts', () => {
    const src = readFileSync(MAIN_PATH, 'utf8')
    expect(src).toMatch(/startCrashReporter\s*\(/)
  })

  it('startCrashReporter call appears BEFORE the first .whenReady() call', () => {
    const src = readFileSync(MAIN_PATH, 'utf8')
    const crashIdx = src.search(/startCrashReporter\s*\(/)
    const readyIdx = src.search(/\.whenReady\s*\(/)
    expect(crashIdx).toBeGreaterThan(-1)
    expect(readyIdx).toBeGreaterThan(-1)
    expect(crashIdx).toBeLessThan(readyIdx)
  })

  it('does NOT call crashReporter.start() inside the whenReady callback', () => {
    const src = readFileSync(MAIN_PATH, 'utf8')
    const readyIdx = src.search(/\.whenReady\s*\(/)
    expect(readyIdx).toBeGreaterThan(-1)
    const after = src.slice(readyIdx)
    expect(after).not.toMatch(/crashReporter\.start\s*\(/)
  })
})
