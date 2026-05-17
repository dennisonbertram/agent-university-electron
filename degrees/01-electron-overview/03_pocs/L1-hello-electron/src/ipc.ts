/**
 * IPC channel name constants.
 * Stable across main/preload/renderer. Documented in README "IPC Surface" table.
 */

export const IPC_CHANNELS = {
  /** Renderer → main, fire-and-forget. Renderer announces it has loaded.
   *  Payload: `{ userAgent: string }`. */
  RENDERER_READY: 'renderer:ready',
  /** Renderer → main, request/response. Used to assert main is alive.
   *  Resolves to `{ pong: true, ts: number }`. */
  APP_PING: 'app:ping',
  /** Renderer → main, request/response. Returns the absolute path to
   *  the structured JSON-lines log file. */
  LOG_PATH: 'log:path',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
