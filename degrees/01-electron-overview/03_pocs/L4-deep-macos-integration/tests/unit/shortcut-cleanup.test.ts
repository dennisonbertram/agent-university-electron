/**
 * R-L4-2 (static-source side) — src/shortcuts.ts must register a will-quit
 * cleanup hook that calls `globalShortcut.unregisterAll()`.
 *
 * The runtime side (BT-L4-12) verifies the cleanup actually unregisters a
 * known shortcut after a programmatic `will-quit` emit.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const shortcutsTsPath = path.resolve(__dirname, '..', '..', 'src', 'shortcuts.ts')

describe('R-L4-2 (static): shortcuts.ts registers will-quit cleanup', () => {
  it('Given the file, when read, then it exists', () => {
    expect(existsSync(shortcutsTsPath)).toBe(true)
  })

  it('Given the file, when read, then it imports `globalShortcut` from electron', () => {
    const src = readFileSync(shortcutsTsPath, 'utf8')
    expect(src).toMatch(/from\s+['"]electron['"]/)
    expect(src).toMatch(/globalShortcut/)
  })

  it('Given the file, when read, then it references `app.on(\'will-quit\'`', () => {
    const src = readFileSync(shortcutsTsPath, 'utf8')
    expect(src).toMatch(/app\.on\s*\(\s*['"]will-quit['"]/)
  })

  it('Given the file, when read, then it references `globalShortcut.unregisterAll`', () => {
    const src = readFileSync(shortcutsTsPath, 'utf8')
    expect(src).toMatch(/globalShortcut\.unregisterAll/)
  })
})
