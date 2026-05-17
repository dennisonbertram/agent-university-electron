# BYB-01 — Electron 30 / 32 / 33 / 35 breaking changes

Read this before starting OR upgrading an Electron project. The API drift since v30 is non-trivial.

## Quick version pin (this degree)

| Component | Version |
|---|---|
| Electron | 42.1.0 |
| @electron-forge/cli | 7.11.1 |
| electron-updater | 6.8.3 |
| @electron/notarize | 3.1.1 |
| better-sqlite3 | 12.10.0 |
| playwright | 1.60.0 |
| vitest | 4.1.6 |
| Node.js (system) | 24.15.0 |
| macOS (target) | 15.7.7 (Sequoia) |

## Breaking changes you'll hit

### Electron 30
- **`BrowserView` deprecated** in favor of `WebContentsView` inside `BaseWindow`. See PB-10. Old `win.setBrowserView`, `win.addBrowserView`, `win.removeBrowserView` all deprecated.

### Electron 32
- **`File.path` removed.** Use `webUtils.getPathForFile(file)` via preload (AP-05, G-16).
- **`webContents.canGoBack()` / `goBack()` / etc.** moved to `webContents.navigationHistory.*`.
- **WebSQL databases in `userData`** are auto-deleted on first run.

### Electron 33
- **macOS 10.15 (Catalina) support dropped.** Minimum is macOS 11 Big Sur.
- **Native modules require C++20** (`--std=c++20`).

### Electron 34 / 35
- **`registerFileProtocol` / `register*Protocol` family deprecated** → use `protocol.handle`.
- **`console-message` event**: `event.level` is now a **string** ('info' / 'warning' / 'error' / 'debug'), not a number. Code that compares `event.level === 2` silently breaks.
- **`WebRequestFilter` empty `urls: []`** no longer matches all URLs → use `['<all_urls>']`.

### Electron 35 / 36
- **Session preload APIs deprecated**: `setPreloads/getPreloads` → `registerPreloadScript/unregisterPreloadScript/getPreloadScripts`.
- **`app.commandLine` lowercases switches** — use `process.argv` for case-sensitive args.
- **Extension methods** moved from `session.*` to `session.extensions.*`.
- **`NativeImage.getBitmap()` deprecated** → use `toBitmap()`.
- **GTK4 default on GNOME (Linux).**

### Electron 40-42 (current)
- **`clipboard` direct use in renderers deprecated.**
- **macOS notifications require code-signing** under UNNotification (already true in practice).
- **npm `postinstall` no longer downloads the binary** — use `npx install-electron`.
- **`--platform`/`--arch` npm flags** → `ELECTRON_INSTALL_PLATFORM`/`ELECTRON_INSTALL_ARCH` env vars.

## Upgrade strategy

1. **Pin exact version** in `package.json` — `"electron": "42.1.0"`, NOT `"^42"`. A `^` allows surprise minor upgrades that can bump V8 and break native modules.
2. **Consult the Breaking Changes doc** for every major between your current and target version. Apply changes in lockstep.
3. **`electron-rebuild` after every upgrade** to refresh native module ABI.
4. **Run full test suite on target macOS version.**
5. **Verify all native module dependencies** support the new Electron ABI before upgrading. better-sqlite3 in particular trails Electron's V8 by a major version sometimes (G-13).
6. **Universal binary requires per-arch rebuild + merge** — Forge handles this if `MakerDMG` is configured for universal.

## Decision: stay current vs LTS

Electron has NO LTS. Only the last 3 major versions are supported simultaneously. After that, security backports stop.

- **For products with > 12-month lifecycles**: budget for one major upgrade every ~6 months.
- **For new projects**: pin to latest stable major; the next major comes in ~8 weeks.

## Evidence

- `01_research/22-version-compatibility.md`
- `01_research/21-failure-modes.md#FM-13`, `#FM-15`
- `04_logs/expectation-gap-ledger.md#entry-12` (better-sqlite3 V8 trailing)
