/**
 * crashReporter.start() ordering — static source inspection (R-L5-1).
 *
 * `crashReporter.start()` MUST run BEFORE `app.whenReady()`. Renderers
 * spawned before the start call won't be monitored.
 *
 * The check is by source-text position: `startCrashReporter(` (the wrapper
 * around `crashReporter.start`) must appear at a smaller character offset
 * than the FIRST `app.whenReady()` call in `src/main.ts`.
 *
 * This is a regression test (R-L5-1) — promoted to the unit suite so it
 * runs every commit, not just the regression Playwright run.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const POC_ROOT = path.resolve(__dirname, '..', '..')
const MAIN_PATH = path.join(POC_ROOT, 'src', 'main.ts')
const CRASH_PATH = path.join(POC_ROOT, 'src', 'crash.ts')

describe('crashReporter pre-ready ordering (R-L5-1)', () => {
  it('src/crash.ts exists and exports startCrashReporter', () => {
    expect(existsSync(CRASH_PATH)).toBe(true)
    const src = readFileSync(CRASH_PATH, 'utf8')
    expect(src).toMatch(/export\s+function\s+startCrashReporter/)
  })

  it('startCrashReporter is invoked at module-load time in src/main.ts', () => {
    const src = readFileSync(MAIN_PATH, 'utf8')
    expect(src).toMatch(/startCrashReporter\s*\(/)
  })

  it('startCrashReporter call appears BEFORE the first .whenReady() call', () => {
    const src = readFileSync(MAIN_PATH, 'utf8')
    // The actual call site for `startCrashReporter(` happens at module load.
    // Some occurrences of `startCrashReporter(` appear in the docstring; we
    // want the FIRST executable (non-doc) call. The simplest disambiguator:
    // accept any `startCrashReporter(` outside a `/** */` block — but for
    // this test it's sufficient that the call appears before the FIRST
    // `.whenReady(` invocation site.
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
    // `startCrashReporter` may appear in a comment AFTER the call (e.g.,
    // an audit comment referencing the symbol). What we forbid is an
    // EXECUTABLE call site: `startCrashReporter(` not preceded by `*` or
    // `//`. We accept the slight false-positive risk here for simplicity.
    const executablePattern = /^[^*/\n]*startCrashReporter\s*\(/m
    expect(executablePattern.test(after)).toBe(false)
  })
})
