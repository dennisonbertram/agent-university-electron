/**
 * Tray controller for L4.
 *
 * State machine: 'idle' | 'focused' | 'break' | 'paused'.
 * Each state has its own title text (and template image variant). The Tray
 * instance is held in a MODULE-SCOPED variable so it cannot be garbage
 * collected (FM-04, R-L4-1). NEVER return a fresh Tray from a local var.
 *
 * RED commit: every method throws or returns sentinel values so BT-L4-1/2 fail
 * and the static-source regression test still passes.
 */
import type { Logger } from './log'

export type TrayState = 'idle' | 'focused' | 'break' | 'paused'

export interface TrayStateView {
  readonly state: TrayState
  readonly title: string
  readonly hasImage: boolean
}

// CRITICAL: module-scope variable so GC cannot reclaim the Tray (FM-04).
// R-L4-1 statically asserts the presence of `let trayInstance` here.
let trayInstance: unknown | null = null

export interface InstallTrayOptions {
  readonly logger: Logger
  readonly initialState?: TrayState
}

export interface TrayController {
  setState(state: TrayState): void
  getState(): TrayStateView
  destroy(): void
}

export const STATE_TITLE: Record<TrayState, string> = {
  idle: '●',
  focused: '▶',
  break: '◌',
  paused: '⏸',
}

export function installTray(_opts: InstallTrayOptions): TrayController {
  void trayInstance
  throw new Error('installTray: not implemented (RED)')
}

export function getTrayState(): TrayStateView | null {
  return null
}
