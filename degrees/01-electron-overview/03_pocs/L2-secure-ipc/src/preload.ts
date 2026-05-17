/**
 * Preload — exposes `window.api` to the renderer via contextBridge.
 *
 * L2 NOTE on the L1 expectation-gap (Entry 1): under `sandbox: true` preload
 * cannot `require()` arbitrary relative TS files at runtime. L1 inlined the
 * channel string literals as a workaround. L2 instead bundles this file with
 * esbuild into a single dist/preload.js, which lets us import the typed
 * `IPC_CHANNELS` and `PUSH_CHANNELS` from `./ipc` cleanly. The bundler
 * resolves them at build time; Electron's `external: ['electron']` flag
 * preserves the runtime `require('electron')` so contextBridge + ipcRenderer
 * still resolve through Electron's whitelist. Decision logged in
 * 04_logs/decision-log.md Entry 5.
 *
 * SKELETON (RED commit): exposes a stub `window.api` whose methods reject
 * with "not implemented" — enough for the renderer to load and for the
 * unit tests to import this file, but the e2e tests fail on real
 * assertions (rejected promises, missing log entries).
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, PUSH_CHANNELS } from './ipc'

type TickListener = (n: number) => void

// RED skeleton — methods are wired but the underlying handlers are stubs in
// src/ipc.ts. The renderer will see "no handler registered" errors.
const api = {
  ping(): Promise<{ pong: true; ts: number; monotonic: number }> {
    return ipcRenderer.invoke(IPC_CHANNELS.PING) as Promise<{
      pong: true
      ts: number
      monotonic: number
    }>
  },
  echo<T>(value: T): Promise<T> {
    return ipcRenderer.invoke(IPC_CHANNELS.ECHO, value) as Promise<T>
  },
  journalAppend(input: unknown): Promise<{ ok: true }> {
    return ipcRenderer.invoke(IPC_CHANNELS.JOURNAL_APPEND, input) as Promise<{ ok: true }>
  },
  onTick(cb: TickListener): () => void {
    // SECURITY: closure-wrap the listener so the renderer never sees the
    // raw IpcRendererEvent (which exposes `sender`). Return a disposer.
    const handler = (_event: Electron.IpcRendererEvent, n: unknown): void => {
      if (typeof n === 'number') cb(n)
    }
    ipcRenderer.on(PUSH_CHANNELS.TICK, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.TICK, handler)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ApiSurface = typeof api
