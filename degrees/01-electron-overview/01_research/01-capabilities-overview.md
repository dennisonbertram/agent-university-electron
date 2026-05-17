# Capabilities Overview — Electron

Version: Electron 42.1.0 (2026-05-16) [S32]

## What Electron Is

Electron is a framework for building cross-platform desktop applications using web technologies (HTML, CSS, JavaScript/TypeScript). It embeds Chromium (for rendering) and Node.js (for system access) in a single binary.

Key invariant: an Electron app is a Node.js process that spawns a Chromium renderer for each window. Both runtimes coexist but are kept isolated by default since Electron 20.

## What Electron Does Well

| Capability | Notes |
|-----------|-------|
| Cross-platform UI | Write once, run on macOS/Windows/Linux |
| Rich native integration | Tray, notifications, global shortcuts, deep links, auto-launch |
| Chromium DevTools | Full browser devtools, sourcemaps, performance profiling |
| npm ecosystem | Full access to Node.js modules in main process |
| Packaging | electron-forge produces DMG, ZIP, NSIS, AppImage etc. |
| Auto-update | electron-updater (third-party, recommended) or built-in Squirrel |
| System APIs | file system, clipboard, shell, power management, Touch ID |
| macOS-first depth | Menu bar apps, Dock API, native notifications with actions |

## What Electron Does NOT Do Well

| Limitation | Notes |
|-----------|-------|
| Binary size | Baseline ~150-200MB uncompressed (Chromium overhead); mitigate with asar, compression |
| Memory usage | Baseline 150–300MB RAM idle; each window is a separate process |
| Startup time | 1–3 seconds cold start typical; mitigate with lazy loading, Menu.setApplicationMenu(null) early |
| iOS/Android | Electron is desktop-only; use Capacitor/React Native for mobile |
| True native UI | UI is always a web view; not native controls (menus/tray are native, but window contents are not) |
| App Store sandboxing | Full sandbox restricts many native APIs; MAS targets are significantly constrained |
| CPU-bound workloads | Blocked main process freezes entire app; must use worker threads or UtilityProcess |

## When to Choose Electron vs Alternatives

### Electron over Tauri

- You need full Node.js ecosystem (native modules)
- Your team has existing web/React/Vue skills
- You need mature tooling and large community
- You need rich macOS system integration (Tray, Dock, Touch ID)
- Cross-platform support is equally important for all three OS

### Tauri over Electron

- Binary size is critical (Tauri ~3-15MB vs Electron ~150MB+)
- Memory footprint is critical
- You are comfortable with Rust for backend logic
- You only target users on modern macOS/Windows with system WebView

### Native Frameworks over Electron

- App must use native UI controls (SwiftUI, AppKit, WinUI)
- Performance-critical paths that cannot tolerate the Chromium layer
- Mac App Store with full sandboxing requirement
- Touch ID with direct Keychain access (not the Electron promptTouchID workaround)

## Version Cadence

- **Release cycle**: ~8-week (aligned to Chromium stable release cycle) [S21]
- **SemVer**: Major bumps for Chromium/Node major updates and breaking Electron API changes [S21]
- **Supported versions**: typically last 3 major releases simultaneously; older lines receive no backports [S21]
- **No LTS**: unlike Node.js, Electron has no formal LTS; "supported" means within the active window only [S21]

## Chromium/Node Coupling (Electron 42)

| Component | Version bundled |
|-----------|----------------|
| Electron | 42.1.0 |
| Chromium | ~130.x (inferred from release cadence; verify with `process.versions.chrome` at runtime) |
| Node.js | ~22.x (inferred; verify with `process.versions.node` at runtime) |

IMPORTANT: bundled Node version != system Node. Native modules must be rebuilt against Electron's bundled Node ABI, not the system Node. [S22]

## Current Stable (2026-05-16)

```
electron: 42.1.0
@electron-forge/cli: 7.11.1
electron-updater: 6.8.3
@electron/notarize: 3.1.1
```

All POCs in this degree pin to Electron 42.1.0.
