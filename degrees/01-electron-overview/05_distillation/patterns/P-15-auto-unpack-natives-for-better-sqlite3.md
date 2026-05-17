# P-15 — `AutoUnpackNativesPlugin` for native modules in the packaged app

**When to use**: any packaged Electron app that uses native modules (`better-sqlite3`, `keytar`, `node-pty`, etc.).
**Evidence**: capstone R-C-8 (`03_pocs/L-capstone-pulse/forge.config.ts`).

## Pattern

```typescript
// forge.config.ts
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true, // asar packing on
    // ...
  },
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new FusesPlugin({ /* ... */ }),
  ],
}
```

After packaging, the `.node` files end up at `<App>.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node`.

## Why it works

- Native `.node` files cannot be `require()`d from inside an asar archive — the dynamic loader can't fopen them.
- `AutoUnpackNativesPlugin` walks `node_modules`, finds all `.node` files, and adds them to the `asar.unpack` glob automatically.
- The plugin handles transitive native deps (some packages bundle `.node` files in sub-dirs).

## Tradeoffs

- Unpacked files are NOT covered by the asar integrity fuse — a tampered `.node` is loadable. Code-signing protects against this (the OS verifies the native module signature).
- The unpacked directory adds a few MB to the bundle size.

## Variants

- **Manual `asar.unpack` glob**:
  ```typescript
  packagerConfig: {
    asar: { unpack: '**/*.node' },
  }
  ```
  Less robust than the plugin if a package nests its native binary unusually.

## Evidence

- `01_research/14-native-modules.md` lines 106-130
- `03_pocs/L-capstone-pulse/poc-report.md` §"Invariants" 4
- `03_pocs/L-capstone-pulse/forge.config.ts` (AutoUnpackNativesPlugin in plugins)
