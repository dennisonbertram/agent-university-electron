# Electron Version Compatibility Reference

Version baselines, breaking changes, and ABI information.

Back to [../index.md](../index.md) | [glossary.md](./glossary.md)

---

## Version Baseline (this skill pack)

| Package | Version |
|---|---|
| Electron | 42.1.0 |
| @electron-forge/cli | 7.11.1 |
| electron-updater | 6.8.3 |
| Node.js (bundled) | 24.15.0 |
| Chromium (bundled) | 130.x |
| Platform tested | macOS 15.7.7 (darwin arm64) |

---

## Node.js ABI Table

The Node Module ABI (Application Binary Interface) version determines whether a native `.node` module can be loaded. A module compiled for one ABI cannot run in another.

| Runtime | Version | ABI (NODE_MODULE_VERSION) |
|---|---|---|
| Node.js | 24.x | 137 |
| Node.js | 22.x | 127 |
| Node.js | 20.x | 115 |
| Electron | 42.x | 146 |
| Electron | 35.x | 137 |
| Electron | 32.x | 132 |
| Electron | 30.x | 130 |

**The two-ABI problem**: Electron 42 uses ABI 146 while Node.js 24 uses ABI 137. You cannot use the same compiled `.node` file for both. See [../lessons/05-native-modules-and-rebuild.md](../lessons/05-native-modules-and-rebuild.md).

---

## Breaking Changes by Electron Version

### Electron 35 — `contextBridge.exposeInMainWorld` type restrictions

Direct exposure of `ipcRenderer` or `require` via `contextBridge` was restricted. Only plain objects and functions can be exposed.

**Impact**: Any code calling `contextBridge.exposeInMainWorld('electron', require('electron'))` breaks.

**Fix**: Expose named async functions that call `ipcRenderer.invoke` internally.

### Electron 32 — V8 memory cage enabled by default

The V8 memory cage prevents unsafe buffer sharing. `better-sqlite3` versions below 11.1.2 crash at runtime.

**Impact**: Using older `better-sqlite3` with Electron 32+.

**Fix**: Upgrade to `better-sqlite3 >= 11.1.2` and run `electron-rebuild`.

### Electron 30 — `preload` injection via `additionalArguments` removed

Previously, some patterns used `additionalArguments` in `webPreferences` to pass data to the preload. This was removed.

**Impact**: Any code relying on `additionalArguments` for preload communication.

**Fix**: Use IPC channels for main → renderer communication.

---

## `better-sqlite3` Compatibility

| better-sqlite3 version | Min Electron | V8 memory cage compat |
|---|---|---|
| >= 11.1.2 | 32+ | Yes |
| 10.x | < 32 | No (crashes on 32+) |
| 9.x | < 30 | No |

Always run `electron-rebuild` after `npm install` to recompile against the target Electron's Node.

---

## electron-updater Compatibility

| electron-updater | Notes |
|---|---|
| 6.8.x | Compatible with Electron 42; `forceDevUpdateConfig` cast required |
| 6.x | Required TypeScript cast for `forceDevUpdateConfig` property |
| < 5.x | Do not use — significant security and compatibility issues |

The `forceDevUpdateConfig` property exists at runtime but is not in the TypeScript type definition. Use `(autoUpdater as any).forceDevUpdateConfig = true`.

---

## Forge Compatibility

| @electron-forge/cli | Compatible Electron |
|---|---|
| 7.x | 30–42 |
| 6.x | 22–30 |

Use Forge 7.x for all new projects.

---

## Package.json `engines` Field

```json
{
  "engines": {
    "node": ">=24.0.0"
  }
}
```

Note: The `engines` field restricts the system Node used for `npm install` and scripts, not the Electron-bundled Node.

---

## Checking Versions at Runtime

```typescript
// In main process
console.log({
  electron: process.versions.electron,
  node: process.versions.node,
  chromium: process.versions.chrome,
  v8: process.versions.v8,
  nodeModuleVersion: process.versions.modules,  // ABI
})
```

---

## Related

- [../lessons/05-native-modules-and-rebuild.md](../lessons/05-native-modules-and-rebuild.md) — ABI problem, rebuild strategies
- [../troubleshooting/native-module-load-failure.md](../troubleshooting/native-module-load-failure.md) — ABI mismatch troubleshooting
- [../recipes/recipe-better-sqlite3-with-auto-unpack.md](../recipes/recipe-better-sqlite3-with-auto-unpack.md) — complete sqlite setup

Evidence: `../../../05_distillation/before-you-build/BYB-01-electron-30-32-35-breaking-changes.md`
