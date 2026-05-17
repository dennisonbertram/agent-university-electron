# Assumptions — 01-electron-overview

Assumptions made at degree start, to be verified or invalidated during Phase 1 research. Each invalidation becomes a decision-log entry.

## Platform Assumptions

- **A1** — macOS is the primary platform. Windows/Linux are documented but not actively built for the capstone.
- **A2** — Apple Silicon (arm64) is the dev machine; packaging targets universal arm64+x64.
- **A3** — No Apple Developer account is available. Signing/notarization is simulated.

## Toolchain Assumptions

- **A4** — `electron-forge` is the preferred toolchain. `electron-builder` is the fallback.
- **A5** — TypeScript everywhere. Strict mode.
- **A6** — `vitest` is the most likely test runner; `bun:test` only if native-module compat works; `jest` last resort.
- **A7** — `better-sqlite3` is acceptable as a native module; `@electron/rebuild` handles ABI alignment.
- **A8** — `playwright` `_electron` is the e2e harness for the capstone.

## API Assumptions

- **A9** — `safeStorage` is available on current macOS Electron builds.
- **A10** — `systemPreferences.promptTouchID` is available on Apple-Silicon-equipped Macs with Touch ID hardware.
- **A11** — `Notification` action buttons + reply input are available on macOS.
- **A12** — `globalShortcut` does not conflict with default macOS system shortcuts for `Cmd+Shift+P` and `Cmd+Shift+J`.
- **A13** — Custom URL scheme registration works for unsigned dev builds (or only after first packaged install).

## Process Assumptions

- **A14** — Phase 1 research uses `ctx7` for current docs.
- **A15** — Every POC is built test-first under TDD with `red → green → regression` commits.
- **A16** — Every quality gate runs `evidence-auditor` before phase advance.
- **A17** — Library docs are fetched via `ctx7`, not relied on from training data.

Each assumption is referenced by ID (`A12`) in subsequent research files and gotchas.
