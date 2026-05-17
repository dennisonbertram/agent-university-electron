/**
 * Info.plist.template inspection.
 *
 * This template carries deep-link registration + version + copyright entries
 * that `@electron/packager` merges into the final Info.plist when packaging
 * (via `packagerConfig.extendInfo`). We assert the template contains:
 *   - CFBundleURLTypes with an entry for the `electron-l5` scheme (R-L5-5).
 *   - CFBundleShortVersionString.
 *   - NSHumanReadableCopyright.
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

describe('Info.plist.template — deep-link + version metadata (BT-L5-3, R-L5-5)', () => {
  it('template exists at the POC root', () => {
    expect(existsSync(TEMPLATE_PATH)).toBe(true)
  })

  it('declares CFBundleURLTypes with electron-l5 scheme', () => {
    const obj = readTemplate()
    expect(Array.isArray(obj.CFBundleURLTypes)).toBe(true)
    const urlTypes = obj.CFBundleURLTypes as Array<Record<string, unknown>>
    const schemes = urlTypes.flatMap((entry) =>
      Array.isArray(entry.CFBundleURLSchemes) ? (entry.CFBundleURLSchemes as string[]) : [],
    )
    expect(schemes).toContain('electron-l5')
  })

  it('declares CFBundleShortVersionString', () => {
    const obj = readTemplate()
    expect(typeof obj.CFBundleShortVersionString).toBe('string')
    expect((obj.CFBundleShortVersionString as string).length).toBeGreaterThan(0)
  })

  it('declares NSHumanReadableCopyright', () => {
    const obj = readTemplate()
    expect(typeof obj.NSHumanReadableCopyright).toBe('string')
    expect((obj.NSHumanReadableCopyright as string).length).toBeGreaterThan(0)
  })
})
