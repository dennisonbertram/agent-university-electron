/**
 * crashReporter wrapper (RED stub).
 *
 * CRITICAL ORDERING (R-L5-1): `crashReporter.start()` MUST be called BEFORE
 * `app.whenReady()`. The static-source regression test reads `src/main.ts`
 * and asserts that the import + invocation of `startCrashReporter()` appears
 * above the `app.whenReady()` call.
 *
 * The real (GREEN) implementation will:
 *   - Resolve `submitURL` from `process.env.CRASH_URL`, falling back to
 *     `http://127.0.0.1:8766/crashes` (the test sink default).
 *   - Pass `uploadToServer: true` only when `submitURL` is set; otherwise
 *     run with `uploadToServer: false` (Electron 13+ requirement).
 *   - Log `crash-reporter:started` with the resolved submitURL.
 *   - Record `startedBeforeWhenReady = true` only if the start call ran
 *     before `app.isReady()` returned true.
 *
 * This stub throws so the RED commit observably fails the GREEN behavioral
 * tests (BT-L5-8).
 */
import type { Logger } from './log'
import type { CrashReporterStateSnapshot } from './ipc'

export interface CrashReporterService {
  getState(): CrashReporterStateSnapshot
}

export interface StartCrashReporterOptions {
  readonly logger: Logger
  readonly submitURL?: string | undefined
  readonly productName: string
}

export function startCrashReporter(_opts: StartCrashReporterOptions): CrashReporterService {
  throw new Error(
    'startCrashReporter: not implemented (RED). The GREEN commit replaces this stub with the real crashReporter.start() invocation (must run BEFORE app.whenReady() per R-L5-1).',
  )
}
