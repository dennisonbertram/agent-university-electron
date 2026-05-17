/**
 * Packaging behavioral tests for Pulse.
 *
 *   BT-C-11: packaged Info.plist registers `pulse://` (NOT electron-l5).
 *   + an LSUIElement=true sanity check.
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import plist from 'plist'
import path from 'node:path'
import { POC_ROOT, runPackage } from './helpers'

test.describe.serial('Pulse — packaging artifacts', () => {
  test('BT-C-11: packaged Info.plist registers pulse:// + LSUIElement=true', async () => {
    test.setTimeout(360_000)
    const bundle = await runPackage()
    expect(existsSync(bundle.appDir), `expected .app at ${bundle.appDir}`).toBe(true)
    expect(existsSync(bundle.infoPlistPath)).toBe(true)
    const xml = readFileSync(bundle.infoPlistPath, 'utf8')
    const obj = plist.parse(xml) as Record<string, unknown>

    // CFBundleURLTypes must contain pulse, NOT electron-l5.
    expect(Array.isArray(obj.CFBundleURLTypes)).toBe(true)
    const urlTypes = obj.CFBundleURLTypes as Array<Record<string, unknown>>
    const schemes = urlTypes.flatMap((entry) =>
      Array.isArray(entry.CFBundleURLSchemes) ? (entry.CFBundleURLSchemes as string[]) : [],
    )
    expect(schemes).toContain('pulse')
    expect(schemes).not.toContain('electron-l5')

    // Version + copyright present.
    expect(typeof obj.CFBundleShortVersionString).toBe('string')
    expect((obj.CFBundleShortVersionString as string).length).toBeGreaterThan(0)
    expect(typeof obj.NSHumanReadableCopyright).toBe('string')

    // LSUIElement should be true (menu-bar-only). If a future build omits it,
    // poc-report.md MUST document the deviation. (Entry 8 in the
    // expectation-gap-ledger noted that protocols overrides
    // extendInfo.CFBundleURLTypes; LSUIElement passes through extendInfo
    // unimpeded.)
    expect(obj.LSUIElement).toBe(true)
  })

  test('BT-C-11b: better-sqlite3 native module is unpacked outside the asar', async () => {
    test.setTimeout(360_000)
    const bundle = await runPackage()
    // After running with `auto-unpack-natives`, Forge produces
    // `Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/...`
    const unpackedDir = path.join(bundle.resourcesDir, 'app.asar.unpacked')
    expect(existsSync(unpackedDir), `expected app.asar.unpacked under ${bundle.resourcesDir}`).toBe(true)
    const recursed = walk(unpackedDir)
    const hasBetterSqlite3Native = recursed.some((p) =>
      p.includes('better-sqlite3') && (p.endsWith('.node') || p.endsWith('better_sqlite3.node')),
    )
    expect(
      hasBetterSqlite3Native,
      `expected an unpacked better_sqlite3.node under ${unpackedDir}; saw ${recursed.slice(0, 30).join('\n')}`,
    ).toBe(true)
  })

  test('BT-C-11c: entitlements.mac.plist declares hardened-runtime keys', () => {
    const entitlementsPath = path.join(POC_ROOT, 'entitlements.mac.plist')
    expect(existsSync(entitlementsPath)).toBe(true)
    const obj = plist.parse(readFileSync(entitlementsPath, 'utf8')) as Record<string, unknown>
    expect(obj['com.apple.security.cs.allow-jit']).toBe(true)
    expect(obj['com.apple.security.cs.disable-library-validation']).toBe(true)
    expect(obj['com.apple.security.network.client']).toBe(true)
  })
})

function walk(dir: string): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}
