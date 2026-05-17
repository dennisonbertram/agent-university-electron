# Recipe — Secure BrowserWindow Factory

**Use when**: Creating any BrowserWindow in an Electron app.

## Code

```typescript
// src/window.ts
import { BrowserWindow } from 'electron'
import path from 'node:path'

export const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
} as const

export function createMainWindow(opts: { width?: number; height?: number } = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: opts.width ?? 1024,
    height: opts.height ?? 768,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  void win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  return win
}
```

## Test Pattern

```typescript
it('R-win-01: SECURE_WEB_PREFERENCES has all four flags', () => {
  const src = readFileSync('src/window.ts', 'utf8')
  expect(src).toMatch(/contextIsolation:\s*true/)
  expect(src).toMatch(/sandbox:\s*true/)
  expect(src).toMatch(/nodeIntegration:\s*false/)
  expect(src).toMatch(/webSecurity:\s*true/)
})
it('R-win-02: no new BrowserWindow outside window.ts', () => {
  const main = readFileSync('src/main.ts', 'utf8')
  expect(main).not.toMatch(/new BrowserWindow\(/)
})
```

## Watch Out For

- Do NOT pass any flag from `SECURE_WEB_PREFERENCES` with a value that weakens it elsewhere in `webPreferences` — the spread only provides defaults; a subsequent key overrides it.
- `preload` path must be the compiled `.js`, not the `.ts` source.
- `__dirname` in the factory refers to the compiled output directory (`dist/`), not the project root. This is correct — it's where `preload.js` lives.

Evidence: `../../05_distillation/patterns/P-01-secure-browserwindow-defaults.md`
