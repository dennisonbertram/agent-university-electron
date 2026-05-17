# Troubleshooting — Packaged App Won't Launch

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Symptom

After `npm run make` or `npm run package`:
- App bounces in Dock then disappears
- Terminal shows `Exited with code 1`
- App opens then immediately closes
- Gatekeeper dialog appears and rejects the app
- `open out/<App>.app` returns nothing or an error

---

## Cause → Diagnostic → Fix

### Cause 1: `npm run build` not run before packaging

`npm run make` packages whatever is currently in `dist/`. If `dist/main.js` doesn't exist or is stale, the app fails to find its entry point.

**Diagnostic**

```bash
ls dist/main.js dist/preload.js dist/renderer/index.html
# All three must exist and be recent (check modification time)
```

**Fix**

```bash
npm run build && npm run make
```

Or configure Forge to run build as part of the packaging step:
```json
"scripts": {
  "package": "npm run build && electron-forge package",
  "make": "npm run build && electron-forge make"
}
```

---

### Cause 2: `package.json` `"main"` field points to wrong path

The `"main"` field must point to the built JS file, not the TypeScript source.

**Diagnostic**

```bash
cat package.json | grep '"main"'
# Must be "main": "dist/main.js" (NOT "src/main.ts")
```

**Fix**

```json
{
  "main": "dist/main.js"
}
```

---

### Cause 3: `asar: true` not set — files missing from bundle

If `asar` is not enabled, Forge packages the raw directory. Some paths that work in development may break in the packaged form.

Check that `asar: true` is in `packagerConfig`:

```typescript
packagerConfig: {
  asar: true,
  // ...
}
```

---

### Cause 4: Source `.ts` files leaked into bundle (asar ignore list wrong)

If TypeScript sources were included in the asar, the packaged app may try to `require()` `.ts` files directly, which fails because Electron cannot run TypeScript.

**Diagnostic**

```bash
npx @electron/asar list app.asar | grep '\.ts$'
# Must return nothing
```

**Fix**

Add an `ignore` pattern to `packagerConfig`:

```typescript
packagerConfig: {
  asar: true,
  ignore: [
    /^\/src\//,
    /^\/tests?\//,
    /forge\.config\./,
    /playwright\.config\./,
    /vitest\.config\./,
    /tsconfig/,
    /\.ts$/,
  ],
}
```

---

### Cause 5: Gatekeeper rejects unsigned app

On macOS, if the app is not signed with a Developer ID certificate AND the user has Gatekeeper set to "App Store and identified developers", the app will be rejected.

**Diagnostic**

```bash
spctl --assess --type exec --verbose out/<App>-darwin-arm64/<App>.app
# "rejected" means Gatekeeper blocked it
```

**Fix (temporary)**

Right-click the `.app` → Open → Open anyway. Or:
```bash
xattr -dr com.apple.quarantine out/<App>-darwin-arm64/<App>.app
```

**Fix (permanent)**

Sign and notarize. See [../lessons/09-code-signing-and-notarization.md](../lessons/09-code-signing-and-notarization.md).

---

### Cause 6: Crash at startup — check crash log

If the app launches and immediately crashes, macOS writes a crash report.

**Diagnostic**

```bash
# Check crash reports
ls ~/Library/Logs/DiagnosticReports/ | grep -i myapp
cat ~/Library/Logs/DiagnosticReports/MyApp_*.ips | head -100
```

Or:
```bash
# Run from terminal to see stdout/stderr
open out/<App>-darwin-arm64/<App>.app --args --enable-logging
# Or launch the binary directly:
out/<App>-darwin-arm64/<App>.app/Contents/MacOS/<App> 2>&1
```

---

### Cause 7: `OnlyLoadAppFromAsar` fuse enabled but asar missing

If you set `OnlyLoadAppFromAsar: true` (recommended) but `asar: false` in packagerConfig, the app will refuse to load because it expects an asar but finds a directory.

**Fix**

Set `asar: true` in `packagerConfig` when using the `OnlyLoadAppFromAsar` fuse.

---

### Cause 8: Native module ABI mismatch in packaged build

See [native-module-load-failure.md](./native-module-load-failure.md) — the app may launch then immediately crash due to a native module error.

---

## Quick Diagnostic Sequence

```bash
# 1. Check dist files
ls -la dist/main.js dist/preload.js

# 2. Run build then package
npm run build && npm run package

# 3. Launch from terminal (captures output)
out/<App>-darwin-arm64/<App>.app/Contents/MacOS/<App> 2>&1

# 4. Check asar is present
ls out/<App>-darwin-arm64/<App>.app/Contents/Resources/app.asar

# 5. Verify no .ts files in asar
npx @electron/asar list out/<App>-darwin-arm64/<App>.app/Contents/Resources/app.asar | grep '\.ts$'

# 6. Check package.json main field
node -e "const p = require('./package.json'); console.log(p.main)"
```

---

## Related

- [../lessons/08-packaging-with-electron-forge.md](../lessons/08-packaging-with-electron-forge.md) — Forge config, asar, ignore list
- [../recipes/recipe-forge-config-with-fuses.md](../recipes/recipe-forge-config-with-fuses.md) — complete forge.config.ts
- [../labs/lab-08-packaging-and-fuses.md](../labs/lab-08-packaging-and-fuses.md) — packaging verification exercise
- [../checklists/packaging-checklist.md](../checklists/packaging-checklist.md) — full pre/post checklist
- [code-signing-failure.md](./code-signing-failure.md) — if Gatekeeper is the blocker

Evidence: `../../../05_distillation/playbooks/PB-08-packaging-macos-signed-build-walkthrough.md`, `../../../05_distillation/production-readiness-checklist.md`
