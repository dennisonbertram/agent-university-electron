/**
 * Preload script for L1.
 *
 * Exposes a narrow, typed `window.api` surface to the renderer via contextBridge.
 * The renderer NEVER sees ipcRenderer or any Node module directly.
 *
 * Runs under sandbox: true — only whitelisted Electron modules are available
 * (`contextBridge`, `ipcRenderer`, etc. — see 01_research/02-three-process-model.md).
 *
 * ============================================================================
 * IMPORTANT — sandbox preload module-resolution gotcha
 * ----------------------------------------------------------------------------
 * Under `sandbox: true`, preload CANNOT `require()` arbitrary relative files.
 * Only whitelisted Electron + Node modules resolve (see security-model.md §
 * "sandbox: true Implications for Preload"). That means we CANNOT import the
 * `IPC_CHANNELS` constants from ./ipc here — the runtime require would silently
 * fail and `window.api` would never be exposed.
 *
 * Workaround for L1: inline the channel string literals below. The unit test
 * `tests/unit/ipc-channel-names.test.ts` cross-checks these against the canonical
 * `IPC_CHANNELS` registry so any drift fails CI before it can ship. A future POC
 * (L2+) will introduce a bundler for the preload, at which point the inline
 * literals can be removed.
 * ============================================================================
 */
import { contextBridge, ipcRenderer } from 'electron'

const RENDERER_READY = 'renderer:ready'
const APP_PING = 'app:ping'
const LOG_PATH = 'log:path'

const api = {
  /** Fire-and-forget: tell main the renderer has loaded. */
  rendererReady(userAgent: string): void {
    ipcRenderer.send(RENDERER_READY, { userAgent })
  },
  /** Request/response: returns { pong: true, ts: number } from main. */
  ping(): Promise<{ pong: true; ts: number }> {
    return ipcRenderer.invoke(APP_PING) as Promise<{ pong: true; ts: number }>
  },
  /** Returns the absolute path of the structured log file. */
  logPath(): Promise<string> {
    return ipcRenderer.invoke(LOG_PATH) as Promise<string>
  },
}

contextBridge.exposeInMainWorld('api', api)

/** Exposed for tests/unit/ipc-channel-names.test.ts to assert no drift from IPC_CHANNELS. */
export const PRELOAD_INLINE_CHANNELS = {
  RENDERER_READY,
  APP_PING,
  LOG_PATH,
} as const

export type ApiSurface = typeof api
