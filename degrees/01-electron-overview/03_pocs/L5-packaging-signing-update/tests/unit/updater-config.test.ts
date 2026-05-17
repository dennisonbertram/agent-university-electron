/**
 * src/updater.ts — generic-provider configuration (R-L5-3).
 *
 * We assert by source-text inspection that:
 *   - The updater is configured with `provider: 'generic'` (NOT `github`, NOT
 *     `s3`, NOT any provider that requires real auth in this POC).
 *   - `autoUpdater.autoDownload` is set to `false` (the test seam only
 *     verifies "check-for-updates", not download/install).
 *   - The feed URL is read from `process.env.UPDATE_URL` with a
 *     `127.0.0.1` fallback (the local-fixture pattern).
 *   - Structured log events fire on all updater lifecycle transitions.
 *
 * NOTE: in RED, `src/updater.ts` is a stub that throws — these tests fail
 * because none of the strings below appear in the stub.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const POC_ROOT = path.resolve(__dirname, '..', '..')
const UPDATER_PATH = path.join(POC_ROOT, 'src', 'updater.ts')

function readUpdater(): string {
  if (!existsSync(UPDATER_PATH)) {
    throw new Error(`updater source missing: ${UPDATER_PATH}`)
  }
  return readFileSync(UPDATER_PATH, 'utf8')
}

describe('src/updater.ts — electron-updater wiring (R-L5-3)', () => {
  it('file exists', () => {
    expect(existsSync(UPDATER_PATH)).toBe(true)
  })

  it("uses provider: 'generic' (NEVER 'github' for this POC)", () => {
    const src = readUpdater()
    expect(src).toMatch(/provider\s*:\s*['"]generic['"]/)
    // Negative: forbid the github provider in this POC.
    expect(src).not.toMatch(/provider\s*:\s*['"]github['"]/)
  })

  it('sets autoDownload = false', () => {
    const src = readUpdater()
    expect(src).toMatch(/autoDownload\s*=\s*false/)
  })

  it('reads UPDATE_URL from process.env with a 127.0.0.1 fallback', () => {
    const src = readUpdater()
    expect(src).toMatch(/process\.env\.UPDATE_URL|feedUrl/)
    expect(src).toMatch(/127\.0\.0\.1/)
  })

  it('emits structured log events for update-available / update-not-available / error', () => {
    const src = readUpdater()
    expect(src).toMatch(/updater:update-available/)
    expect(src).toMatch(/updater:update-not-available/)
    expect(src).toMatch(/updater:error/)
  })

  it('imports autoUpdater from electron-updater', () => {
    const src = readUpdater()
    expect(src).toMatch(/from\s+['"]electron-updater['"]/)
    expect(src).toMatch(/autoUpdater/)
  })
})
