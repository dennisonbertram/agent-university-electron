/**
 * R-L4-1 carry-forward — Tray instance must be held in a module-scope
 * variable so GC cannot reclaim it. Static-source check.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const trayPath = path.resolve(__dirname, '..', '..', 'src', 'tray.ts')

describe('tray.ts module-scope Tray instance (R-L4-1)', () => {
  it('declares trayInstance at module scope (`let trayInstance` outside any function)', () => {
    const src = readFileSync(trayPath, 'utf8')
    expect(src).toMatch(/^let trayInstance/m)
  })
  it('module assigns `new Tray(...)` to the module-scope variable', () => {
    const src = readFileSync(trayPath, 'utf8')
    expect(src).toMatch(/trayInstance\s*=\s*new\s+Tray\s*\(/)
  })
})
