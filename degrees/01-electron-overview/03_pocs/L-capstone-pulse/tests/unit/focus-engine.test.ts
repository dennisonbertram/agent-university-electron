/**
 * Pure reducer + engine tests for the focus state machine.
 *
 * RED: these fail because reduceFocus / installFocusEngine throw.
 * GREEN: the reducer transitions idle→focus→paused→focus→break correctly,
 * accumulates pausedForMs across SLEEP/WAKE pairs, and applies EXTEND.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({}))

import { reduceFocus, remainingTime, installFocusEngine, type FocusState } from '../../src/focus-engine'

function silentLogger(): { info: () => void; warn: () => void; error: () => void; debug: () => void } {
  return { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
}

describe('reduceFocus — pure transitions', () => {
  it('idle + START -> focus with startedAt + durationMs + pausedForMs=0', () => {
    const out = reduceFocus({ kind: 'idle' }, { type: 'START', durationMs: 1_500_000, now: 1000 })
    expect(out.state.kind).toBe('focus')
    if (out.state.kind !== 'focus') throw new Error('unreachable')
    expect(out.state.startedAt).toBe(1000)
    expect(out.state.durationMs).toBe(1_500_000)
    expect(out.state.pausedForMs).toBe(0)
  })

  it('focus + SLEEP -> paused with snapshotAtSuspend + suspendedAt', () => {
    const start = reduceFocus({ kind: 'idle' }, { type: 'START', durationMs: 1_500_000, now: 1000 })
    const slept = reduceFocus(start.state, { type: 'SLEEP', now: 2000 })
    expect(slept.state.kind).toBe('paused')
    if (slept.state.kind !== 'paused') throw new Error('unreachable')
    expect(slept.state.suspendedAt).toBe(2000)
    expect(slept.state.snapshotAtSuspend.startedAt).toBe(1000)
  })

  it('paused + WAKE -> focus with pausedForMs incremented by suspend duration', () => {
    const start = reduceFocus({ kind: 'idle' }, { type: 'START', durationMs: 1_500_000, now: 1000 })
    const slept = reduceFocus(start.state, { type: 'SLEEP', now: 2000 })
    const woken = reduceFocus(slept.state, { type: 'WAKE', now: 5000 })
    expect(woken.state.kind).toBe('focus')
    if (woken.state.kind !== 'focus') throw new Error('unreachable')
    expect(woken.state.pausedForMs).toBe(3000)
    expect(woken.state.startedAt).toBe(1000) // preserved
  })

  it('focus + COMPLETE_FORCED -> break', () => {
    const start = reduceFocus({ kind: 'idle' }, { type: 'START', durationMs: 1_500_000, now: 1000 })
    const completed = reduceFocus(start.state, { type: 'COMPLETE_FORCED', now: 6000 })
    expect(completed.state.kind).toBe('break')
  })

  it('focus + STOP -> idle', () => {
    const start = reduceFocus({ kind: 'idle' }, { type: 'START', durationMs: 1_500_000, now: 1000 })
    const stopped = reduceFocus(start.state, { type: 'STOP', now: 1500 })
    expect(stopped.state.kind).toBe('idle')
  })

  it('focus + EXTEND(bonusMs) -> focus with durationMs += bonusMs', () => {
    const start = reduceFocus({ kind: 'idle' }, { type: 'START', durationMs: 1_500_000, now: 1000 })
    const extended = reduceFocus(start.state, { type: 'EXTEND', bonusMs: 300_000, now: 1500 })
    expect(extended.state.kind).toBe('focus')
    if (extended.state.kind !== 'focus') throw new Error('unreachable')
    expect(extended.state.durationMs).toBe(1_800_000)
  })
})

describe('remainingTime', () => {
  it('focus with 5s elapsed of 10s returns 5s remaining', () => {
    const state: FocusState = { kind: 'focus', startedAt: 1000, durationMs: 10_000, pausedForMs: 0 }
    expect(remainingTime(state, 6000).remainingMs).toBe(5000)
  })
  it('focus paused for 3s of 10s, then 5s after sleep -> still 5s elapsed effective', () => {
    const state: FocusState = { kind: 'focus', startedAt: 1000, durationMs: 10_000, pausedForMs: 3000 }
    // Wall now=9000, elapsedWall=8000, effective=8000-3000=5000, remaining=5000
    expect(remainingTime(state, 9000).remainingMs).toBe(5000)
  })
  it('idle returns remainingMs=0, totalMs=0', () => {
    const r = remainingTime({ kind: 'idle' }, 0)
    expect(r.remainingMs).toBe(0)
    expect(r.totalMs).toBe(0)
  })
})

describe('installFocusEngine wrapper', () => {
  it('installs and starts a focus session', () => {
    const engine = installFocusEngine({ logger: silentLogger() as never })
    const s = engine.start(1_500_000)
    expect(s.kind).toBe('focus')
  })

  it('emits a state-changed event when the state transitions', () => {
    const engine = installFocusEngine({ logger: silentLogger() as never })
    const seen: FocusState[] = []
    engine.on('state-changed', (state: FocusState) => seen.push(state))
    engine.start(1_500_000)
    engine.stop()
    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(seen[seen.length - 1]!.kind).toBe('idle')
  })
})
