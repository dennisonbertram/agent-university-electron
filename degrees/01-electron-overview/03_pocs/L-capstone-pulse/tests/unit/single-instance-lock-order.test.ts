/**
 * R-L4-5 / R-C-4 (static-source) — main.ts calls requestSingleInstanceLock
 * BEFORE app.whenReady().
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const mainTsPath = path.resolve(__dirname, '..', '..', 'src', 'main.ts')

describe('R-C-4 (static): main.ts calls requestSingleInstanceLock BEFORE whenReady', () => {
  it('main.ts exists', () => {
    expect(existsSync(mainTsPath)).toBe(true)
  })
  it('both calls appear', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    expect(src).toMatch(/requestSingleInstanceLock\s*\(/)
    expect(src).toMatch(/whenReady\s*\(/)
  })
  it('requestSingleInstanceLock() appears BEFORE whenReady()', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    const lockIdx = src.search(/requestSingleInstanceLock\s*\(/)
    const whenReadyIdx = src.search(/whenReady\s*\(/)
    expect(lockIdx).toBeGreaterThanOrEqual(0)
    expect(whenReadyIdx).toBeGreaterThan(lockIdx)
  })
  it('setAsDefaultProtocolClient is invoked', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    expect(src).toMatch(/setAsDefaultProtocolClient/)
  })
  it('the pulse scheme is the canonical scheme (NOT electron-l5)', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    // The DEEP_LINK_SCHEME import binds 'pulse' — direct literal occurrence is
    // also valid (e.g., the protocols field). We just assert 'electron-l5'
    // doesn't appear anywhere.
    expect(src).not.toMatch(/electron-l5/)
  })
})
