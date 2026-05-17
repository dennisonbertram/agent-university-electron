/**
 * Helpers for Playwright `_electron` end-to-end tests.
 *
 * Boot strategy:
 *   - Test creates a fresh temp directory and passes it as LOG_DIR.
 *   - Main process resolves the log file path from LOG_DIR (so tests can read it).
 *   - Test launches the *unpackaged* app via `electron .` from the POC root.
 *
 * See 01_research/20-testing-strategies.md for the Playwright _electron pattern.
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
}

/** Path to the electron binary in our local node_modules. */
function electronBinary(): string {
  // `require('electron')` returns the path to the binary at runtime in Node.
  // We can't `import` it like that under ESM-strict, so use createRequire.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const created = require('node:module').createRequire(__filename)
  return created('electron') as string
}

export async function launchApp(extraEnv: Record<string, string> = {}): Promise<LaunchedApp> {
  const logDir = mkdtempSync(path.join(tmpdir(), 'l1-e2e-'))
  const logFile = path.join(logDir, 'main.log')
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    LOG_DIR: logDir,
    NODE_ENV: 'test',
    ELECTRON_ENABLE_LOGGING: '1',
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    ...extraEnv,
  }
  const app = await electron.launch({
    executablePath: electronBinary(),
    args: [POC_ROOT],
    env,
    cwd: POC_ROOT,
  })
  return { app, logDir, logFile }
}

export function readLogLines(file: string): LogLine[] {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((s) => s.length > 0)
    .map((line) => JSON.parse(line) as LogLine)
}

/**
 * Wait until the log file contains an entry with the given event.
 * Returns the matching entry. Throws on timeout.
 */
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
