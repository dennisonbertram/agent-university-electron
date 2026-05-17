# P-14 — Fuses hardening for production Electron

**When to use**: every packaged Electron binary destined for distribution.
**Evidence**: L5 R-L5-2 (`03_pocs/L5-packaging-signing-update/forge.config.ts:225-233`).

## Pattern

```typescript
// forge.config.ts
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

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
]
```

Static regression test (R-L5-2):

```typescript
test('R-L5-2: FusesPlugin contains all 6 hardening flags', () => {
  const src = readFileSync('forge.config.ts', 'utf8')
  expect(src).toMatch(/RunAsNode\]:\s*false/)
  expect(src).toMatch(/EnableNodeOptionsEnvironmentVariable\]:\s*false/)
  expect(src).toMatch(/EnableNodeCliInspectArguments\]:\s*false/)
  expect(src).toMatch(/EnableCookieEncryption\]:\s*true/)
  expect(src).toMatch(/OnlyLoadAppFromAsar\]:\s*true/)
  expect(src).toMatch(/EnableEmbeddedAsarIntegrityValidation\]:\s*true/)
})
```

## Why it works

Each fuse closes a known attack surface:

- **`RunAsNode: false`** — prevents the bundle being abused as a node interpreter (`<App>.app/Contents/MacOS/<exe> -e "require('child_process').execSync(...)"`)
- **`EnableNodeOptionsEnvironmentVariable: false`** — blocks `NODE_OPTIONS='--inspect-brk=...'`
- **`EnableNodeCliInspectArguments: false`** — blocks `--inspect`, `--inspect-brk` CLI flags
- **`EnableCookieEncryption: true`** — encrypts cookie storage at rest
- **`OnlyLoadAppFromAsar: true`** — blocks loading app from anywhere except the asar (defense against tampering)
- **`EnableEmbeddedAsarIntegrityValidation: true`** — adds an integrity check on the asar at load time

Fuses are applied post-bundling and modify the binary in-place. They must run BEFORE signing (the signed bytes must include the flipped fuses).

## Tradeoffs

- `OnlyLoadAppFromAsar: true` makes development with `electron .` unusable in the packaged binary — but you'd never run the packaged binary in dev anyway.
- `EnableEmbeddedAsarIntegrityValidation: true` adds startup overhead (a hash check). Small for small asars; substantial for 200MB+ apps.

## Variants

- **MAS targets** (App Store): `EnableNodeCliInspectArguments` is already disabled by sandbox; setting the fuse provides defense in depth.

## Evidence

- `03_pocs/L5-packaging-signing-update/forge.config.ts:225-233`
- `03_pocs/L5-packaging-signing-update/poc-report.md` R-L5-2
- `01_research/05-security-model.md` lines 157-170
