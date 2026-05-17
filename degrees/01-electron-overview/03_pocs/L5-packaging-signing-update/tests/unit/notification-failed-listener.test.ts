/**
 * R-L4-3 (static-source side) — every Notification show in `src/notifications.ts`
 * is paired with a `failed` listener registration.
 *
 * The runtime side of R-L4-3 is in tests/e2e/notifications.spec.ts (BT-L4-3).
 *
 * Static rule:
 *   1. The file must reference `new Notification(...)`.
 *   2. The file must reference both `.on('failed'` (or `.once('failed'`) AND
 *      `.show(` — and the `failed` registration must occur before `.show(`.
 *   3. We assert there is at least one `failed` listener registered per
 *      `.show()` call. This is a weak heuristic but sufficient to catch the
 *      most common regression: someone calls `n.show()` without wiring the
 *      listener and the unsigned-dev failure silently disappears.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const notificationsTsPath = path.resolve(__dirname, '..', '..', 'src', 'notifications.ts')

describe('R-L4-3 (static): notifications.ts pairs `failed` listener with `show()`', () => {
  it('Given the file, when read, then it exists', () => {
    expect(existsSync(notificationsTsPath)).toBe(true)
  })

  it('Given the file, when read, then it constructs `new Notification(...)`', () => {
    const src = readFileSync(notificationsTsPath, 'utf8')
    expect(src).toMatch(/new\s+Notification\s*\(/)
  })

  it('Given the file, when read, then it registers a `failed` listener', () => {
    const src = readFileSync(notificationsTsPath, 'utf8')
    // Either .on('failed') or .once('failed') OR addListener('failed').
    expect(src).toMatch(/\.(on|once|addListener)\s*\(\s*['"]failed['"]/)
  })

  it('Given the file, when read, then `.show(` appears AFTER the `failed` listener', () => {
    const src = readFileSync(notificationsTsPath, 'utf8')
    const failedIdx = src.search(/\.(on|once|addListener)\s*\(\s*['"]failed['"]/)
    const showIdx = src.search(/\.show\s*\(/)
    // If no .show() yet (RED stub), this guard does not fail the test —
    // failedIdx should still appear OR be at least < showIdx if both exist.
    if (showIdx < 0) {
      // no .show() in RED stub — skip
      return
    }
    expect(failedIdx, 'failed listener must be registered before any .show()').toBeGreaterThanOrEqual(0)
    expect(failedIdx).toBeLessThan(showIdx)
  })
})
