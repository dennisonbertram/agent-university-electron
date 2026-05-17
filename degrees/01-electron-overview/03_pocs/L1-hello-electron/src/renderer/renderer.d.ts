/**
 * Renderer-side type declaration for the contextBridge-exposed window.api.
 * The actual exposure lives in src/preload.ts (GREEN commit).
 */

export interface RendererApi {
  /** Called by renderer on DOMContentLoaded; fire-and-forget IPC into main. */
  rendererReady(userAgent: string): void
  /** Round-trip; returns { pong: true, ts: number } from main. */
  ping(): Promise<{ pong: true; ts: number }>
  /** Returns the absolute path to the structured JSON-lines log file. */
  logPath(): Promise<string>
}

declare global {
  interface Window {
    api: RendererApi
  }
}

export {}
