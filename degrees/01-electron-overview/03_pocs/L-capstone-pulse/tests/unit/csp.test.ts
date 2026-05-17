/**
 * CSP integrity — the renderer index.html declares the L2/L5 strict CSP
 * (default-src 'self', no inline scripts, etc.).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const INDEX_HTML = path.resolve(__dirname, '..', '..', 'src', 'renderer', 'index.html')

describe('renderer CSP', () => {
  it('index.html exists', () => {
    expect(existsSync(INDEX_HTML)).toBe(true)
  })
  it('declares a Content-Security-Policy meta tag', () => {
    const src = readFileSync(INDEX_HTML, 'utf8')
    expect(src).toMatch(/<meta\s+http-equiv="Content-Security-Policy"/)
  })
  it('CSP contains default-src \'self\' and disallows inline scripts', () => {
    const src = readFileSync(INDEX_HTML, 'utf8')
    expect(src).toMatch(/default-src 'self'/)
    expect(src).toMatch(/script-src 'self'/)
    // No 'unsafe-inline' for scripts (style-src 'unsafe-inline' is allowed for L2 parity).
    const cspMatch = src.match(/Content-Security-Policy"\s+content="([^"]+)"/)
    expect(cspMatch).not.toBe(null)
    const csp = cspMatch![1]!
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
  })
})
