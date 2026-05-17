# G-02 — tsc `include: ["src/**/*.ts"]` skips ambient `.d.ts` files

**Severity**: low
**Surface**: TypeScript build
**Discovered in**: L1 GREEN setup (`04_logs/expectation-gap-ledger.md#entry-2`)

## Symptom

`src/renderer/renderer.d.ts` declares `interface Window { api: ... }`. Running `tsc -p tsconfig.json` fails with `TS2339: Property 'api' does not exist on type 'Window & typeof globalThis'`. Adding `src/**/*.d.ts` to `include` does NOT fix it. `tsc --listFiles` confirms the file is excluded from the program.

## Root cause

The `.d.ts` file contains only global augmentations (no `module` exports) AND is not referenced from any `.ts` file via `///<reference />`. TypeScript's discovery skips it under the `include` glob because the glob's intent is "files to compile" and pure ambient declaration files are normally discovered via reference paths, not enumeration.

## Fix

List the ambient `.d.ts` file in `tsconfig.json`'s `"files"` array:

```jsonc
{
  "compilerOptions": { ... },
  "include": ["src/**/*.ts"],
  "files": ["src/renderer/renderer.d.ts"]
}
```

## Test that catches a regression

`npm run build` itself — the `tsc` step fails with `TS2339` if the file isn't in the program.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-2`
- `03_pocs/L1-hello-electron/tsconfig.json` — canonical fix
