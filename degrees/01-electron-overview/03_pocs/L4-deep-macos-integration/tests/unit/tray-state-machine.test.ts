/**
 * Unit test for the tray-state-machine state table.
 *
 * The state-table for L4 lives as `STATE_TITLE` in src/tray.ts. We assert it
 * exposes a title for every TrayState, and that titles are distinct so the
 * BT-L4-2 transition can be detected by reading the title.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  Tray: class {},
  nativeImage: { createFromBuffer: vi.fn(), createFromPath: vi.fn() },
}))

import { STATE_TITLE } from '../../src/tray'

const STATES = ['idle', 'focused', 'break', 'paused'] as const

describe('STATE_TITLE — tray state machine titles', () => {
  it.each(STATES)('Given state "%s", a non-empty title exists', (s) => {
    const title = STATE_TITLE[s]
    expect(typeof title).toBe('string')
    expect(title.length).toBeGreaterThan(0)
  })

  it('Given all four states, titles are distinct', () => {
    const titles = new Set(STATES.map((s) => STATE_TITLE[s]))
    expect(titles.size).toBe(STATES.length)
  })
})
