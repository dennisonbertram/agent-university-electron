/**
 * Focus-engine state machine for Pulse — RED commit stub.
 *
 * Design (per prompt):
 *   ```
 *   type FocusState =
 *     | { kind: 'idle' }
 *     | { kind: 'focus', startedAt, durationMs, pausedForMs }
 *     | { kind: 'paused', resumeTo, accumulatedPauseMs, lastSuspendAt }
 *     | { kind: 'break', startedAt, durationMs }
 *   ```
 *
 * The reducer is pure: it accepts `(state, event, monotonicNow)` and returns
 * the next state plus an array of side-effect "intents" (notification:show,
 * tray:set-state, log:event) that the main process executes.
 *
 * RED — implementation throws on every entry point. GREEN replaces.
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

/**
 * Pure reducer. RED stub throws.
 */
export function reduceFocus(_state: FocusState, _event: FocusEvent): ReducerResult {
  throw new Error('focus-engine: reduceFocus not implemented (RED)')
}

export function remainingTime(_state: FocusState, _now: number): RemainingTime {
  throw new Error('focus-engine: remainingTime not implemented (RED)')
}

// ---------------------------------------------------------------------------
// Engine wrapper used by main.ts. Wraps the pure reducer + a monotonic clock,
// emits state-change events via Node's EventEmitter. RED stub.
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
  /**
   * Tick interval in ms. Default 250.
   * The test seam `test:advance-clock` lets specs jump time without waiting.
   */
  readonly tickIntervalMs?: number
}

export function installFocusEngine(_opts: InstallFocusEngineOptions): FocusEngine {
  throw new Error('focus-engine: installFocusEngine not implemented (RED)')
}
