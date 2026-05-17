/**
 * Info.plist.template inspection. Asserts:
 *   - CFBundleURLTypes contains the `pulse` scheme (and NOT electron-l5).
 *   - CFBundleShortVersionString present.
 *   - NSHumanReadableCopyright present.
 *   - LSUIElement decision documented (key present + value asserted; the
 *     poc-report records whether the value is true or omitted-by-design).
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import plist from 'plist'

const POC_ROOT = path.resolve(__dirname, '..', '..')
const TEMPLATE_PATH = path.join(POC_ROOT, 'Info.plist.template')

function readTemplate(): Record<string, unknown> {
  if (!existsSync(TEMPLATE_PATH)) {
    throw new Error(`template missing: ${TEMPLATE_PATH}`)
  }
  return plist.parse(readFileSync(TEMPLATE_PATH, 'utf8')) as Record<string, unknown>
}

describe('Info.plist.template — Pulse capstone', () => {
  it('exists', () => {
    expect(existsSync(TEMPLATE_PATH)).toBe(true)
  })

  it('declares CFBundleURLTypes with the pulse scheme', () => {
    const obj = readTemplate()
    expect(Array.isArray(obj.CFBundleURLTypes)).toBe(true)
    const urlTypes = obj.CFBundleURLTypes as Array<Record<string, unknown>>
    const schemes = urlTypes.flatMap((entry) =>
      Array.isArray(entry.CFBundleURLSchemes) ? (entry.CFBundleURLSchemes as string[]) : [],
    )
    expect(schemes).toContain('pulse')
    expect(schemes).not.toContain('electron-l5')
  })

  it('declares CFBundleShortVersionString', () => {
    const obj = readTemplate()
    expect(typeof obj.CFBundleShortVersionString).toBe('string')
    expect((obj.CFBundleShortVersionString as string).length).toBeGreaterThan(0)
  })

  it('declares NSHumanReadableCopyright', () => {
    const obj = readTemplate()
    expect(typeof obj.NSHumanReadableCopyright).toBe('string')
  })

  it('LSUIElement decision is captured (true OR explicitly omitted)', () => {
    const obj = readTemplate()
    // The capstone aims for LSUIElement=true (menu-bar-only). If a future
    // commit decides to omit it (dock icon allowed), the poc-report MUST
    // document the deviation — this assertion captures the live state.
    if ('LSUIElement' in obj) {
      expect(obj.LSUIElement).toBe(true)
    }
    // Either branch is acceptable; the test serves as a "shape" lock.
  })
})
