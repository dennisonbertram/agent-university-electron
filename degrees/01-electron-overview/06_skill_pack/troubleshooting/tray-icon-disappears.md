# Troubleshooting — Tray Icon Disappears

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Symptom

The tray icon appears briefly in the macOS menu bar then disappears within a few seconds of launch. No error is logged. The app may continue running (visible in Activity Monitor) but the tray is gone.

---

## Root Cause

V8 garbage collector collects the `Tray` object because no live reference points to it from a GC root.

This is the most common Electron gotcha for menu-bar apps. It appears to be a timing issue (the icon shows while JS runs, disappears when GC next runs) but it is deterministic: function-local variables are collected when the containing function returns.

---

## Cause → Diagnostic → Fix

### Cause 1: Tray created inside a function, stored in a local variable

```typescript
// WRONG — function-local variable is GC'd when createTray() returns
function createTray() {
  const tray = new Tray('/path/to/icon.png')
  tray.setContextMenu(menu)
  // tray goes out of scope here; V8 collects it
}
```

**Diagnostic**

```bash
grep -n 'new Tray(' src/tray.ts
grep -n '^let tray\|^const tray\|^var tray' src/tray.ts
```

If `new Tray(` is inside a function and there is no module-scope variable, you have this bug.

**Fix**

```typescript
// CORRECT — module-scope variable keeps Tray alive
let trayInstance: Tray | null = null

export function installTray(): void {
  const iconPath = templateImagePath('tray-icon')
  trayInstance = new Tray(iconPath)
  trayInstance.setContextMenu(buildMenu())
  trayInstance.setToolTip('My App')
}

export function destroyTray(): void {
  trayInstance?.destroy()
  trayInstance = null
}
```

The `let trayInstance` at module scope is the GC root. As long as the module is loaded, V8 cannot collect the instance.

---

### Cause 2: Module is re-evaluated or not imported

If the module containing `trayInstance` is not imported from `main.ts`, the module-scope variable never exists.

**Diagnostic**

```bash
grep -n 'import.*tray\|require.*tray' src/main.ts
```

**Fix**

```typescript
// src/main.ts
import { installTray } from './tray'

app.whenReady().then(() => {
  installTray()
})
```

---

### Cause 3: Wrong image path (packaged vs. unpackaged)

If the `Tray` constructor receives a non-existent path, it throws, trayInstance stays null, and the icon never appears (or flickers then errors).

**Diagnostic**

```bash
# Run app, check log for tray:created event or any error at tray init
tail -f ~/Library/Logs/<your-app>/main.log | grep tray
```

**Fix**

The icon path must branch on `app.isPackaged`:

```typescript
function templateImagePath(name: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', `${name}-Template.png`)
  }
  return path.join(__dirname, '..', 'assets', `${name}-Template.png`)
}
```

Verify the asset exists at both paths:
```bash
ls assets/tray-icon-Template.png      # dev path
ls <App>.app/Contents/Resources/assets/tray-icon-Template.png  # packaged path
```

---

### Cause 4: Bundler hashes or renames asset files

If your bundler renames `tray-icon-Template.png` to `tray-icon-abc123-Template.png` or `abc123.png`, the template suffix may be destroyed or the path is simply wrong.

**Diagnostic**

```bash
ls dist/assets/   # or wherever your bundler outputs assets
# Look for the exact filename you're referencing
```

**Fix**

Configure your bundler to preserve asset filenames. With esbuild:
```bash
# Use --asset-names to control output name
npx esbuild src/main.ts --asset-names=[name] --loader:.png=file
```

Alternatively, place tray assets outside the bundler's asset pipeline and reference them via `process.resourcesPath` directly.

---

### Cause 5: Template suffix missing from image file name

On macOS, tray images should end in `Template` (e.g., `icon-Template.png`). Without this suffix, the image may not adapt to light/dark mode and may render incorrectly, but this doesn't cause disappearance.

However, if your code explicitly looks for the `Template` suffix and the file has a different name, you get a path-not-found error.

**Fix**

Name the file `myapp-Template.png` (or `myapp-Template@2x.png` for retina). Reference it by exact name.

---

## Static Regression Test

Add this to your test suite:

```typescript
test('R-tray-01: trayInstance declared at module scope', () => {
  const src = fs.readFileSync('src/tray.ts', 'utf-8')
  const lines = src.split('\n')
  const trayLine = lines.findIndex(l => /^let trayInstance/.test(l))
  expect(trayLine, 'trayInstance must be at module scope (first non-import line)').toBeGreaterThan(-1)
  expect(trayLine).toBeLessThan(20)
})
```

---

## Related

- [../lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md) — Tray section
- [../recipes/recipe-tray-with-template-image.md](../recipes/recipe-tray-with-template-image.md) — complete tray implementation
- [../labs/lab-04-tray-with-state.md](../labs/lab-04-tray-with-state.md) — hands-on exercise
- [../checklists/deep-macos-integration-checklist.md](../checklists/deep-macos-integration-checklist.md) — items 5–8

Evidence: `../../../05_distillation/playbooks/PB-05-tray-icon-disappears.md`, `../../../05_distillation/patterns/P-05-module-scoped-tray-instance.md`
