# DR-12 — Capstone: in-process IPC test seam for SQLite inspection

**Status**: accepted (2026-05-17)
**POC scope**: capstone (Pulse)

## Context

BT-C-5 wants to assert that a `pulse://log?text=...` deep-link produces a SQLite row with ciphertext (NOT plaintext). The natural test shape is "open the journal.db from the Playwright process and read the rows directly". But `better-sqlite3` is rebuilt for Electron's V8 ABI (NODE_MODULE_VERSION 146) and cannot load under system Node 24 (ABI 137). The Playwright process runs under system Node — the binary mismatch is unavoidable as long as one binary serves both.

## Decision

Inspect SQLite via an in-process IPC test seam — main returns the raw rows (ciphertext base64-encoded) and the test asserts on them. The `test:get-raw-journal-rows` channel returns `{ id, ts, ciphertextBase64, length, created_at }` rows.

## Alternatives considered

1. Maintain two prebuilds (system Node + Electron) and switch the symlink based on the runner. Bespoke, brittle.
2. Inspect SQLite via an in-process IPC test seam — main returns the raw rows. ← chosen
3. Drop the encryption assertion and trust the source-text regression (R-C-2). Less powerful — a regression that bypassed encryption and also stripped the `safeStorage.encryptString` reference would slip through both static + behavioral checks.

## Consequences

- One more test-only channel on the IPC surface, gated by `testHooksEnabled()` so a real distribution doesn't expose it.
- The test base64-decodes and asserts the bytes are not equal to the plaintext (when encryption is available) OR are equal (when the fallback path fires — R-C-1).
- **Future-agent implication**: Whenever a test wants to inspect a native-module-backed data store from outside the Electron process, prefer the IPC seam over a direct module load. The ABI mismatch is a recurring obstacle and the seam is much more durable.

## Evidence

- `04_logs/decision-log.md#decision-12`
- `04_logs/debugging-log.md` 2026-05-17 session
- `03_pocs/L-capstone-pulse/src/ipc.ts` (`TEST_GET_RAW_JOURNAL_ROWS` channel)
- `03_pocs/L-capstone-pulse/src/journal-store.ts:113-115` (listRowsForTest)
- `03_pocs/L-capstone-pulse/tests/e2e/journal.spec.ts`
