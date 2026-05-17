# P-05 — Module-scoped Tray instance to survive GC

**When to use**: every Electron `Tray` you create.
**Evidence**: L4 (`03_pocs/L4-deep-macos-integration/src/tray.ts:27`), capstone (`03_pocs/L-capstone-pulse/src/tray.ts`).

## Pattern

```typescript
// src/tray.ts
import { Tray, nativeImage } from 'electron'
import type { Logger } from './log'

// CRITICAL: module-scope, not local. R-L4-1 statically asserts this line.
let trayInstance: Tray | null = null
let currentState: TrayState = 'idle'

export function installTray(opts: InstallTrayOptions): TrayController {
  const image = templateImage()
  trayInstance = new Tray(image)
  // ...
  return {
    setState(next) { /* uses trayInstance */ },
    getState() { /* ... */ },
    destroy() {
      if (trayInstance) {
        trayInstance.destroy()
        trayInstance = null
      }
    },
  }
}
```

## Why it works

A function-local `const tray = new Tray(...)` is V8-collected when the function returns. The Tray's native handle is released and the icon disappears within seconds — with NO error. A module-scope `let` outlives the boot path and is reachable from every controller closure.

## Tradeoffs

- Module-scope state is sometimes considered a smell; here it's load-bearing.
- Multi-tray apps (rare on macOS, possible on Windows) need an array at module scope, not a single binding.

## Variants

- **`Map<string, Tray>`** at module scope for multi-tray apps.
- **Class with static field** — same effect, different syntax. Static fields are also module-scope.

## Evidence

- `01_research/21-failure-modes.md#FM-04`
- `03_pocs/L4-deep-macos-integration/src/tray.ts:27`
- `03_pocs/L-capstone-pulse/src/tray.ts:27`
- `03_pocs/L4-deep-macos-integration/poc-report.md` R-L4-1
