# Recipe — Tray with Template Image

**Use when**: Creating a macOS menu-bar tray icon.

## Code

```typescript
// src/tray.ts
import { Tray, nativeImage, Menu, app } from 'electron'
import path from 'node:path'

// CRITICAL: module-scope, NOT function-local — GC will collect a function-local Tray
let trayInstance: Tray | null = null
let currentState: 'idle' | 'active' | 'paused' = 'idle'

export type TrayState = 'idle' | 'active' | 'paused'
export interface TrayController {
  setState(state: TrayState): void
  getState(): TrayState
  destroy(): void
}

function templateImagePath(state: TrayState): string {
  // macOS template images: filename must end in 'Template'
  // Bundler must NOT hash/rename this file
  const assetsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '..', 'assets')
  return path.join(assetsDir, `tray-${state}-Template.png`)
}

export function installTray(opts: { logger: Logger }): TrayController {
  const { logger } = opts
  const icon = nativeImage.createFromPath(templateImagePath('idle'))
  trayInstance = new Tray(icon)
  trayInstance.setToolTip('My App')

  const menu = Menu.buildFromTemplate([
    { label: 'Show', click: () => { /* show window */ } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
  trayInstance.setContextMenu(menu)

  logger.info('tray:installed', { state: 'idle' })

  return {
    setState(next: TrayState) {
      currentState = next
      if (trayInstance) {
        const icon = nativeImage.createFromPath(templateImagePath(next))
        trayInstance.setImage(icon)
        logger.info('tray:state-changed', { state: next })
      }
    },
    getState: () => currentState,
    destroy() {
      trayInstance?.destroy()
      trayInstance = null
    },
  }
}
```

## Asset Setup

Name your tray icons:
```
assets/
  tray-idle-Template.png       (22x22 px, macOS menu bar size)
  tray-idle-Template@2x.png    (44x44 px, retina)
  tray-active-Template.png
  tray-active-Template@2x.png
```

The `Template` suffix tells macOS to invert the image for dark/light mode. Without it, the icon won't adapt to the system theme.

## Test Pattern

```typescript
it('R-tray-01: tray.ts has module-scope trayInstance', () => {
  const src = readFileSync('src/tray.ts', 'utf8')
  expect(src).toMatch(/^let trayInstance/m)
})
```

## Watch Out For

- If you assign `const tray = new Tray(...)` inside a function, V8 GC collects it when the function returns (within seconds). The icon disappears silently.
- Template images: filename must end in exactly `Template` (capital T). `tray-idletemplate.png` does NOT work.
- In packaged builds, `__dirname` is inside `app.asar`. Asset files must be in `app.asar.unpacked` or use `process.resourcesPath`. Adjust the path logic accordingly.
- On Linux, some desktop environments don't render tray icons at all. Check for `tray:installed` log marker but don't assert on visual appearance.

Evidence: `../../05_distillation/patterns/P-05-module-scoped-tray-instance.md`, `../../05_distillation/gotchas/G-06-tray-icon-disappears-when-not-retained.md`
