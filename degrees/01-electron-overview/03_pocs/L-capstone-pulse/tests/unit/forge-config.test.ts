/**
 * Forge config static inspection — Pulse capstone.
 *
 * Asserts:
 *   - MakerDMG + MakerZIP present.
 *   - FusesPlugin with RunAsNode:false + EnableNodeOptionsEnvironmentVariable:false.
 *   - AutoUnpackNativesPlugin present (R-C-8).
 *   - packagerConfig.protocols registers `pulse`.
 *   - osxSign/osxNotarize wired through an APPLE_ID env gate.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const POC_ROOT = path.resolve(__dirname, '..', '..')
const FORGE_CONFIG_PATH = path.join(POC_ROOT, 'forge.config.ts')

function readForgeConfig(): string {
  return readFileSync(FORGE_CONFIG_PATH, 'utf8')
}

describe('forge.config.ts — packaging configuration (Pulse)', () => {
  it('file exists', () => {
    expect(existsSync(FORGE_CONFIG_PATH)).toBe(true)
  })

  it('makers list includes MakerDMG', () => {
    expect(readForgeConfig()).toMatch(/MakerDMG/)
  })
  it('makers list includes MakerZIP', () => {
    expect(readForgeConfig()).toMatch(/MakerZIP/)
  })
  it('plugins list includes FusesPlugin with RunAsNode:false', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/FusesPlugin/)
    expect(src).toMatch(/RunAsNode\]\s*:\s*false/)
  })
  it('plugins list includes FusesPlugin with EnableNodeOptionsEnvironmentVariable:false', () => {
    expect(readForgeConfig()).toMatch(/EnableNodeOptionsEnvironmentVariable\]\s*:\s*false/)
  })
  it('plugins list includes AutoUnpackNativesPlugin (R-C-8)', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/AutoUnpackNativesPlugin/)
    expect(src).toMatch(/@electron-forge\/plugin-auto-unpack-natives/)
  })
  it('packagerConfig registers pulse:// protocol (NOT electron-l5)', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/protocols/)
    expect(src).toMatch(/schemes:\s*\[\s*'pulse'\s*\]/)
    // The OLD scheme must not appear as a registered scheme.
    expect(src).not.toMatch(/schemes:\s*\[\s*'electron-l5'\s*\]/)
  })
  it('packagerConfig sets appBundleId', () => {
    expect(readForgeConfig()).toMatch(/appBundleId/)
  })
  it('osxSign + osxNotarize gated on process.env.APPLE_ID', () => {
    const src = readForgeConfig()
    expect(src).toMatch(/osxSign/)
    expect(src).toMatch(/osxNotarize/)
    expect(src).toMatch(/process\.env\.APPLE_ID/)
  })
})
