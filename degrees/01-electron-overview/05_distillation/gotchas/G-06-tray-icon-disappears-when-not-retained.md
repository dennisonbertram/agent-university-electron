# G-06 — Tray icon disappears within seconds when not retained

**Severity**: high
**Surface**: Tray
**Discovered in**: research review + L4 / capstone designed to avoid (`01_research/21-failure-modes.md#FM-04`)

## Symptom

Tray icon appears at app launch, then vanishes within ~5 seconds. No error, no log. Subsequent `tray.setTitle(...)` calls succeed silently but nothing renders.

## Root cause

The `Tray` instance was assigned to a function-local `const tray = new Tray(...)`. When the constructor function returns, V8 garbage-collects the binding. The native tray view is released and disappears. There is no error because the underlying API call itself succeeded; the loss is post-GC.

## Fix

Hold the Tray in a module-scope `let`:

```typescript
// src/tray.ts
import { Tray, nativeImage } from 'electron'

// CRITICAL: module-scope, not local. R-L4-1 asserts the literal `let trayInstance`.
let trayInstance: Tray | null = null

export function installTray(opts: InstallTrayOptions): TrayController {
  const image = templateImage()
  trayInstance = new Tray(image)
  // ...
}
```

Static regression-check: grep for `let trayInstance` (or equivalent module-scope binding) in `src/tray.ts`. If a future refactor moves it inside a function, the grep fails.

## Test that catches a regression

`tests/e2e/regression.spec.ts > R-L4-1` (L4) — static-source check for `let trayInstance` in `src/tray.ts`.

## Evidence

- `01_research/21-failure-modes.md#FM-04` lines 78-104
- `01_research/07-tray-and-menus.md` lines 10-26
- `03_pocs/L4-deep-macos-integration/src/tray.ts:27`
- `03_pocs/L4-deep-macos-integration/poc-report.md` §"What the regression tests buy" R-L4-1
