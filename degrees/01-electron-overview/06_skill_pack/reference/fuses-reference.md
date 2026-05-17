# Fuses Reference

Electron binary fuses are one-time settings baked into the Electron binary at packaging time. They cannot be changed at runtime.

Back to [../index.md](../index.md) | [entitlements-reference.md](./entitlements-reference.md)

---

## What Are Fuses?

Fuses are compile-time flags written into the Electron binary by `@electron/fuses` (via `FusesPlugin` in Forge). Once written, they are permanent for that binary build. They are the lowest-level hardening mechanism available in Electron.

**Key properties:**
- Applied at `npm run make` time, not at runtime
- Baked into the binary — not a config file
- Cannot be toggled by users or malware at runtime
- Some fuses affect ALL Electron apps on the machine if you patch the global binary (don't)

---

## Required Fuses for Production

All 6 of these must be set before shipping:

| Fuse | Value | Purpose |
|---|---|---|
| `RunAsNode` | `false` | Prevents `ELECTRON_RUN_AS_NODE=1 ./App` from running as a Node.js REPL |
| `EnableCookieEncryption` | `true` | Encrypts cookies at rest using OS keychain |
| `EnableNodeOptionsEnvironmentVariable` | `false` | Prevents `NODE_OPTIONS=--inspect ./App` from enabling debugger |
| `EnableNodeCliInspectArguments` | `false` | Prevents `--inspect`, `--inspect-brk` flags from enabling debugger |
| `EnableEmbeddedAsarIntegrityValidation` | `true` | Validates asar contents haven't been tampered with at launch |
| `OnlyLoadAppFromAsar` | `true` | Prevents loading app code from non-asar paths (blocks asar bypass) |

---

## Forge Configuration

```typescript
// forge.config.ts
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

export default {
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}
```

---

## Verifying Fuses

After packaging, read the fuse state from the binary:

```bash
npx @electron/fuses read --app out/<App>-darwin-arm64/<App>.app
```

Expected output:
```
Fuse Version: v1
  RunAsNode is Disabled
  EnableCookieEncryption is Enabled
  EnableNodeOptionsEnvironmentVariable is Disabled
  EnableNodeCliInspectArguments is Disabled
  EnableEmbeddedAsarIntegrityValidation is Enabled
  OnlyLoadAppFromAsar is Enabled
```

---

## Dependency Requirements

`OnlyLoadAppFromAsar: true` and `EnableEmbeddedAsarIntegrityValidation: true` both require `asar: true` in `packagerConfig`. If you set fuses to require asar but package without it, the app will fail to launch.

```typescript
packagerConfig: {
  asar: true,   // Required for asar fuses
}
```

---

## Static Regression Test

Verify all 6 fuses are set in `forge.config.ts` via static analysis:

```typescript
test('R-fuses-01: all 6 hardening fuses set in forge config', () => {
  const src = fs.readFileSync('forge.config.ts', 'utf-8')
  const required = [
    'RunAsNode.*false',
    'EnableCookieEncryption.*true',
    'EnableNodeOptionsEnvironmentVariable.*false',
    'EnableNodeCliInspectArguments.*false',
    'EnableEmbeddedAsarIntegrityValidation.*true',
    'OnlyLoadAppFromAsar.*true',
  ]
  for (const pattern of required) {
    expect(src, `Missing fuse: ${pattern}`).toMatch(new RegExp(pattern))
  }
})
```

---

## FuseV1Options Enum Reference

| Enum Value | Binary position | Description |
|---|---|---|
| `FuseV1Options.RunAsNode` | 0 | Node.js REPL mode |
| `FuseV1Options.EnableCookieEncryption` | 1 | Cookie encryption |
| `FuseV1Options.EnableNodeOptionsEnvironmentVariable` | 2 | NODE_OPTIONS env |
| `FuseV1Options.EnableNodeCliInspectArguments` | 3 | --inspect flag |
| `FuseV1Options.EnableEmbeddedAsarIntegrityValidation` | 4 | asar hash check |
| `FuseV1Options.OnlyLoadAppFromAsar` | 5 | asar-only loading |

---

## What Fuses Do NOT Cover

- Content Security Policy (handled in HTML meta tag)
- Navigation guards (handled in `will-navigate` listener)
- IPC validation (handled in registry validators)
- OS-level signing (handled via `osxSign` in Forge)
- Network access control (no built-in Electron mechanism)

---

## Related

- [../lessons/08-packaging-with-electron-forge.md](../lessons/08-packaging-with-electron-forge.md) — packaging with fuses
- [../lessons/02-secure-renderer-defaults.md](../lessons/02-secure-renderer-defaults.md) — renderer security
- [../recipes/recipe-forge-config-with-fuses.md](../recipes/recipe-forge-config-with-fuses.md) — complete forge.config.ts
- [../checklists/security-checklist.md](../checklists/security-checklist.md) — items 17–22
- [../checklists/production-readiness-checklist.md](../checklists/production-readiness-checklist.md) — item 12

Evidence: `../../../05_distillation/patterns/P-14-fuses-hardening-for-production.md`
