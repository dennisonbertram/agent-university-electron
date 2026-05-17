/**
 * R-L2-4 (unit-test side): parse src/renderer/index.html and assert the CSP
 * meta tag is present and not weakened.
 *
 * Required directives at L2:
 *   default-src 'self'
 *   script-src 'self'   (NO 'unsafe-inline', NO 'unsafe-eval')
 *
 * Permitted carve-outs (documented in README):
 *   style-src 'self' 'unsafe-inline' — pragmatic concession for renderer-side
 *   styling without a CSS bundler; tightened in a later POC if needed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const htmlPath = path.resolve(__dirname, '..', '..', 'src', 'renderer', 'index.html')

function readCspContent(html: string): string {
  // Extract `content="..."` from the CSP meta tag.
  // We assume the file uses double-quoted attributes (it does in our index.html).
  const match = html.match(
    /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"[^>]*>/i,
  )
  if (!match) throw new Error('CSP meta tag missing or unparseable in index.html')
  return match[1]
}

describe('renderer/index.html — CSP meta tag', () => {
  it('Given index.html, when read, then it exists', () => {
    expect(existsSync(htmlPath)).toBe(true)
  })

  it('Given index.html, when parsed, then a CSP meta tag is present', () => {
    const html = readFileSync(htmlPath, 'utf8')
    expect(() => readCspContent(html)).not.toThrow()
  })

  it('Given the CSP, when read, then default-src is "self"', () => {
    const csp = readCspContent(readFileSync(htmlPath, 'utf8'))
    expect(csp).toMatch(/default-src\s+'self'/)
  })

  it('Given the CSP, when read, then script-src is "self" and contains NO unsafe-inline / unsafe-eval', () => {
    const csp = readCspContent(readFileSync(htmlPath, 'utf8'))
    expect(csp).toMatch(/script-src\s+'self'/)
    // script-src directive boundary up to next ';'
    const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/)
    expect(scriptSrcMatch).toBeTruthy()
    const scriptSrcDirective = scriptSrcMatch?.[1] ?? ''
    expect(scriptSrcDirective).not.toMatch(/'unsafe-inline'/)
    expect(scriptSrcDirective).not.toMatch(/'unsafe-eval'/)
  })

  it('Given the CSP, when read, then object-src is "none" (documented hardening)', () => {
    const csp = readCspContent(readFileSync(htmlPath, 'utf8'))
    expect(csp).toMatch(/object-src\s+'none'/)
  })

  it('Given the CSP, when read, then base-uri is "none" or "self" (prevents base-tag hijack)', () => {
    const csp = readCspContent(readFileSync(htmlPath, 'utf8'))
    expect(csp).toMatch(/base-uri\s+'(none|self)'/)
  })
})
