# G-11 — `playwright test` wipes `test-results/` at start

**Severity**: low
**Surface**: Playwright test harness
**Discovered in**: L5 + capstone log-capture (`04_logs/expectation-gap-ledger.md#entry-10`)

## Symptom

You run `npx playwright test > test-results/GREEN.log` to capture the verbose output. The file ends up nowhere — the shell wrote it, but the directory was deleted between shell-redirect-creation and the first test run.

## Root cause

Playwright clears `test-results/` BEFORE writing its first artifact. The shell's `>` redirect creates the file early, but Playwright's housekeeping then `rm -rf`s the directory.

## Fix

Three options:

1. **Use a sibling directory**:
   ```bash
   mkdir -p test-output
   npx playwright test > test-output/GREEN.log
   ```
2. **Pipe through `tee`**:
   ```bash
   npx playwright test 2>&1 | tee test-output/GREEN.log
   ```
3. **Use Playwright's own reporter** (`json`, `junit`) which writes to a stable file under `test-results/` after Playwright's clear:
   ```bash
   npx playwright test --reporter=list,json
   ```

## Test that catches a regression

None automated. Documented as harness behavior to save the next agent five minutes.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-10`
- `03_pocs/L-capstone-pulse/poc-report.md` §"Expectation gaps recorded" Entry 10 rediscovery
