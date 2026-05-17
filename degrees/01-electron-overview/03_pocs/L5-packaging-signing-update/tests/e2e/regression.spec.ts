/**
 * Regression suite — R-L5-1 through R-L5-5.
 *
 * R-L5-1: crashReporter.start() MUST be called BEFORE app.whenReady() in
 *         src/main.ts. (Also covered statically in unit
 *         `crash-start-ordering.test.ts` — duplicated here so a single
 *         `npx playwright test` produces the full L5 regression view.)
 * R-L5-2: forge.config.ts MUST register FusesPlugin with at minimum
 *         RunAsNode=false and EnableNodeOptionsEnvironmentVariable=false.
 * R-L5-3: src/updater.ts MUST use provider:'generic' (NEVER 'github'/'s3'/
 *         any auth-requiring provider in this POC).
 * R-L5-4: forge.config.ts MUST gate osxSign + osxNotarize on
 *         process.env.APPLE_ID. (If the gate disappears, the skip path is
 *         broken and a CI run without creds would error rather than skip.)
 * R-L5-5: Info.plist.template AND the packaged Info.plist MUST declare
 *         CFBundleURLTypes containing the electron-l5 scheme.
 */
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import plist from 'plist'
import { POC_ROOT, runPackage } from './helpers'

const FORGE_CONFIG_PATH = path.join(POC_ROOT, 'forge.config.ts')
const MAIN_TS_PATH = path.join(POC_ROOT, 'src', 'main.ts')
const UPDATER_TS_PATH = path.join(POC_ROOT, 'src', 'updater.ts')
const INFO_TEMPLATE_PATH = path.join(POC_ROOT, 'Info.plist.template')

test.describe('L5 regression suite (R-L5-1..R-L5-5)', () => {
  test('R-L5-1: crashReporter.start() is called BEFORE app.whenReady() in src/main.ts', () => {
    const src = readFileSync(MAIN_TS_PATH, 'utf8')
    const crashIdx = src.search(/startCrashReporter\s*\(/)
    const readyIdx = src.search(/\.whenReady\s*\(/)
    expect(crashIdx, 'startCrashReporter call must exist in main.ts').toBeGreaterThan(-1)
    expect(readyIdx, '.whenReady() call must exist in main.ts').toBeGreaterThan(-1)
    expect(crashIdx, 'crash start must precede whenReady').toBeLessThan(readyIdx)
  })

  test('R-L5-2: forge.config.ts registers FusesPlugin with RunAsNode:false + EnableNodeOptionsEnvironmentVariable:false', () => {
    const src = readFileSync(FORGE_CONFIG_PATH, 'utf8')
    expect(src).toMatch(/FusesPlugin/)
    expect(src).toMatch(/RunAsNode\]\s*:\s*false/)
    expect(src).toMatch(/EnableNodeOptionsEnvironmentVariable\]\s*:\s*false/)
  })

  test("R-L5-3: src/updater.ts uses provider:'generic' (never 'github')", () => {
    const src = readFileSync(UPDATER_TS_PATH, 'utf8')
    expect(src).toMatch(/provider\s*:\s*['"]generic['"]/)
    expect(src).not.toMatch(/provider\s*:\s*['"]github['"]/)
    expect(src).not.toMatch(/provider\s*:\s*['"]s3['"]/)
  })

  test('R-L5-4: forge.config.ts gates osxSign + osxNotarize on process.env.APPLE_ID', () => {
    const src = readFileSync(FORGE_CONFIG_PATH, 'utf8')
    expect(src).toMatch(/process\.env\.APPLE_ID/)
    expect(src).toMatch(/osxSign/)
    expect(src).toMatch(/osxNotarize/)
    // The load-bearing assertion: there must be a `HAS_APPLE_CREDS` or
    // `process.env.APPLE_ID` (or similar) ternary/spread above the
    // `osxSign:` config field. We accept either pattern.
    //
    // Strip block comments first so docstring mentions don't confuse the
    // position math.
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(stripped).toMatch(/process\.env\.APPLE_ID/)
    expect(stripped).toMatch(/osxSign/)
    const appleIdIdx = stripped.search(/process\.env\.APPLE_ID/)
    const osxSignIdx = stripped.search(/osxSign\s*:/)
    expect(appleIdIdx).toBeGreaterThan(-1)
    expect(osxSignIdx).toBeGreaterThan(-1)
    // The conditional-spread (`...(HAS_APPLE_CREDS ? { osxSign: ... } : {})`)
    // puts the APPLE_ID check BEFORE the osxSign field. Either pattern
    // suffices.
    expect(appleIdIdx).toBeLessThan(osxSignIdx)
  })

  test('R-L5-5: Info.plist.template AND packaged Info.plist declare CFBundleURLTypes (electron-l5)', async () => {
    test.setTimeout(300_000)
    // Template check (static).
    expect(existsSync(INFO_TEMPLATE_PATH)).toBe(true)
    const templateObj = plist.parse(readFileSync(INFO_TEMPLATE_PATH, 'utf8')) as Record<string, unknown>
    expect(Array.isArray(templateObj.CFBundleURLTypes)).toBe(true)
    const templateSchemes = (templateObj.CFBundleURLTypes as Array<Record<string, unknown>>).flatMap(
      (e) => (Array.isArray(e.CFBundleURLSchemes) ? (e.CFBundleURLSchemes as string[]) : []),
    )
    expect(templateSchemes).toContain('electron-l5')

    // Packaged check (dynamic; uses memoized runPackage()).
    const bundle = await runPackage()
    const packagedObj = plist.parse(readFileSync(bundle.infoPlistPath, 'utf8')) as Record<string, unknown>
    expect(Array.isArray(packagedObj.CFBundleURLTypes)).toBe(true)
    const packagedSchemes = (packagedObj.CFBundleURLTypes as Array<Record<string, unknown>>).flatMap(
      (e) => (Array.isArray(e.CFBundleURLSchemes) ? (e.CFBundleURLSchemes as string[]) : []),
    )
    expect(packagedSchemes).toContain('electron-l5')
  })
})
