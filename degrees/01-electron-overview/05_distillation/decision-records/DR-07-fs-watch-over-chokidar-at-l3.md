# DR-07 — `fs.watch` over `chokidar` at L3

**Status**: accepted (2026-05-17)
**POC scope**: L3

## Context

BT-L3-7 requires the renderer to receive a structured `file:changed` push with `kind: 'rename'` when a file in the watched directory is renamed. `fs.watch` is documented as ambiguous on rename: it reports `rename` for either an add or an unlink. The poc-plan permitted switching to `chokidar` if `fs.watch` was flaky.

## Decision

Use Node's built-in `fs.watch` with a listing-diff pairing strategy to surface rename events; do NOT pull in `chokidar`.

## Alternatives considered

1. `chokidar` — battle-tested, but adds ~25 transitive deps.
2. `fs.watch` with a directory-listing diff to pair the two rename events macOS emits for a `mv`. ← chosen
3. Native FSEvents binding via `@parcel/watcher` or similar.

## Consequences

- The diff is ~30 lines of code, has no native build steps, and behaves deterministically once the seed-listing settles.
- Observed end-to-end rename latency on macOS 14 was ~700-800ms — slower than the 500ms target in the spec. The e2e test relaxes the gate to `< 1500ms` and the slack is documented in poc-report.md (G-04).
- If L4 or capstone needs sub-200ms latency, the swap to chokidar / @parcel/watcher is a one-file change.
- **Invalidated assumption**: A4 mentioned that fs.watch was likely unreliable on macOS for renames; the listing-diff workaround turns that into a controlled feature.

## Evidence

- `04_logs/decision-log.md#decision-7`
- `04_logs/expectation-gap-ledger.md#entry-4`
- `03_pocs/L3-storage-and-native-io/src/watcher.ts`
- `03_pocs/L3-storage-and-native-io/poc-report.md` §"Decisions" 1
