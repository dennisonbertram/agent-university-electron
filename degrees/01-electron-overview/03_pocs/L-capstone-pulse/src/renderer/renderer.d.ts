/**
 * Ambient typing for window.api at Pulse.
 */
interface FocusStateView {
  readonly kind: 'idle' | 'focus' | 'break' | 'paused'
  readonly startedAt?: number
  readonly durationMs?: number
  readonly pausedForMs?: number
}

interface JournalListResultOk {
  readonly ok: true
  readonly entries: ReadonlyArray<{ readonly id: number; readonly ts: string; readonly text: string }>
  readonly source: 'touch-id' | 'unlocked'
}
interface JournalListResultFail {
  readonly ok: false
  readonly requiresFallback: true
  readonly reason: 'touch-id-unavailable' | 'touch-id-failed' | 'locked'
}
type JournalListResult = JournalListResultOk | JournalListResultFail

interface JournalUnlockResultOk {
  readonly ok: true
  readonly entries: ReadonlyArray<{ readonly id: number; readonly ts: string; readonly text: string }>
}
interface JournalUnlockResultFail {
  readonly ok: false
  readonly reason: 'invalid-passphrase' | 'passphrase-not-set'
}
type JournalUnlockResult = JournalUnlockResultOk | JournalUnlockResultFail

interface RendererApi {
  ping(): Promise<{ pong: true; ts: number; monotonic: number }>
  echo<T>(value: T): Promise<T>
  traySetState(args: unknown): Promise<unknown>
  appGetTrayState(): Promise<unknown>
  notificationShow(args: unknown): Promise<unknown>
  appSetAutoLaunch(args: unknown): Promise<unknown>
  appGetAutoLaunch(): Promise<unknown>
  appSetTheme(args: unknown): Promise<unknown>
  appGetTheme(): Promise<unknown>
  dockSetBadge(args: unknown): Promise<unknown>
  appAddRecent(args: unknown): Promise<unknown>
  testCheckForUpdates(): Promise<unknown>
  testGetUpdaterState(): Promise<unknown>
  testGetCrashReporterState(): Promise<unknown>
  testFireShortcut(args: unknown): Promise<unknown>
  testEmitPower(args: unknown): Promise<unknown>
  testTriggerWillQuit(): Promise<unknown>
  testEmitOpenUrl(args: unknown): Promise<unknown>
  testEmitSecondInstance(args: unknown): Promise<unknown>
  focusStart(args: { durationMs: number }): Promise<FocusStateView>
  focusStop(): Promise<FocusStateView>
  focusState(): Promise<FocusStateView>
  focusExtend(args: { bonusMs: number }): Promise<FocusStateView>
  journalAppend(args: { text: string }): Promise<{ ok: true; id: number; ts: string; length: number; encrypted: boolean }>
  journalList(): Promise<JournalListResult>
  journalUnlockWithPassphrase(args: { passphrase: string }): Promise<JournalUnlockResult>
  journalSetPassphrase(args: { passphrase: string }): Promise<{ ok: true }>
  testAdvanceClock(args: { toMs: number }): Promise<FocusStateView>
  testTriggerNotificationAction(args: { id: string; actionIndex: number }): Promise<{ ok: boolean; reason?: string }>
  testFireDeepLink(args: { url: string }): Promise<{ ok: boolean }>
  testGetBootSummary(): Promise<{
    tray: boolean; journal: boolean; focus: boolean; biometric: boolean;
    dockHidden: boolean; encryptionAvailable: boolean; journalRowsAtBoot: number
  }>
  onShortcutFired(cb: (payload: { accelerator: string }) => void): () => void
  onOpenUrl(cb: (payload: { url: string; origin: 'open-url' | 'second-instance' }) => void): () => void
  onFocusStateChanged(cb: (payload: FocusStateView) => void): () => void
  onJournalAppended(cb: (payload: unknown) => void): () => void
  onThemeChanged(cb: (payload: unknown) => void): () => void
  onNotificationFailed(cb: (payload: { id: string; error: string }) => void): () => void
}

interface Window {
  readonly api: RendererApi
}
