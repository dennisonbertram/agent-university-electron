/**
 * Packaging behavioral tests — BT-L5-1, BT-L5-2, BT-L5-3, BT-L5-9.
 *
 * These run `npm run package` and `npm run make` via the helpers. The runs
 * are memoized: only one `package` and one `make` execute per Playwright
 * run, regardless of how many specs reference them.
 *
 * Timing budget: package alone runs ~30-90s on M-series hardware; make adds
 * ~60-180s for DMG. We set `test.setTimeout` per-test to 5 minutes.
 */
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import plist from 'plist'
import {
  POC_ROOT,
  PRODUCT_NAME,
  expectedPackagedBundle,
  runPackage,
  runMake,
} from './helpers'

test.describe.serial('L5 — packaging artifacts', () => {
  test('BT-L5-1: `npm run package` produces a .app bundle with the expected structure', async () => {
    test.setTimeout(300_000)
    const bundle = await runPackage()
    expect(existsSync(bundle.appDir), `expected .app at ${bundle.appDir}`).toBe(true)
    expect(existsSync(bundle.contentsDir)).toBe(true)
    expect(existsSync(bundle.macOSExePath), `expected exe at ${bundle.macOSExePath}`).toBe(true)
    expect(existsSync(bundle.infoPlistPath), `expected Info.plist at ${bundle.infoPlistPath}`).toBe(true)
    // Resources/ holds the app.asar or the unpacked app/ directory.
    expect(existsSync(bundle.resourcesDir)).toBe(true)
    const resources = readdirSync(bundle.resourcesDir)
    const hasAsar = resources.includes('app.asar')
    const hasAppDir = resources.includes('app')
    expect(hasAsar || hasAppDir, `Resources/ should contain app.asar or app/, got: ${resources.join(', ')}`).toBe(true)
  })

  test('BT-L5-2: `npm run make` produces a .dmg and a .zip artifact', async () => {
    test.setTimeout(420_000)
    await runPackage() // ensure the prepackage step has happened
    const { outMakeDir } = await runMake()
    expect(existsSync(outMakeDir)).toBe(true)

    // The exact layout varies by forge version: usually
    //   out/make/{dmg,zip}/<arch>/<name>-<version>{-arm64,.zip,.dmg}
    // We do a recursive scan and look for *.dmg / *.zip.
    const allArtifacts = walk(outMakeDir)
    const dmgs = allArtifacts.filter((p) => p.endsWith('.dmg'))
    const zips = allArtifacts.filter((p) => p.endsWith('.zip'))
    expect(dmgs.length, `expected at least one .dmg under ${outMakeDir}; saw: ${allArtifacts.join('\n')}`).toBeGreaterThan(0)
    expect(zips.length, `expected at least one .zip under ${outMakeDir}; saw: ${allArtifacts.join('\n')}`).toBeGreaterThan(0)
  })

  test('BT-L5-3: packaged Info.plist contains CFBundleURLTypes (electron-l5) + version + copyright', async () => {
    test.setTimeout(300_000)
    const bundle = await runPackage()
    const xml = readFileSync(bundle.infoPlistPath, 'utf8')
    const obj = plist.parse(xml) as Record<string, unknown>

    // CFBundleURLTypes must contain electron-l5
    expect(Array.isArray(obj.CFBundleURLTypes)).toBe(true)
    const urlTypes = obj.CFBundleURLTypes as Array<Record<string, unknown>>
    const schemes = urlTypes.flatMap((entry) =>
      Array.isArray(entry.CFBundleURLSchemes) ? (entry.CFBundleURLSchemes as string[]) : [],
    )
    expect(schemes).toContain('electron-l5')

    // Version + copyright
    expect(typeof obj.CFBundleShortVersionString).toBe('string')
    expect((obj.CFBundleShortVersionString as string).length).toBeGreaterThan(0)
    expect(typeof obj.NSHumanReadableCopyright).toBe('string')
    expect((obj.NSHumanReadableCopyright as string).length).toBeGreaterThan(0)
  })

  test('BT-L5-9: entitlements.mac.plist declares the required hardened-runtime entries', async () => {
    const entitlementsPath = path.join(POC_ROOT, 'entitlements.mac.plist')
    expect(existsSync(entitlementsPath)).toBe(true)
    const obj = plist.parse(readFileSync(entitlementsPath, 'utf8')) as Record<string, unknown>
    expect(obj['com.apple.security.cs.allow-jit']).toBe(true)
    expect(obj['com.apple.security.cs.disable-library-validation']).toBe(true)
    expect(obj['com.apple.security.network.client']).toBe(true)
    // Either value is acceptable for allow-unsigned-executable-memory, but
    // the key must be declared.
    expect(
      Object.prototype.hasOwnProperty.call(obj, 'com.apple.security.cs.allow-unsigned-executable-memory'),
    ).toBe(true)
  })

  test('BT-L5-4 [skip @long-running]: universal binary build is documented but not exercised by default', async () => {
    // Universal builds require both x64 and arm64 native-module chains; they
    // routinely run 5+ minutes. We mark this skipped with an explicit reason
    // rather than silently passing. The forge config is asserted to support
    // both arches in `forge-config.test.ts`.
    test.skip(true, '@long-running: universal-binary make verified manually; see poc-report.md for one-time evidence.')
    void PRODUCT_NAME
  })
})

function walk(dir: string): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...walk(p))
    } else {
      out.push(p)
    }
  }
  return out
}
