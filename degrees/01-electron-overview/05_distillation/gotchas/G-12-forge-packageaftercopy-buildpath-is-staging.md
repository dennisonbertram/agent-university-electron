# G-12 — Forge `packageAfterCopy(forgeConfig, buildPath)` buildPath is staging, not final

**Severity**: low
**Surface**: Electron Forge hooks
**Discovered in**: L5 BT-L5-5 / simulated-signing.md emission (`04_logs/expectation-gap-ledger.md#entry-11`)

## Symptom

You write a file to `buildPath` inside the `packageAfterCopy` hook expecting it to land in the final `out/<App>.app` bundle. Instead it lands inside `app.asar` (because `buildPath` is the staging tree that gets asar'd), or nowhere visible because the temp tree is purged.

## Root cause

Forge 7.11.1's `packageAfterCopy(forgeConfig, buildPath, electronVersion, platform, arch)` signature gives you the COPIED STAGING DIR, not the `.app` bundle directory. The staging tree is what gets bundled into asar; anything written there is bundled too.

## Fix

If you want a file tracked in git (e.g., `simulated-signing.md`), write to absolute paths under your source tree (`POC_ROOT`) instead of `buildPath`:

```typescript
// forge.config.ts
const POC_ROOT = __dirname
hooks: {
  packageAfterCopy: async (_forgeConfig, _buildPath) => {
    if (!HAS_APPLE_CREDS) {
      writeFileSync(
        path.join(POC_ROOT, 'simulated-signing.md'), // POC_ROOT, NOT buildPath
        md,
        'utf8',
      )
    }
  },
}
```

## Test that catches a regression

`tests/e2e/signing-simulation.spec.ts > BT-L5-5` (L5) — asserts `simulated-signing.md` exists at the POC root after a `npm run package` with no Apple creds in env.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-11`
- `03_pocs/L5-packaging-signing-update/forge.config.ts:235-250`
- `03_pocs/L5-packaging-signing-update/poc-report.md` Entry 11
