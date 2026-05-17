# DR-11 — L5 build chain: hybrid (tsc + esbuild + forge)

**Status**: accepted (2026-05-17)
**POC scope**: L5 + capstone

## Context

L5 introduces electron-forge. The poc-plan calls forge the canonical packaging tool. Two paths were on the table:

1. Scaffold a fresh Vite + electron-forge template (`npm create electron-app -- --template=vite-typescript`) and port the L4 source into it.
2. Keep the L4 build chain (tsc for main, esbuild bundle for preload, static copy for renderer HTML) and use forge purely for `package` and `make`.

## Decision

Option 2 (hybrid). Forge wraps the existing L4 build chain via `prepackage` / `premake` npm hooks; no Vite plugin is involved.

## Alternatives considered

1. Vite + Forge template (rewrite required).
2. Hybrid: keep tsc + esbuild, add forge for packaging. ← chosen

## Consequences

- Option 1 requires rewriting `src/preload.ts`'s bundling to fit Vite's plugin pipeline. Vite's preload plugin assumes a Vite renderer too, so we'd be rewriting `src/renderer/` as well. None of this delivers behavior payoff for L5's test surface.
- The L2 expectation-gap entry 1 (preload under sandbox cannot require-arbitrary-files) is load-bearing: esbuild's `bundle:true platform:node external:['electron']` is exactly what we need.
- Forge supports a "no plugins" mode where it packages whatever `main` in package.json points at, executing the `prepackage` npm script first. That's all we need.
- POC dir cannot use Forge's dev-mode HMR (we never used HMR in L1-L4 either; main-process changes always required restart).
- Forge config doesn't reference any plugin-* package for build integration — only `FusesPlugin` for the post-bundle hardening pass. A reader expecting a `VitePlugin` block will be surprised.
- The capstone (Pulse) adopts the same hybrid pattern.

## Evidence

- `04_logs/decision-log.md#decision-11`
- `03_pocs/L5-packaging-signing-update/forge.config.ts`
- `03_pocs/L5-packaging-signing-update/poc-report.md` §"What landed"
