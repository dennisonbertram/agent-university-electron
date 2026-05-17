/**
 * R-L2-3 (unit-test side): read src/window.ts and assert the secure-default
 * webPreferences constants are present and not weakened.
 *
 * This is enforceable because window.ts is the single source of truth for
 * BrowserWindow construction.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const windowTsPath = path.resolve(__dirname, '..', '..', 'src', 'window.ts')

describe('src/window.ts — secure defaults', () => {
  it('Given window.ts, when read, then it exists', () => {
    expect(existsSync(windowTsPath)).toBe(true)
  })

  it('Given window.ts, when read, then it sets contextIsolation: true', () => {
    const src = readFileSync(windowTsPath, 'utf8')
    expect(src).toMatch(/contextIsolation:\s*true/)
    expect(src).not.toMatch(/contextIsolation:\s*false/)
  })

  it('Given window.ts, when read, then it sets sandbox: true', () => {
    const src = readFileSync(windowTsPath, 'utf8')
    expect(src).toMatch(/sandbox:\s*true/)
    expect(src).not.toMatch(/sandbox:\s*false/)
  })

  it('Given window.ts, when read, then it sets nodeIntegration: false', () => {
    const src = readFileSync(windowTsPath, 'utf8')
    expect(src).toMatch(/nodeIntegration:\s*false/)
    expect(src).not.toMatch(/nodeIntegration:\s*true/)
  })

  it('Given window.ts, when read, then it sets webSecurity: true (explicit, not default)', () => {
    const src = readFileSync(windowTsPath, 'utf8')
    expect(src).toMatch(/webSecurity:\s*true/)
    expect(src).not.toMatch(/webSecurity:\s*false/)
  })

  it('Given window.ts, when read, then it does NOT set allowRunningInsecureContent or experimental flags to true', () => {
    const src = readFileSync(windowTsPath, 'utf8')
    expect(src).not.toMatch(/allowRunningInsecureContent:\s*true/)
    expect(src).not.toMatch(/experimentalFeatures:\s*true/)
  })
})
