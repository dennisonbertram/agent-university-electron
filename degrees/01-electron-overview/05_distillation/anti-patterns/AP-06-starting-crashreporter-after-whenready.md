# AP-06 — Starting `crashReporter` AFTER `app.whenReady()`

**Severity**: high (renderer crashes silently lost)
**Surface**: crashReporter lifecycle.

## What this looks like

```typescript
// WRONG
app.whenReady().then(() => {
  createMainWindow()                       // renderer spawned BEFORE start
  crashReporter.start({ submitURL: '...' }) // too late
})
```

## Why this is wrong

- `crashReporter.start()` instruments renderers AT SPAWN TIME. Renderers created before `start()` runs are NOT monitored, even after `start()` completes.
- A crash in those pre-start renderers produces no minidump, no upload, no telemetry. You learn about the crash from user complaints, not from your dashboard.
- This is FM-12 in the failure-modes research (`01_research/21-failure-modes.md#FM-12`).

## Better approach

Call `crashReporter.start()` at module-load scope, BEFORE `app.whenReady()` (see P-13 for the full pattern):

```typescript
// src/main.ts — module-load scope
let crashReporterService: CrashReporterService | null = null
try {
  crashReporterService = startCrashReporter({
    logger: crashBootLogger,
    submitURL: process.env.CRASH_URL,
    productName: 'Pulse',
  })
} catch (err) { /* fall back, but DON'T defer */ }

// THEN — and only then — wait for whenReady
app.whenReady().then(() => {
  const win = createMainWindow()
})
```

## Test / lint that catches it

Static-source ordering check (R-L5-1): assert the byte offset of `crashReporter.start(` is less than the byte offset of `app.whenReady(`.

```typescript
test('R-L5-1: crashReporter.start before whenReady', () => {
  const src = readFileSync('src/main.ts', 'utf8')
  const startIdx = src.indexOf('crashReporter.start(')
  const readyIdx = src.indexOf('app.whenReady(')
  expect(startIdx).toBeGreaterThan(-1)
  expect(readyIdx).toBeGreaterThan(-1)
  expect(startIdx).toBeLessThan(readyIdx)
})
```

## Evidence

- `01_research/21-failure-modes.md#FM-12`
- `01_research/19-crash-reporting-and-observability.md` lines 41-45
- `03_pocs/L5-packaging-signing-update/poc-report.md` R-L5-1
- `03_pocs/L-capstone-pulse/src/main.ts:30-51`
