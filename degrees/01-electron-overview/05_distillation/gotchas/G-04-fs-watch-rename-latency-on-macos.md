# G-04 — `fs.watch` rename latency on macOS 14 exceeds the docs' implication

**Severity**: low
**Surface**: File-watching, Node `fs.watch`
**Discovered in**: L3 GREEN of BT-L3-7 (`04_logs/expectation-gap-ledger.md#entry-4`)

## Symptom

After `renameSync` on a file in a watched directory, the renderer receives the `file:changed` push 700-900ms later on a quiet macOS 14 laptop. Tests written to a 500ms target time out.

## Root cause

Several debounce sources stack:

1. macOS emits TWO `rename` events per `mv` (one for the source, one for the dest). A listing-diff pairing requires the second event before the rename can be classified.
2. FSEvents itself debounces ~100ms by default.
3. The IPC push hop from main → renderer adds a tick.
4. The test's 50ms polling tick adds more.

End-to-end is consistently 700-900ms.

## Fix

Either:

1. **Relax the assertion** to `< 1500ms` (what we did for L3 stability), OR
2. **Swap in `@parcel/watcher` or `chokidar`** which use native FSEvents with shorter latency and emit consolidated rename events.

For most desktop apps the 1500ms gate is fine; if you need sub-200ms (e.g., a fast popover that needs immediate feedback) use a native watcher.

## Test that catches a regression

`tests/e2e/watch.spec.ts` (L3) — asserts `< 1500ms` between `renameSync` and the `file:changed` event observation.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-4`
- `04_logs/decision-log.md#decision-7`
- `03_pocs/L3-storage-and-native-io/poc-report.md` §"Expectation gaps encountered"
