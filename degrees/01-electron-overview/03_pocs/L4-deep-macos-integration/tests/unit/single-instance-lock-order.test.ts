/**
 * R-L4-5 (static-source side) — `app.requestSingleInstanceLock()` is called
 * BEFORE `app.whenReady()` in src/main.ts.
 *
 * We read the file and assert the byte offset of the first
 * `requestSingleInstanceLock` call is less than the byte offset of the first
 * `whenReady()` call.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const mainTsPath = path.resolve(__dirname, '..', '..', 'src', 'main.ts')

describe('R-L4-5 (static): main.ts calls requestSingleInstanceLock BEFORE whenReady', () => {
  it('Given the file, when read, then it exists', () => {
    expect(existsSync(mainTsPath)).toBe(true)
  })

  it('Given the file, when read, then both calls appear', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    expect(src).toMatch(/requestSingleInstanceLock\s*\(/)
    expect(src).toMatch(/whenReady\s*\(/)
  })

  it('Given the file, requestSingleInstanceLock() appears BEFORE whenReady()', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    const lockIdx = src.search(/requestSingleInstanceLock\s*\(/)
    const whenReadyIdx = src.search(/whenReady\s*\(/)
    expect(lockIdx).toBeGreaterThanOrEqual(0)
    expect(whenReadyIdx).toBeGreaterThan(lockIdx)
  })

  it('Given the file, when read, then it sets the protocol scheme via setAsDefaultProtocolClient', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    expect(src).toMatch(/setAsDefaultProtocolClient/)
  })
})
