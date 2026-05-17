/**
 * Focus-engine state machine for Pulse — GREEN.
 *
 * Design:
 *   ```
 *   type FocusState =
 *     | { kind: 'idle' }
 *     | { kind: 'focus', startedAt, durationMs, pausedForMs }
 *     | { kind: 'paused', resumeTo, snapshotAtSuspend, suspendedAt }
 *     | { kind: 'break', startedAt, durationMs }
 *   ```
 *
 * The reducer is pure: `(state, event) -> { state, intents }`. Side effects
 * (notifications, tray, SQLite rows) are described as `FocusIntent`s; the
 * caller in main.ts executes them. The wrapper `installFocusEngine` holds a
 * monotonic clock, drives the tick loop, and emits `state-changed` so main
 * can broadcast to renderers.
 *
 * Test-mode clock: `advanceClock(toMs)` jumps the internal clock without
 * waiting — used by `test:advance-clock` to drive timer expiry in tests.
 */
import { EventEmitter } from 'node:events'
import type { Logger } from './log'

export type FocusKind = 'idle' | 'focus' | 'break' | 'paused'

export type FocusState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'focus'
      readonly startedAt: number
      readonly durationMs: number
      readonly pausedForMs: number
    }
  | {
      readonly kind: 'paused'
      readonly resumeTo: 'focus' | 'break'
      readonly snapshotAtSuspend: FocusFocusSnapshot
      readonly suspendedAt: number
    }
  | {
      readonly kind: 'break'
      readonly startedAt: number
      readonly durationMs: number
    }

export interface FocusFocusSnapshot {
  readonly startedAt: number
  readonly durationMs: number
  readonly pausedForMs: number
}

export type FocusEvent =
  | { readonly type: 'START'; readonly durationMs: number; readonly now: number }
  | { readonly type: 'STOP'; readonly now: number }
  | { readonly type: 'TICK'; readonly now: number }
  | { readonly type: 'SLEEP'; readonly now: number }
  | { readonly type: 'WAKE'; readonly now: number }
  | { readonly type: 'EXTEND'; readonly bonusMs: number; readonly now: number }
  | { readonly type: 'COMPLETE_FORCED'; readonly now: number }

export interface FocusIntent {
  readonly kind:
    | 'tray-state'
    | 'log'
    | 'notification'
    | 'session-row:start'
    | 'session-row:pause'
    | 'session-row:resume'
    | 'session-row:complete'
    | 'session-row:stop'
  readonly payload: Record<string, unknown>
}

export interface ReducerResult {
  readonly state: FocusState
  readonly intents: readonly FocusIntent[]
}

export interface RemainingTime {
  readonly remainingMs: number
  readonly elapsedMs: number
  readonly totalMs: number
}

// ---------------------------------------------------------------------------
// Pure reducer
// ---------------------------------------------------------------------------

export function reduceFocus(state: FocusState, event: FocusEvent): ReducerResult {
  switch (event.type) {
    case 'START': {
      const next: FocusState = {
        kind: 'focus',
        startedAt: event.now,
        durationMs: event.durationMs,
        pausedForMs: 0,
      }
      const minutes = Math.round(event.durationMs / 60_000)
      return {
        state: next,
        intents: [
          { kind: 'tray-state', payload: { state: 'focus' } },
          { kind: 'log', payload: { event: `focus:start:${minutes}min`, durationMs: event.durationMs } },
          { kind: 'session-row:start', payload: { startedAt: event.now, durationMs: event.durationMs } },
        ],
      }
    }
    case 'STOP': {
      const next: FocusState = { kind: 'idle' }
      return {
        state: next,
        intents: [
          { kind: 'tray-state', payload: { state: 'idle' } },
          { kind: 'log', payload: { event: 'focus:stop' } },
          { kind: 'session-row:stop', payload: { stoppedAt: event.now } },
        ],
      }
    }
    case 'SLEEP': {
      if (state.kind === 'focus') {
        const next: FocusState = {
          kind: 'paused',
          resumeTo: 'focus',
          snapshotAtSuspend: {
            startedAt: state.startedAt,
            durationMs: state.durationMs,
            pausedForMs: state.pausedForMs,
          },
          suspendedAt: event.now,
        }
        return {
          state: next,
          intents: [
            { kind: 'tray-state', payload: { state: 'paused' } },
            { kind: 'log', payload: { event: 'focus:paused:sleep', suspendedAt: event.now } },
            { kind: 'session-row:pause', payload: { suspendedAt: event.now } },
          ],
        }
      }
      // Not in focus; ignore sleep.
      return { state, intents: [] }
    }
    case 'WAKE': {
      if (state.kind === 'paused') {
        const suspendDuration = Math.max(0, event.now - state.suspendedAt)
        const snap = state.snapshotAtSuspend
        const next: FocusState =
          state.resumeTo === 'focus'
            ? {
                kind: 'focus',
                startedAt: snap.startedAt,
                durationMs: snap.durationMs,
                pausedForMs: snap.pausedForMs + suspendDuration,
              }
            : {
                kind: 'break',
                startedAt: snap.startedAt,
                durationMs: snap.durationMs,
              }
        return {
          state: next,
          intents: [
            { kind: 'tray-state', payload: { state: next.kind } },
            { kind: 'log', payload: { event: 'focus:resumed:after-sleep', suspendDurationMs: suspendDuration } },
            { kind: 'session-row:resume', payload: { resumedAt: event.now, pausedForMs: suspendDuration } },
          ],
        }
      }
      return { state, intents: [] }
    }
    case 'EXTEND': {
      if (state.kind === 'focus') {
        const next: FocusState = {
          kind: 'focus',
          startedAt: state.startedAt,
          durationMs: state.durationMs + event.bonusMs,
          pausedForMs: state.pausedForMs,
        }
        return {
          state: next,
          intents: [
            { kind: 'log', payload: { event: 'focus:extended:+5min', bonusMs: event.bonusMs } },
          ],
        }
      }
      return { state, intents: [] }
    }
    case 'TICK':
    case 'COMPLETE_FORCED': {
      if (state.kind === 'focus') {
        const elapsedWall = event.now - state.startedAt
        const elapsedEffective = elapsedWall - state.pausedForMs
        if (event.type === 'COMPLETE_FORCED' || elapsedEffective >= state.durationMs) {
          const next: FocusState = {
            kind: 'break',
            startedAt: event.now,
            durationMs: 5 * 60_000,
          }
          return {
            state: next,
            intents: [
              { kind: 'tray-state', payload: { state: 'break' } },
              { kind: 'log', payload: { event: 'focus:complete', completedAt: event.now } },
              { kind: 'session-row:complete', payload: { completedAt: event.now } },
              {
                kind: 'notification',
                payload: {
                  title: 'Pulse',
                  body: 'Session complete — start break?',
                  actions: [{ type: 'button', text: '+5 min' }, { type: 'button', text: 'End' }],
                  handlerId: 'focus-complete',
                },
              },
            ],
          }
        }
      }
      return { state, intents: [] }
    }
    default: {
      const _exhaustive: never = event
      return { state: _exhaustive ?? state, intents: [] }
    }
  }
}

