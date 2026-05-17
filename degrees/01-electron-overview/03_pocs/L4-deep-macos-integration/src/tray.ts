/**
 * Tray controller for L4.
 *
 * State machine: 'idle' | 'focused' | 'break' | 'paused'.
 * Each state has its own title text and a generated template-image variant
 * (see GENERATED_IMAGES below). The Tray instance is held in the
 * MODULE-SCOPED `trayInstance` variable so it cannot be GC'd (FM-04, R-L4-1).
 *
 * The template image is generated programmatically from a tiny embedded buffer
 * so the POC does not need to ship PNG asset files. For real desktop polish
 * the capstone swaps in real `trayTemplate@1x/@2x.png` files. Documented in
 * poc-report.md as a deliberate deviation.
 */
import { nativeImage, type NativeImage, Tray } from 'electron'
import type { Logger } from './log'

export type TrayState = 'idle' | 'focused' | 'break' | 'paused'

export interface TrayStateView {
  readonly state: TrayState
  readonly title: string
  readonly hasImage: boolean
}

// CRITICAL: module-scope variable so GC cannot reclaim the Tray (FM-04).
// R-L4-1 statically asserts the presence of `let trayInstance` here.
let trayInstance: Tray | null = null
let currentState: TrayState = 'idle'

export const STATE_TITLE: Record<TrayState, string> = {
  idle: '●',
  focused: '▶',
  break: '◌',
  paused: '⏸',
}

// 16×16 single-color PNG (transparent). We use the same image for every state
// and rely on the title string to differentiate. macOS would automatically
// invert this template image based on system theme.
const TEMPLATE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAJklEQVR42mNgGAW' +
  'jYBQMHkAGYBPgADcwGYP4kFADcGoGcQGAAA/8AETkQ2N0AAAAAElFTkSuQmCC'

function templateImage(): NativeImage {
  const buf = Buffer.from(TEMPLATE_PNG_BASE64, 'base64')
  const img = nativeImage.createFromBuffer(buf)
  // Mark as template so macOS handles light/dark inversion. On non-mac
  // platforms this is a no-op.
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
  trayInstance.setToolTip('L4 — Deep macOS System Integration')
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
