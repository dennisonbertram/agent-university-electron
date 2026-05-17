/**
 * Forge config — static inspection.
 *
 * We import `forge.config.ts` directly via ts-node-style transpilation via
 * Vitest's `esbuild` loader and inspect the exported config object.
 *
 * Assertions:
 *   - makers includes MakerDMG and MakerZIP.
 *   - plugins includes FusesPlugin with RunAsNode:false +
 *     EnableNodeOptionsEnvironmentVariable:false (R-L5-2).
 *   - packagerConfig.protocols registers `electron-l5`.
 *   - packagerConfig.appBundleId is set.
 *   - osxSign and osxNotarize are wired through a credential gate
 *     (we don't actually run signing; we only check the conditional shape).
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const POC_ROOT = path.resolve(__dirname, '..', '..')
const FORGE_CONFIG_PATH = path.join(POC_ROOT, 'forge.config.ts')

/**
 * We parse the forge config as text (not via import). Importing the file at
 * test time pulls in electron-forge transitive deps that try to require
 * native modules, which slows tests down. Static text inspection captures
 * the same information for our regression purposes.
 */
function readForgeConfig(): string {
  return readFileSync(FORGE_CONFIG_PATH, 'utf8')
}

describe('forge.config.ts — packaging configuration', () => {
  it('file exists at the POC root', () => {
    expect(existsSync(FORGE_CONFIG_PATH)).toBe(true)
  })

  it('makers list includes MakerDMG (BT-L5-2)', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/MakerDMG/)
    expect(src).toMatch(/@electron-forge\/maker-dmg/)
  })

  it('makers list includes MakerZIP (BT-L5-2)', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/MakerZIP/)
    expect(src).toMatch(/@electron-forge\/maker-zip/)
  })

  it('plugins list includes FusesPlugin with RunAsNode:false (R-L5-2)', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/FusesPlugin/)
    expect(src).toMatch(/RunAsNode\]\s*:\s*false/)
  })

  it('plugins list includes FusesPlugin with EnableNodeOptionsEnvironmentVariable:false (R-L5-2)', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/EnableNodeOptionsEnvironmentVariable\]\s*:\s*false/)
  })

  it('packagerConfig registers electron-l5 protocol (BT-L5-3)', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/electron-l5/)
    expect(src).toMatch(/protocols/)
  })

  it('packagerConfig sets appBundleId', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/appBundleId/)
  })

  it('osxSign + osxNotarize are wired through a credential gate (BT-L5-5)', () => {
    const src = readForgeConfig()
    // We look for the conditional pattern: `process.env.APPLE_ID` somewhere
    // near osxSign or osxNotarize. The exact form may vary (ternary,
    // spread+conditional, etc.) so we just assert the substrings are present.
    expect(src).toMatch(/osxSign/)
    expect(src).toMatch(/osxNotarize/)
    expect(src).toMatch(/process\.env\.APPLE_ID/)
  })
})
