/**
 * Tray controller for Pulse.
 *
 * State machine: 'idle' | 'focus' | 'break' | 'paused'. (Renamed from L4's
 * 'focused' to align with the focus-engine's state names.)
 *
 * Per the prompt: "real PNG template variants" are ideal, but title-string
 * fallback is documented and acceptable. We keep the L5 title-string design
 * (●/▶/◌/⏸) and document the deviation in poc-report.md.
 *
 * R-L4-1 carry-forward: the Tray instance lives in a MODULE-SCOPED variable
 * (`trayInstance`) so GC cannot reclaim it.
 */
import { nativeImage, type NativeImage, Tray } from 'electron'
import type { Logger } from './log'

export type TrayState = 'idle' | 'focus' | 'break' | 'paused'

export interface TrayStateView {
  readonly state: TrayState
  readonly title: string
  readonly hasImage: boolean
}

// CRITICAL: module-scope variable so GC cannot reclaim the Tray (R-L4-1).
let trayInstance: Tray | null = null
let currentState: TrayState = 'idle'

export const STATE_TITLE: Record<TrayState, string> = {
  idle: '●',
  focus: '▶',
  break: '◌',
  paused: '⏸',
}

const TEMPLATE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAJklEQVR42mNgGAW' +
  'jYBQMHkAGYBPgADcwGYP4kFADcGoGcQGAAA/8AETkQ2N0AAAAAElFTkSuQmCC'

function templateImage(): NativeImage {
  const buf = Buffer.from(TEMPLATE_PNG_BASE64, 'base64')
  const img = nativeImage.createFromBuffer(buf)
  if (typeof img.setTemplateImage === 'function') {
    img.setTemplateImage(true)
  }
  return img
}

export interface InstallTrayOptions {
  readonly logger: Logger
  readonly initialState?: TrayState
}

export interface TrayController {
  setState(state: TrayState): void
  getState(): TrayStateView
  destroy(): void
}

export function installTray(opts: InstallTrayOptions): TrayController {
  const { logger } = opts
  const initialState: TrayState = opts.initialState ?? 'idle'

  const image = templateImage()
  trayInstance = new Tray(image)
  currentState = initialState
  applyState(currentState)
  trayInstance.setToolTip('Pulse — focus & journal')
  logger.info('tray:installed', {
    state: currentState,
    title: STATE_TITLE[currentState],
  })

  return {
    setState(next: TrayState): void {
      if (!trayInstance) {
        logger.warn('tray:set-state:no-tray', { state: next })
        return
      }
      currentState = next
      applyState(next)
      logger.info('tray:state-changed', { state: next, title: STATE_TITLE[next] })
    },
    getState(): TrayStateView {
      return {
        state: currentState,
        title: trayInstance ? trayInstance.getTitle() : STATE_TITLE[currentState],
        hasImage: trayInstance !== null,
      }
    },
    destroy(): void {
      if (trayInstance) {
        trayInstance.destroy()
        trayInstance = null
        logger.info('tray:destroyed', {})
      }
    },
  }
}

function applyState(state: TrayState): void {
  if (!trayInstance) return
  trayInstance.setTitle(STATE_TITLE[state])
}

export function getTrayInstance(): Tray | null {
  return trayInstance
}
