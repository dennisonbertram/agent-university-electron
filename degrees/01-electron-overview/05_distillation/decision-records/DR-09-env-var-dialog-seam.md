# DR-09 — Env-var dialog seam (`DIALOG_STUB`) at L3

**Status**: accepted (2026-05-17)
**POC scope**: L3+

## Context

Driving the native macOS dialog from Playwright requires either `--no-sandbox` tricks or an actual user interaction. BT-L3-3 and BT-L3-4 need deterministic test outcomes for both the cancel and pick paths.

## Decision

Stub `dialog.showOpenDialog` and `dialog.showSaveDialog` in `src/main.ts` when `DIALOG_STUB === '1'`, returning a deterministic fixture keyed off `DIALOG_STUB_MODE` and `DIALOG_STUB_PATH`. Real dialog code stays in place when the var is unset.

## Alternatives considered

1. Inject the dialog adapter into `makeHandlerContext` and pass a stub at construction.
2. Env-var-driven branch inside the production adapter. ← chosen
3. Wrap `dialog.show*Dialog` once at startup with a runtime check.

## Consequences

- One-line branch, matches the `JOURNAL_SIMULATE_CRASH` pattern used by R-L3-2, keeps the test wire visible in main.ts.
- Production main.ts contains a small test seam. The seam is documented in `test-plan.md` and the env var is explicit, so accidental activation requires literal opt-in.
- L4 reuses this pattern for tray / notification / global-shortcut testing (DR-10).

## Evidence

- `04_logs/decision-log.md#decision-9`
- `03_pocs/L3-storage-and-native-io/src/main.ts`
- `03_pocs/L3-storage-and-native-io/poc-report.md` §"Decisions" 3
