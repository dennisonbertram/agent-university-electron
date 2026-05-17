# Version Compatibility — Electron

Version: Electron 42.1.0 (current stable as of 2026-05-16) [S21, S29, S32]

## Current Version Pin (This Degree)

| Component | Version |
|-----------|---------|
| Electron | **42.1.0** |
| @electron-forge/cli | 7.11.1 |
| electron-updater | 6.8.3 |
| @electron/notarize | 3.1.1 |
| better-sqlite3 | 12.10.0 |
| playwright | 1.60.0 |
| vitest | 4.1.6 |
| Node.js (system) | 24.15.0 |
| macOS (target) | 15.7.7 (Sequoia) |

## Electron Release Cadence [S21]

- **~8-week cycle** aligned to Chromium stable releases
- Major version bump → Chromium major update, Node.js major update, or breaking Electron API
- Electron does NOT have traditional LTS — only last 3 major versions are supported simultaneously
- Older lines receive no security backports after they exit the support window

## Chromium/Node Coupling

| Electron | Chromium (approx) | Node.js bundled | Released |
|----------|------------------|----------------|---------|
| 42 | ~130.x | ~22.x | 2025-2026 |
| 33 | ~126.x | ~22.x | 2024 |
| 30 | ~122.x | ~21.x | 2024 |
| 28 | ~120.x | ~18.x | 2024 |

To verify exact versions at runtime:
```typescript
console.log(process.versions)
// { node: '22.x.y', chrome: '130.x.y.z', electron: '42.1.0', ... }
```

## macOS Version Support (Electron 42)

- Minimum macOS: **macOS 11 (Big Sur)** — Catalina (10.15) support dropped in Electron 33 [S29]
- Recommended development: macOS 13+ (Ventura) for full API access (setLoginItemSettings type field, new notification APIs)
- This degree targets: macOS 15.7.7 (Sequoia)

## Breaking Changes Relevant to This Degree (v30-42) [S29]

### Electron 30
- `BrowserView` deprecated → use `WebContentsView`
- `BrowserWindow.setBrowserView/addBrowserView` etc. all deprecated

### Electron 32
- `File.path` removed → use `webUtils.getPathForFile(file)` via preload
- `webContents.canGoBack()`, `goBack()`, etc. → `webContents.navigationHistory.*`
- WebSQL databases in `userData` auto-deleted on first run

### Electron 33
- macOS 10.15 (Catalina) no longer supported
- Native modules require **C++20** (`--std=c++20`)

### Electron 34 / 35
- `registerFileProtocol` and `register*Protocol` family deprecated → use `protocol.handle`
- Custom protocol URLs with Windows file paths no longer work with old API
- `console-message` event: `event.level` is now a **string** (info/warning/error/debug), NOT a number
- `WebRequestFilter` empty `urls: []` no longer matches all URLs → use `['<all_urls>']`

### Electron 35 / 36
- Session preload APIs deprecated: `setPreloads/getPreloads` → `registerPreloadScript/unregisterPreloadScript/getPreloadScripts`
- `app.commandLine` lowercases switches — use `process.argv` for case-sensitive args
- Extension methods moved from `session.*` to `session.extensions.*`
- `NativeImage.getBitmap()` deprecated → use `toBitmap()`
- GTK4 default on GNOME (Linux)

### Electron 40-42 (Looking Ahead)
- `clipboard` direct use in renderers deprecated
- macOS notifications will require code-signing under UNNotification
- npm `postinstall` no longer downloads the binary — use `npx install-electron`
- `--platform`/`--arch` npm flags → `ELECTRON_INSTALL_PLATFORM`/`ELECTRON_INSTALL_ARCH` env vars

## Upgrade Path Strategy

1. Stay within active support window (check electronjs.org/releases)
2. When upgrading major: consult Breaking Changes doc for the target version
3. Pin exact Electron version in `package.json` (`"electron": "42.1.0"` not `"^42"`)
4. Run `electron-rebuild` after any Electron upgrade (native modules)
5. Rebuild universal binary for both arches
6. Run full test suite on target macOS version

## Choosing an Electron Version

For new long-lived projects:
- Pin to latest stable major (42.x as of now)
- Do NOT use nightly/alpha builds in production
- Accept major version upgrades on a ~6-month cycle (one Chromium major)
- Check that all native module dependencies support the new Electron ABI before upgrading

## @electron/fuses Version Compatibility

`@electron/fuses` fuse definitions are versioned separately from Electron. Use `FuseVersion.V1` for Electron 34+. Check the package changelog when upgrading Electron.

## Package Manager Compatibility Note

- npm 11.x: verified working with Electron 42 (environment probe)
- pnpm 10.x: should work; some users report issues with native module hoist
- bun 1.3.x: available but native module support (node-gyp) may be incomplete; use npm for Electron projects

RECOMMENDATION: Use npm for all Electron POC work in this degree. [S32]
