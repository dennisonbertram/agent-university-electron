/**
 * Playwright helpers for the Pulse capstone.
 *
 * Carries forward L5's helpers; renames product to `Pulse`.
 */
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, existsSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import http from 'node:http'

export const POC_ROOT = path.resolve(__dirname, '..', '..')
export const MAIN_ENTRY = path.join(POC_ROOT, 'dist', 'main.js')
export const FIXTURES_DIR = path.join(POC_ROOT, 'scripts', 'fixtures')
export const PRODUCT_NAME = 'Pulse'

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
  const logDir = mkdtempSync(path.join(tmpdir(), 'pulse-e2e-logs-'))
  const logFile = path.join(logDir, 'main.log')
  const userDataDir = options.userDataDir ?? mkdtempSync(path.join(tmpdir(), 'pulse-e2e-userdata-'))
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    LOG_DIR: logDir,
    USER_DATA_DIR: userDataDir,
    NODE_ENV: 'test',
    PULSE_TEST_HOOKS: '1',
    L5_TEST_HOOKS: '1',
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
    .map((line) => {
      try {
        return JSON.parse(line) as LogLine
      } catch {
        return null
      }
    })
    .filter((l): l is LogLine => l !== null)
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
      `Saw ${lastSeen.length} entries; last 25: ${lastSeen.map((l) => l.event).slice(-25).join(', ')}`,
  )
}

export async function waitForLogContaining(
  file: string,
  predicate: (line: LogLine) => boolean,
  timeoutMs = 15_000,
): Promise<LogLine> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const lines = readLogLines(file)
    const hit = lines.find(predicate)
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for log predicate`)
}

// ---- packaging ----

export interface PackagedBundle {
  appDir: string
  contentsDir: string
  infoPlistPath: string
  macOSExePath: string
  resourcesDir: string
}

export function expectedPackagedBundle(): PackagedBundle {
  const platform = process.platform
  const arch = process.arch
  const dir = path.join(POC_ROOT, 'out', `${PRODUCT_NAME}-${platform}-${arch}`)
  const appDir = path.join(dir, `${PRODUCT_NAME}.app`)
  const contentsDir = path.join(appDir, 'Contents')
  const infoPlistPath = path.join(contentsDir, 'Info.plist')
  const macOSExePath = path.join(contentsDir, 'MacOS', PRODUCT_NAME)
  const resourcesDir = path.join(contentsDir, 'Resources')
  return { appDir, contentsDir, infoPlistPath, macOSExePath, resourcesDir }
}

let packageMemo: Promise<PackagedBundle> | null = null

export function runPackage(): Promise<PackagedBundle> {
  if (packageMemo) return packageMemo
  packageMemo = (async (): Promise<PackagedBundle> => {
    const expected = expectedPackagedBundle()
    if (existsSync(expected.appDir) && existsSync(expected.macOSExePath)) {
      return expected
    }
    await spawnNpmScript('package', 480_000)
    return expected
  })()
  return packageMemo
}

function spawnNpmScript(script: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', script], {
      cwd: POC_ROOT,
      env: {
        ...process.env,
        APPLE_ID: '',
        APPLE_PASSWORD: '',
        APPLE_TEAM_ID: '',
        APPLE_APP_SPECIFIC_PASSWORD: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (b) => { stdout += b.toString() })
    proc.stderr.on('data', (b) => { stderr += b.toString() })
    const t = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error(`npm run ${script}: timeout after ${timeoutMs}ms\nSTDOUT:\n${stdout.slice(-4000)}\nSTDERR:\n${stderr.slice(-4000)}`))
    }, timeoutMs)
    proc.on('close', (code) => {
      clearTimeout(t)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`npm run ${script}: exit ${code}\nSTDOUT:\n${stdout.slice(-4000)}\nSTDERR:\n${stderr.slice(-4000)}`))
      }
    })
  })
}

// ---- launch packaged app ----

export interface PackagedAppRun {
  proc: ChildProcess
  logFile: string
  stop: () => void
}

export async function launchPackagedApp(bundle: PackagedBundle, opts: {
  envOverrides?: Record<string, string>
} = {}): Promise<PackagedAppRun> {
  const tmpLogDir = mkdtempSync(path.join(tmpdir(), 'pulse-pkg-logs-'))
  const tmpUserData = mkdtempSync(path.join(tmpdir(), 'pulse-pkg-userdata-'))
  const env: Record<string, string> = {
    ...process.env,
    LOG_DIR: tmpLogDir,
    USER_DATA_DIR: tmpUserData,
    NODE_ENV: 'test',
    PULSE_TEST_HOOKS: '1',
    L5_TEST_HOOKS: '1',
    L4_TEST_HOOKS: '1',
    ...(opts.envOverrides ?? {}),
  } as Record<string, string>
  const proc = spawn(bundle.macOSExePath, [], { env, stdio: 'ignore', detached: false })
  return {
    proc,
    logFile: path.join(tmpLogDir, 'main.log'),
    stop: () => { try { proc.kill('SIGTERM') } catch { /* ignore */ } },
  }
}

// ---- local update server ----

export interface UpdateServerHandle {
  port: number
  url: string
  close: () => Promise<void>
}

export interface StartUpdateServerOptions {
  manifestFile: 'latest-mac.yml.update' | 'latest-mac.yml.current'
  port?: number
}

export function startUpdateServer(opts: StartUpdateServerOptions): Promise<UpdateServerHandle> {
  const manifestPath = path.join(FIXTURES_DIR, opts.manifestFile)
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) { res.statusCode = 404; res.end(); return }
      const pathOnly = req.url.split('?')[0] ?? req.url
      if (pathOnly.endsWith('/latest-mac.yml')) {
        try {
          const body = readFileSync(manifestPath, 'utf8')
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/x-yaml')
          res.setHeader('Content-Length', Buffer.byteLength(body))
          res.end(body)
          return
        } catch (err) {
          res.statusCode = 500
          res.end((err as Error).message)
          return
        }
      }
      if (pathOnly.endsWith('.zip')) {
        const fakePath = pathOnly.split('/').pop() ?? 'fake.zip'
        const fakeArtifactPath = path.join(FIXTURES_DIR, fakePath)
        if (existsSync(fakeArtifactPath)) {
          const stat = statSync(fakeArtifactPath)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/zip')
          res.setHeader('Content-Length', stat.size)
          res.end(readFileSync(fakeArtifactPath))
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/zip')
        res.end(Buffer.from('PK' + ' '.repeat(18)))
        return
      }
      res.statusCode = 404
      res.end()
    })
    server.on('error', reject)
    server.listen(opts.port ?? 0, '127.0.0.1', () => {
      const addr = server.address()
      if (typeof addr !== 'object' || addr === null) {
        server.close()
        reject(new Error('update server failed to bind'))
        return
      }
      const port = addr.port
      resolve({
        port,
        url: `http://127.0.0.1:${port}/updates`,
        close: () => new Promise<void>((r) => { server.close(() => r()) }),
      })
    })
  })
}

// ---- IPC wrappers ----

export async function callApi<T>(win: Page, method: string, arg?: unknown): Promise<T> {
  return (await win.evaluate(
    async ({ m, a }) => {
      const api = (window as unknown as { api: Record<string, (a?: unknown) => Promise<unknown>> }).api
      return await api[m]!(a)
    },
    { m: method, a: arg },
  )) as T
}
