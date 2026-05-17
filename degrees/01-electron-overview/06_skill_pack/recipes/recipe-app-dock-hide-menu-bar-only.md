# Recipe — Hide Dock Icon (Menu-Bar-Only App)

**Use when**: Building a menu-bar-only macOS app that should not appear in the Dock.

## Code

```typescript
// src/main.ts — inside whenReady, BEFORE first BrowserWindow
app.whenReady().then(async () => {
  // CRITICAL: dock.hide() BEFORE createMainWindow()
  // Otherwise, the Dock icon flashes briefly into existence (BT-C-10 regression)
  if (process.platform === 'darwin') {
    app.dock.hide()
    logger.info('dock:hidden', {})
  }

  // Now create the window
  const win = createMainWindow()
})
```

For packaged apps, also set `LSUIElement: true` in `Info.plist` via `extendInfo`:

```typescript
// forge.config.ts
packagerConfig: {
  extendInfo: {
    LSUIElement: true,  // Hide Dock icon in the packaged .app
    // ...other plist entries
  }
}
```

`LSUIElement: true` prevents the Dock icon in production. `app.dock.hide()` covers the dev/unpackaged path where `Info.plist` isn't read.

## Dock Badge (for apps that DO show a Dock icon)

```typescript
// Set a badge
app.dock.setBadge('3')

// Clear the badge
app.dock.setBadge('')

// Set a custom dock icon
app.dock.setIcon(nativeImage.createFromPath('/path/to/icon.png'))
```

## Test Pattern

```typescript
test('BT-dock-01: no Dock icon flash on startup', async () => {
  const { app, readLogLines } = await launchApp()
  try {
    await expect.poll(
      () => readLogLines().some(l => l.event === 'dock:hidden'),
      { timeout: 5000 }
    ).toBe(true)
  } finally { await app.close() }
})
```

Static check:
```typescript
it('R-dock-01: dock.hide called before createMainWindow in main.ts', () => {
  const src = readFileSync('src/main.ts', 'utf8')
  // dock.hide must appear before createMainWindow in the file
  const hideIdx = src.indexOf('dock.hide()')
  const windowIdx = src.indexOf('createMainWindow()')
  expect(hideIdx).toBeLessThan(windowIdx)
})
```

## Watch Out For

- `app.dock` is macOS-only — wrap all calls in `if (process.platform === 'darwin')`.
- `dock.hide()` MUST be called before the first `new BrowserWindow()` — if called after, the Dock icon flashes briefly. Playwright can capture this flash with a screenshot-based test.
- `LSUIElement: true` in Info.plist is the production mechanism. `dock.hide()` covers the dev path because `Info.plist` is only read from a packaged `.app` bundle.
- For non-menu-bar apps that want to hide the Dock icon temporarily (e.g., during a full-screen experience), you can call `dock.hide()` and `dock.show()` dynamically.

Evidence: `../../05_distillation/patterns/P-06-pre-ready-boot-ordering.md`, `../../05_distillation/before-you-build/BYB-02-electron-on-macos-deep-integration.md`, `../../01_research/12-dock-and-autolaunch.md`
