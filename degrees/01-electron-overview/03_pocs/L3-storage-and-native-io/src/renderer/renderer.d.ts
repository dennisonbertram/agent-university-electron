/**
 * Ambient typing for the contextBridge-exposed window.api at L3.
 * Listed in tsconfig.json "files" so the augmentation is included.
 */

interface JournalEntry {
  readonly id: string
  readonly ts: string
  readonly text: string
}

interface DialogOpenArgs {
  readonly defaultPath?: string
  readonly filters?: ReadonlyArray<{ readonly name: string; readonly extensions: readonly string[] }>
  readonly properties?: ReadonlyArray<string>
}

interface DialogOpenResult {
  readonly canceled: boolean
  readonly filePaths: readonly string[]
}

interface DialogSaveArgs {
  readonly defaultPath?: string
  readonly filters?: ReadonlyArray<{ readonly name: string; readonly extensions: readonly string[] }>
}

interface DialogSaveResult {
  readonly canceled: boolean
  readonly filePath: string | null
}

interface MenuTreeNode {
  readonly label: string
  readonly id?: string
  readonly role?: string
  readonly accelerator?: string
  readonly type?: string
  readonly submenu?: readonly MenuTreeNode[]
}

interface FileChangedEvent {
  readonly kind: 'rename' | 'add' | 'change' | 'unlink'
  readonly path?: string
  readonly oldPath?: string
  readonly newPath?: string
}

interface RendererApi {
  ping(): Promise<{ pong: true; ts: number; monotonic: number }>
  echo<T>(value: T): Promise<T>
  journalAppend(input: unknown): Promise<{ ok: true; entry: JournalEntry }>
  journalList(): Promise<readonly JournalEntry[]>
  dialogOpen(args: unknown): Promise<DialogOpenResult>
  dialogSave(args: unknown): Promise<DialogSaveResult>
  filesDropped(paths: unknown): Promise<{ ok: true; count: number }>
  getApplicationMenu(): Promise<readonly MenuTreeNode[]>
  getPathForFile(file: File): string
  onTick(cb: (n: number) => void): () => void
  onFileChanged(cb: (event: FileChangedEvent) => void): () => void
}

interface Window {
  readonly api: RendererApi
}
