# G-17 — `globalShortcut.register` returns false silently when accelerator is taken

**Severity**: medium
**Surface**: Global shortcuts
**Discovered in**: Research review (`01_research/21-failure-modes.md#FM-10`)

## Symptom

You call `globalShortcut.register('CmdOrCtrl+Shift+P', handler)`. The handler never fires when you press the keys. No error is thrown. Inspecting `globalShortcut.isRegistered('CmdOrCtrl+Shift+P')` returns `false` (the OS holds the shortcut, not you).

## Root cause

Another application — or the system itself — has already claimed `Cmd+Shift+P`. Electron cannot pre-empt OS-level shortcuts; `register()` returns `false` to indicate failure. The return value is non-obvious and many implementations ignore it.

## Fix

Always check the return value, log the failure, and either fall back to a different accelerator or surface UI for the user to rebind:

```typescript
import { globalShortcut } from 'electron'

const registered = globalShortcut.register('CmdOrCtrl+Shift+P', () => {
  logger.info('shortcut:CmdOrCtrl+Shift+P:fired', {})
  toggleFocusMode()
})

if (registered) {
  logger.info('shortcut:registered', { accelerator: 'CmdOrCtrl+Shift+P' })
} else {
  logger.warn('shortcut:register:failed', {
    accelerator: 'CmdOrCtrl+Shift+P',
    reason: 'OS may hold the accelerator',
  })
  // fallback: prompt user, or try a different accelerator
}
```

## Test that catches a regression

`tests/unit/shortcuts.test.ts` (L4) — mocks `globalShortcut.register` to return `false` and asserts the `shortcut:register:failed` log marker fires.

## Evidence

- `01_research/21-failure-modes.md#FM-10`
- `01_research/09-global-shortcuts.md`
- `03_pocs/L-capstone-pulse/src/shortcuts.ts:38-60`
