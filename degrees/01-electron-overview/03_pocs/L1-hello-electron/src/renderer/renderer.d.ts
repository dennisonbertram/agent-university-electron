/**
 * Ambient type declaration for the contextBridge-exposed window.api.
 * The actual surface is wired in src/preload.ts.
 *
 * This file is intentionally a SCRIPT (no top-level import/export) so the
 * `interface Window` augmentation merges with the global DOM Window type
 * without needing `declare global`.
 */

interface RendererApi {
  /** Fire-and-forget: tell main the renderer has loaded. */
  rendererReady(userAgent: string): void
  /** Request/response: returns { pong: true, ts: number } from main. */
  ping(): Promise<{ pong: true; ts: number }>
  /** Returns the absolute path to the structured log file. */
  logPath(): Promise<string>
}

interface Window {
  readonly api: RendererApi
}
