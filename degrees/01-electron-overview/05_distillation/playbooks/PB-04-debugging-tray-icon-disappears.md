# PB-04 — Debugging a tray icon that disappears

**Symptom**: Tray icon appears briefly (or at app launch) then vanishes. Subsequent operations on the tray have no visible effect.

## Decision tree

1. **Check the variable scope.** This is FM-04 / G-06 in 95% of cases. Open `src/tray.ts` and find the `new Tray(...)` call. Is it assigned to:
   - a function-local `const tray = new Tray(...)`? → **BUG**. The instance is GC'd when the function returns. Move to `let trayInstance: Tray | null = null` at module scope.
   - a module-scope `let trayInstance`? → keep looking; the GC bug is not your problem.

2. **Was `tray.destroy()` called somewhere?** Search for `.destroy()` calls. If your code or library calls it implicitly, the icon goes away.

3. **Is the image valid?**
   ```typescript
   const icon = nativeImage.createFromPath('assets/trayTemplate.png')
   console.log('image isEmpty:', icon.isEmpty())
   ```
   If `isEmpty() === true`, the file wasn't found and macOS shows no icon. Check `__dirname` in the packaged app: it's INSIDE `app.asar`, so file paths need `process.resourcesPath` or the unpacked path.

4. **Is the filename `Template`-suffixed?** macOS template-image rules require the filename to end in `Template` (e.g., `trayTemplate.png`) AND your bundler must NOT hash the filename. If your build pipeline renames to `trayTemplate.a3f8.png`, macOS doesn't apply the template-image inversion.

5. **Are you on Linux?** Some Linux desktop environments don't render Electron trays at all. Look for the `tray:installed` log marker — if it fires but no icon shows, that's the platform limitation.

## Test for regression

```typescript
test('R-L4-1: tray.ts holds a module-scope tray instance', () => {
  const src = readFileSync('src/tray.ts', 'utf8')
  expect(src).toMatch(/^let trayInstance(:|\s)/m)
})
```

## Evidence

- `01_research/21-failure-modes.md#FM-04`
- `01_research/07-tray-and-menus.md` lines 10-45
- `03_pocs/L4-deep-macos-integration/src/tray.ts:27`
- `03_pocs/L4-deep-macos-integration/poc-report.md` R-L4-1
