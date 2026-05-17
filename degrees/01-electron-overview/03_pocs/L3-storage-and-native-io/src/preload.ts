/**
 * Preload — exposes `window.api` to the renderer via contextBridge.
 *
 * Carried forward from L2 (Decision 5 — esbuild bundle). New at L3:
 *
 *   - `getPathForFile(file)` — modern replacement for the removed `File.path`
 *     property. Calls `webUtils.getPathForFile(file)` from the sandbox-allowed
 *     `webUtils` module (per REF-03 / Electron 32; see also expectation-gap
 *     Entry 1 for the sandbox preload whitelist). This is the load-bearing
 *     drag-and-drop primitive — see R-L3-3.
 *
 *   - `journalAppend`, `journalList`, `dialogOpen`, `dialogSave`,
 *     `filesDropped`, `getApplicationMenu` — invoke wrappers.
 *
 *   - `onFileChanged` — main → renderer push channel for the file watcher.
 *
 * Typed-error pattern unchanged from L2 (Decision 6): IpcValidationError is
 * encoded via the `__IPCVE__:` sentinel and reconstructed on the renderer side.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS, PUSH_CHANNELS, IPC_VALIDATION_ERROR_PREFIX } from './ipc'

type TickListener = (n: number) => void
type FileChangedListener = (event: {
  kind: 'rename' | 'add' | 'change' | 'unlink'
  path?: string
  oldPath?: string
  newPath?: string
}) => void

async function rethrowingInvoke<T>(channel: string, arg?: unknown): Promise<T> {
  try {
    const result = await ipcRenderer.invoke(channel, arg)
    return result as T
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const sentinelIdx = message.indexOf(IPC_VALIDATION_ERROR_PREFIX)
    if (sentinelIdx >= 0) {
      const real = message.slice(sentinelIdx + IPC_VALIDATION_ERROR_PREFIX.length)
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
  journalAppend(input: unknown): Promise<{
    ok: true
    entry: { id: string; ts: string; text: string }
  }> {
    return rethrowingInvoke(IPC_CHANNELS.JOURNAL_APPEND, input)
  },
  journalList(): Promise<ReadonlyArray<{ id: string; ts: string; text: string }>> {
    return rethrowingInvoke(IPC_CHANNELS.JOURNAL_LIST)
  },
  dialogOpen(args?: unknown): Promise<{ canceled: boolean; filePaths: readonly string[] }> {
    return rethrowingInvoke(IPC_CHANNELS.DIALOG_OPEN, args ?? {})
  },
  dialogSave(args?: unknown): Promise<{ canceled: boolean; filePath: string | null }> {
    return rethrowingInvoke(IPC_CHANNELS.DIALOG_SAVE, args ?? {})
  },
  filesDropped(paths: unknown): Promise<{ ok: true; count: number }> {
    return rethrowingInvoke(IPC_CHANNELS.FILES_DROPPED, paths)
  },
  getApplicationMenu(): Promise<ReadonlyArray<unknown>> {
    return rethrowingInvoke(IPC_CHANNELS.APP_GET_MENU)
  },
  /**
   * Returns the absolute filesystem path for a File coming from a drag-drop
   * event. Uses Electron's `webUtils.getPathForFile` (REF-03) — the modern
   * replacement for the `File.path` property removed in Electron 32.
   *
   * R-L3-3 asserts this method exists on the contextBridge surface.
   */
  getPathForFile(file: File): string {
    return webUtils.getPathForFile(file)
  },
  onTick(cb: TickListener): () => void {
    const handler = (_event: Electron.IpcRendererEvent, n: unknown): void => {
      if (typeof n === 'number') cb(n)
    }
    ipcRenderer.on(PUSH_CHANNELS.TICK, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.TICK, handler)
  },
  onFileChanged(cb: FileChangedListener): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      if (typeof payload === 'object' && payload !== null) {
        cb(payload as Parameters<FileChangedListener>[0])
      }
    }
    ipcRenderer.on(PUSH_CHANNELS.FILE_CHANGED, handler)
    return () => ipcRenderer.removeListener(PUSH_CHANNELS.FILE_CHANGED, handler)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ApiSurface = typeof api
