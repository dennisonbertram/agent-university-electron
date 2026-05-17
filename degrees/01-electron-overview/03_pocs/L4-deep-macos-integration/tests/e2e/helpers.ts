/**
 * Helpers for Playwright `_electron` end-to-end tests at L4.
 *
 * Builds on L3's helpers and adds:
 *   - L4_TEST_HOOKS=1 by default (so `test:fire-shortcut` et al. are exposed).
 *   - `simulatePowerEvent`, `simulateDeepLink`, `simulateSecondInstance`,
 *     `simulateWillQuit` — Playwright-driven IPC invocations to the test
 *     seams exposed under `window.api.test*`.
 *   - `getTrayState` — reads the tray view via `app:get-tray-state`.
 *   - `getNotificationFailed` event helper.
 */
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
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
  extraEnv?: Record<string, string>
  userDataDir?: string
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const logDir = mkdtempSync(path.join(tmpdir(), 'l4-e2e-logs-'))
  const logFile = path.join(logDir, 'main.log')
  const userDataDir = options.userDataDir ?? mkdtempSync(path.join(tmpdir(), 'l4-e2e-userdata-'))
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    LOG_DIR: logDir,
    USER_DATA_DIR: userDataDir,
    NODE_ENV: 'test',
    L4_TEST_HOOKS: '1',
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

export type TrayStateView = {
  state: 'idle' | 'focused' | 'break' | 'paused'
  title: string
  hasImage: boolean
}

export async function getTrayState(win: Page): Promise<TrayStateView> {
  return (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { appGetTrayState: () => Promise<{ state: string; title: string; hasImage: boolean }> }
    }).api.appGetTrayState()
  })) as TrayStateView
}

export async function setTrayState(
  win: Page,
  state: TrayStateView['state'],
): Promise<{ ok: boolean; view: TrayStateView }> {
  return (await win.evaluate(async (s) => {
    return await (window as unknown as {
      api: { traySetState: (v: unknown) => Promise<{ ok: boolean; view: { state: string; title: string; hasImage: boolean } }> }
    }).api.traySetState({ state: s })
  }, state)) as { ok: boolean; view: TrayStateView }
}

export async function simulatePowerEvent(
  win: Page,
  event: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen' | 'on-ac' | 'on-battery',
): Promise<void> {
  await win.evaluate(async (e) => {
    await (window as unknown as {
      api: { testEmitPower: (v: unknown) => Promise<unknown> }
    }).api.testEmitPower({ event: e })
  }, event)
}

export async function simulateDeepLink(win: Page, url: string): Promise<void> {
  await win.evaluate(async (u) => {
    await (window as unknown as {
      api: { testEmitOpenUrl: (v: unknown) => Promise<unknown> }
    }).api.testEmitOpenUrl({ url: u })
  }, url)
}

export async function simulateSecondInstance(win: Page, argv: readonly string[]): Promise<void> {
  await win.evaluate(async (args) => {
    await (window as unknown as {
      api: { testEmitSecondInstance: (v: unknown) => Promise<unknown> }
    }).api.testEmitSecondInstance({ argv: args })
  }, [...argv])
}

export async function simulateWillQuit(win: Page): Promise<void> {
  await win.evaluate(async () => {
    await (window as unknown as {
      api: { testTriggerWillQuit: () => Promise<unknown> }
    }).api.testTriggerWillQuit()
  })
}

export async function fireShortcut(win: Page, accelerator: string): Promise<{ ok: boolean; fired: boolean }> {
  return (await win.evaluate(async (a) => {
    return await (window as unknown as {
      api: { testFireShortcut: (v: unknown) => Promise<{ ok: boolean; fired: boolean }> }
    }).api.testFireShortcut({ accelerator: a })
  }, accelerator)) as { ok: boolean; fired: boolean }
}
