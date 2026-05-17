# AP-04 — Letting Tray be collected via a function-local variable

**Severity**: high (correctness — visible bug)
**Surface**: Tray.

## What this looks like

```typescript
// WRONG
function createTray(): void {
  const tray = new Tray(icon)         // ← local var
  tray.setToolTip('App')
  tray.on('click', () => mainWin.show())
  // function returns; `tray` is now unreferenced; V8 collects it; icon vanishes
}
```

## Why this is wrong

When the constructor returns, no reachable reference holds the `Tray` instance. V8 collects it within seconds. The native tray view is released. The icon disappears with NO error in any log. Subsequent calls to `tray.setTitle(...)` would throw — but there's no `tray` reference for code to call on, so the failure mode is "icon just vanishes".

## Better approach

Hold the Tray in a module-scope `let`:

```typescript
// CORRECT
let trayInstance: Tray | null = null

export function installTray(): TrayController {
  trayInstance = new Tray(icon)
  trayInstance.setToolTip('App')
  trayInstance.on('click', () => mainWin.show())
  return { /* controller methods that read/write trayInstance */ }
}
```

(See P-05 for the full pattern.)

## Test / lint that catches it

Static-source check: grep for `let trayInstance` (or equivalent module-scope binding) in `src/tray.ts`. If a refactor moves the `Tray` constructor into a function-local `const`, the grep fails.

## Evidence

- `01_research/21-failure-modes.md#FM-04`
- `01_research/07-tray-and-menus.md` lines 10-26
- `03_pocs/L4-deep-macos-integration/src/tray.ts:27` (canonical fix)
- `03_pocs/L4-deep-macos-integration/poc-report.md` R-L4-1
