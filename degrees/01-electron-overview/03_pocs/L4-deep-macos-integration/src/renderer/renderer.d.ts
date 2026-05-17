/**
 * Ambient typing for the contextBridge-exposed window.api at L4.
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

type TrayStateName = 'idle' | 'focused' | 'break' | 'paused'

interface TrayStateView {
  readonly state: TrayStateName
  readonly title: string
  readonly hasImage: boolean
}

interface NotificationShowArgs {
  readonly title: string
  readonly body: string
  readonly actions?: ReadonlyArray<{ readonly type: 'button'; readonly text: string }>
  readonly hasReply?: boolean
  readonly replyPlaceholder?: string
}

interface NotificationShowResult {
  readonly ok: boolean
  readonly id: string
  readonly failed?: { readonly error: string }
}

interface ThemeSnapshot {
  readonly source: 'system' | 'light' | 'dark'
  readonly isDark: boolean
}

interface AutoLaunchSettings {
  readonly openAtLogin: boolean
  readonly status?: string
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
  // L4
  traySetState(args: unknown): Promise<{ ok: true; view: TrayStateView }>
  appGetTrayState(): Promise<TrayStateView>
  notificationShow(args: unknown): Promise<NotificationShowResult>
  appSetAutoLaunch(args: unknown): Promise<{ requested: boolean; observed: boolean }>
  appGetAutoLaunch(): Promise<AutoLaunchSettings>
  appSetTheme(args: unknown): Promise<ThemeSnapshot>
  appGetTheme(): Promise<ThemeSnapshot>
  dockSetBadge(args: unknown): Promise<{ ok: boolean; badge: string }>
  appAddRecent(args: unknown): Promise<{ ok: boolean }>
  testFireShortcut(args: unknown): Promise<{ ok: boolean; fired: boolean }>
  testEmitPower(args: unknown): Promise<{ ok: boolean }>
  testTriggerWillQuit(): Promise<{ ok: boolean }>
  testEmitOpenUrl(args: unknown): Promise<{ ok: boolean }>
  testEmitSecondInstance(args: unknown): Promise<{ ok: boolean }>
  onTick(cb: (n: number) => void): () => void
  onFileChanged(cb: (event: FileChangedEvent) => void): () => void
  onShortcutFired(cb: (payload: { accelerator: string }) => void): () => void
  onOpenUrl(cb: (payload: { url: string; origin: 'open-url' | 'second-instance' }) => void): () => void
  onThemeChanged(cb: (payload: ThemeSnapshot) => void): () => void
  onNotificationFailed(cb: (payload: { id: string; error: string }) => void): () => void
}

interface Window {
  readonly api: RendererApi
}