export function remainingTime(state: FocusState, now: number): RemainingTime {
  if (state.kind === 'focus') {
    const elapsedWall = now - state.startedAt
    const elapsedMs = Math.max(0, elapsedWall - state.pausedForMs)
    const remainingMs = Math.max(0, state.durationMs - elapsedMs)
    return { remainingMs, elapsedMs, totalMs: state.durationMs }
  }
  if (state.kind === 'break') {
    const elapsedMs = Math.max(0, now - state.startedAt)
    const remainingMs = Math.max(0, state.durationMs - elapsedMs)
    return { remainingMs, elapsedMs, totalMs: state.durationMs }
  }
  if (state.kind === 'paused') {
    const snap = state.snapshotAtSuspend
    const elapsedAtSuspend = state.suspendedAt - snap.startedAt - snap.pausedForMs
    const remainingMs = Math.max(0, snap.durationMs - elapsedAtSuspend)
    return { remainingMs, elapsedMs: Math.max(0, elapsedAtSuspend), totalMs: snap.durationMs }
  }
  return { remainingMs: 0, elapsedMs: 0, totalMs: 0 }
}

// ---------------------------------------------------------------------------
// Engine wrapper — emits state-changed events, runs the tick loop, supports a
// test-mode advanceClock seam.
// ---------------------------------------------------------------------------

export interface FocusEngine extends EventEmitter {
  start(durationMs: number): FocusState
  stop(): FocusState
  sleep(): FocusState
  wake(): FocusState
  extend(bonusMs: number): FocusState
  advanceClock(toMs: number): FocusState
  getState(): FocusState
  getRemaining(): RemainingTime
}

export interface InstallFocusEngineOptions {
  readonly logger: Logger
  readonly onState?: (state: FocusState) => void
  readonly onIntent?: (intent: FocusIntent) => void
  readonly tickIntervalMs?: number
}

export function installFocusEngine(opts: InstallFocusEngineOptions): FocusEngine {
  const tickIntervalMs = opts.tickIntervalMs ?? 250
  let state: FocusState = { kind: 'idle' }
  // The engine maintains an internal monotonic clock that test code can jump
  // ahead via `advanceClock`. Real time uses `Date.now()`.
  let clockOffsetMs = 0
  const now = (): number => Date.now() + clockOffsetMs
  const emitter = new EventEmitter()

  const apply = (event: FocusEvent): FocusState => {
    const result = reduceFocus(state, event)
    if (result.state !== state) {
      state = result.state
      emitter.emit('state-changed', state)
      opts.onState?.(state)
    }
    for (const intent of result.intents) {
      // Emit intents to the caller (main.ts wires them into tray, notifications,
      // SQLite, etc.) AND mirror log intents to the logger here.
      if (intent.kind === 'log') {
        const ev = String(intent.payload.event ?? 'focus:unknown')
        opts.logger.info(ev, intent.payload)
      }
      opts.onIntent?.(intent)
    }
    return state
  }

  // Tick loop — every `tickIntervalMs`, ask the reducer to consider TICK.
  // The interval is small enough to be responsive but doesn't dominate CPU.
  const interval = setInterval(() => {
    if (state.kind === 'focus') {
      apply({ type: 'TICK', now: now() })
    }
  }, tickIntervalMs)
  // Allow process exit without explicit cleanup (the Node interval otherwise
  // keeps the loop alive past tests).
  interval.unref?.()

  const engine = Object.assign(emitter, {
    start(durationMs: number): FocusState {
      return apply({ type: 'START', durationMs, now: now() })
    },
    stop(): FocusState {
      return apply({ type: 'STOP', now: now() })
    },
    sleep(): FocusState {
      return apply({ type: 'SLEEP', now: now() })
    },
    wake(): FocusState {
      return apply({ type: 'WAKE', now: now() })
    },
    extend(bonusMs: number): FocusState {
      return apply({ type: 'EXTEND', bonusMs, now: now() })
    },
    advanceClock(toMs: number): FocusState {
      // `toMs` is interpreted as "advance the internal clock so it is `toMs`
      // milliseconds AHEAD of the wall clock at the time the call landed."
      clockOffsetMs += toMs
      return apply({ type: 'TICK', now: now() })
    },
    getState(): FocusState {
      return state
    },
    getRemaining(): RemainingTime {
      return remainingTime(state, now())
    },
  }) as FocusEngine

  return engine
}
