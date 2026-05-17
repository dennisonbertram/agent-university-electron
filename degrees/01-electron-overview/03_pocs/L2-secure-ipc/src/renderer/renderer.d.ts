/**
 * Ambient typing for the contextBridge-exposed window.api at L2.
 * Listed in tsconfig.json "files" so the augmentation is included.
 */

interface RendererApi {
  ping(): Promise<{ pong: true; ts: number; monotonic: number }>
  echo<T>(value: T): Promise<T>
  journalAppend(input: unknown): Promise<{ ok: true }>
  onTick(cb: (n: number) => void): () => void
}

interface Window {
  readonly api: RendererApi
}
