/**
 * Preload — exposes `window.api` to the renderer via contextBridge.
 *
 * L2 NOTE on the L1 expectation-gap (Entry 1): under `sandbox: true` preload
 * cannot `require()` arbitrary relative TS files at runtime. L1 inlined the
 * channel string literals as a workaround. L2 instead bundles this file with
 * esbuild into a single dist/preload.js, which lets us import the typed
 * `IPC_CHANNELS`, `PUSH_CHANNELS`, and `IPC_VALIDATION_ERROR_PREFIX` from
 * `./ipc` cleanly. The bundler resolves them at build time;
 * `external: ['electron']` in the esbuild config preserves the runtime
 * `require('electron')` so contextBridge + ipcRenderer still resolve through
 * Electron's sandbox whitelist. Decision logged in
 * 04_logs/decision-log.md Entry 5.
 *
 * Typed-error pattern: errors thrown in `ipcMain.handle` lose their `name`
 * across the IPC boundary (Electron only forwards `message`). For
 * IpcValidationError, main encodes the error name in the message via the
 * `__IPCVE__:` sentinel prefix; we strip that here and reconstruct a typed
 * error whose `name === 'IpcValidationError'`. (BT-L2-5 asserts this.)
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, PUSH_CHANNELS, IPC_VALIDATION_ERROR_PREFIX } from './ipc'

type TickListener = (n: number) => void

/** Re-throw IPC errors with the original error name restored where the main
 *  side encoded one via the validation-error sentinel. */
async function rethrowingInvoke<T>(channel: string, arg?: unknown): Promise<T> {
  try {
    const result = await ipcRenderer.invoke(channel, arg)
    return result as T
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Electron prefixes the message with `Error invoking remote method '<ch>':
    // <type>: <msg>` so we use indexOf rather than startsWith.
    const sentinelIdx = message.indexOf(IPC_VALIDATION_ERROR_PREFIX)
    if (sentinelIdx >= 0) {
      const real = message.slice(sentinelIdx + IPC_VALIDATION_ERROR_PREFIX.length)
      // contextBridge serializes Error instances by extracting only `message`
      // (the renderer always sees `.name === 'Error'` on a thrown Error), so
      // we throw a plain object with explicit `name` + `message` fields.
      // The renderer's caller does `catch (err)` and reads `err.name` —
      // which is exactly what BT-L2-5 asserts.
      throw { name: 'IpcValidationError', message: real }
    }
    throw err
  }
}

const api = {
  ping(): Promise<{ pong: true; ts: number; monotonic: number }> {
    return rethrowingInvoke(IPC_CHANNELS.PING)
  },
  echo<T>(value: T): Promise<T> {
    return rethrowingInvoke<T>(IPC_CHANNELS.ECHO, value)
  },
  journalAppend(input: unknown): Promise<{ ok: true }> {
    return rethrowingInvoke<{ ok: true }>(IPC_CHANNELS.JOURNAL_APPEND, input)
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
