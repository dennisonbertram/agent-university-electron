/**
 * Helpers for Playwright `_electron` end-to-end tests at L3.
 *
 * Boot strategy (extending L2):
 *   - Test creates a fresh temp directory and passes it as LOG_DIR.
 *   - Test ALSO sets `ELECTRON_USER_DATA_DIR` and points the app at it via
 *     a separate `USER_DATA_DIR` env var (read in main and applied via
 *     `app.setPath('userData', ...)` before whenReady). This isolates the
 *     journal + watched-folder so tests don't collide on a developer's real
 *     `~/Library/Application Support/Electron/journal.json`.
 *   - DIALOG_STUB / DIALOG_STUB_MODE / DIALOG_STUB_PATH inject the dialog
 *     seam — see src/main.ts.
 *   - JOURNAL_SIMULATE_CRASH=1 enables the storage crash seam used by R-L3-2.
 *
 * Helpers:
 *   - `launchApp` — boot the app with isolated dirs and optional extra env.
 *   - `waitForEvent`, `waitForEvents` — poll the JSON-lines log.
 *   - `journalPath` — path to the journal file inside the launched app's userData.
 *   - `watchedFolderPath` — path to the watcher's root dir inside userData.
 *   - `simulateDrop` — render-side helper that calls `window.api.filesDropped(paths)`
 *     with a fixture path array. We don't dispatch native drag events; the
 *     contractual surface is the IPC channel, and BT-L3-5 documents this seam.
 */
import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

export const POC_ROOT = path.resolve(__dirname, '..', '..')
export const MAIN_ENTRY = path.join(POC_ROOT, 'dist', 'main.js')

export interface LogLine {
  ts: string
  level: 'debug' | 'info' | 'warn' | 'error'
  process: 'main' | 'renderer' | 'preload' | 'utility'
  module: string
  event: string
  payload?: Record<string, unknown>
}

export interface LaunchedApp {
  app: ElectronApplication
  logDir: string
  logFile: string
  userDataDir: string
}

function electronBinary(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const created = require('node:module').createRequire(__filename)
  return created('electron') as string
}

export interface LaunchOptions {
  /** Additional env to layer on top of LOG_DIR / USER_DATA_DIR. */
  extraEnv?: Record<string, string>
  /** Override the userData directory (defaults to a fresh temp dir). */
  userDataDir?: string
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const logDir = mkdtempSync(path.join(tmpdir(), 'l3-e2e-logs-'))
  const logFile = path.join(logDir, 'main.log')
  const userDataDir = options.userDataDir ?? mkdtempSync(path.join(tmpdir(), 'l3-e2e-userdata-'))
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    LOG_DIR: logDir,
    USER_DATA_DIR: userDataDir,
    NODE_ENV: 'test',
    ELECTRON_ENABLE_LOGGING: '1',
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    ...(options.extraEnv ?? {}),
  }
  const app = await electron.launch({
    executablePath: electronBinary(),
    args: [POC_ROOT],
    env,
    cwd: POC_ROOT,
  })
  return { app, logDir, logFile, userDataDir }
}

export function readLogLines(file: string): LogLine[] {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((s) => s.length > 0)
    .map((line) => JSON.parse(line) as LogLine)
}

export function findEvents(file: string, event: string): LogLine[] {
  return readLogLines(file).filter((l) => l.event === event)
}

export async function waitForEvent(
  file: string,
  event: string,
  timeoutMs = 15_000,
): Promise<LogLine> {
  const deadline = Date.now() + timeoutMs
  let lastSeen: LogLine[] = []
  while (Date.now() < deadline) {
    const lines = readLogLines(file)
    lastSeen = lines
    const hit = lines.find((l) => l.event === event)
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for log event "${event}". ` +
      `Saw ${lastSeen.length} entries: ${lastSeen.map((l) => l.event).join(', ')}`,
  )
}

export async function waitForEvents(
  file: string,
  event: string,
  count: number,
  timeoutMs = 15_000,
): Promise<LogLine[]> {
  const deadline = Date.now() + timeoutMs
  let lastMatching: LogLine[] = []
  while (Date.now() < deadline) {
    lastMatching = findEvents(file, event)
    if (lastMatching.length >= count) return lastMatching
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${count} log events "${event}". ` +
      `Saw ${lastMatching.length}.`,
  )
}

export function journalPath(app: LaunchedApp): string {
  return path.join(app.userDataDir, 'journal.json')
}

export function watchedFolderPath(app: LaunchedApp): string {
  return path.join(app.userDataDir, 'watched-folder')
}
