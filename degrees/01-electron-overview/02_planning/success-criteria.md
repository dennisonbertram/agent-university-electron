# Success Criteria — 01-electron-overview

Three sections: degree-level, per-POC, and quality-gate. Status markers: [DONE] = already true; [PENDING] = not yet verifiable.

---

## 1. Degree-Level Acceptance Criteria

Derived from `command-intent.md` "Success Criteria." Every item is measurable.

| # | Criterion | Measurable Form | Status |
|---|-----------|----------------|--------|
| D-01 | Phase 0 metadata complete | `00_metadata/` contains 4 files: degree-metadata, assumptions, environment, source-inventory — all non-empty | [DONE] |
| D-02 | Phase 1 research ≥15 files | `ls 01_research/*.md | wc -l` returns ≥15 | [DONE] (23 files) |
| D-03 | Every research claim cites a source | Each file contains `[S\d+]` citation or explicit evidence reference | [DONE] |
| D-04 | Phase 2–5 synthesis complete | All 6 files exist in `02_planning/` with ≥100 lines each | [PENDING] |
| D-05 | All 6 POCs built test-first | Each POC directory has: README.md, test-plan.md, at least one `*.test.ts` file committed before implementation, implementation files, POC report | [PENDING] |
| D-06 | Behavioral tests pass per POC | `npm test` in each POC directory exits 0; test count ≥ the number of Given/When/Then assertions listed in poc-plan.md | [PENDING] |
| D-07 | Capstone is a packaged runnable app | `npm run make` in capstone directory produces a `.dmg` under `out/make/`; app launches as menu-bar-only (no dock icon) | [PENDING] |
| D-08 | ≥10 distillation files | `ls 05_distillation/*.md | wc -l` returns ≥10; every file references a POC or log entry | [PENDING] |
| D-09 | Skill pack navigable without raw research | `06_skill_pack/index.md`, `quickstart.md`, `agent-instructions.md` all exist and reference no raw research files directly | [PENDING] |
| D-10 | Evaluation files complete | `07_evaluation/` has 4 files; `skill-pack-readiness.md` contains numeric scores 1–5 for all 11 dimensions | [PENDING] |
| D-11 | All ledgers have real entries | Each file in `04_logs/` contains ≥1 real entry (not template-only); expectation-gap ledger has ≥3 entries | [PENDING] |
| D-12 | Zero quality-gate failures | `evidence-auditor` evaluation passes all 5 gates (research, POC, distillation, skill-pack, evidence-integrity) | [PENDING] |

---

## 2. Per-POC Acceptance Criteria

### L1 — Hello Electron

Minimum behavioral assertions that must pass:

| ID | Behavior | Measurable Form |
|----|----------|----------------|
| L1-T1 | App boots | `electronApp` is non-null after `electron.launch()`; first window has a title matching `/Hello Electron/i` |
| L1-T2 | BrowserWindow created | `electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)` returns 1 |
| L1-T3 | Renderer reports ready via IPC | A `renderer-ready` promise in main resolves within 10s of launch |
| L1-T4 | macOS close-but-keep-alive | After closing the window, `app.isReady()` remains true; process is still running (no SIGTERM within 5s) |
| L1-T5 | Hot reload triggers (dev mode only) | Main process does NOT crash when renderer source changes; renderer reloads (observable via a version counter IPC) |

Acceptance bar: all 5 pass in CI (macOS runner). L1-T5 documented as "manually verified" if CI can't reliably trigger file-watch.

---

### L2 — Secure IPC

| ID | Behavior | Measurable Form |
|----|----------|----------------|
| L2-T1 | Ping roundtrip | `window.api.ping()` resolves with `{ ts: number }` where `ts > 0` |
| L2-T2 | No nodeIntegration | `window.evaluate(() => typeof window.require)` returns `'undefined'` |
| L2-T3 | Window.open blocked | `window.evaluate(() => { window.open('https://evil.example'); return true })` returns true AND a log line `[security] blocked window.open` is emitted within 1s |
| L2-T4 | Malformed IPC rejected | Calling invoke with a wrong payload type resolves with `{ error: string }` and no uncaught exception in main |
| L2-T5 | CSP in place | The renderer's `document.head` contains a `meta[http-equiv="Content-Security-Policy"]` element |
| L2-T6 | IPC handler registration | All handlers are registered before `app.ready` resolves (verified by checking channel list) |

Acceptance bar: L2-T1 through L2-T6 all pass. All 5 Given/When/Then from poc-plan.md covered.

---

### L3 — Storage & Native I/O

| ID | Behavior | Measurable Form |
|----|----------|----------------|
| L3-T1 | Atomic journal write | `journal:append` IPC → file exists at `userData/journal.json` within 500ms; read-back matches written entry |
| L3-T2 | File dialog cancel | When dialog is cancelled, `result.canceled === true` and `result.filePaths.length === 0` |
| L3-T3 | Drag-drop path | After simulated drop, `getFilePath()` returns a non-empty string matching the source file path |
| L3-T4 | Quit flush | `app.quit()` triggers `before-quit` which flushes any pending write; subsequent file read is consistent |
| L3-T5 | Menu accelerator | `Cmd+Q` triggers the "Quit" menu item handler in main process (observable via log) |
| L3-T6 | userData path correct | `app.getPath('userData')` path exists on disk after app starts |

Acceptance bar: L3-T1 through L3-T6 all pass. File dialog tests may require macOS runner.

---

### L4 — Deep macOS System Integration

All 9 behavioral tests from poc-plan.md must pass:

| ID | Behavior | Measurable Form |
|----|----------|----------------|
| L4-T1 | Tray created on ready | After `app.whenReady()`, `tray !== null` AND `tray.isDestroyed() === false` |
| L4-T2 | Tray state updates | After IPC toggle, `tray.getTitle()` returns new state string within one event-loop tick |
| L4-T3 | Notification action (blocked unsigned) | `notification.failed` event fires with a logged error; test documents "expected in unsigned build" |
| L4-T4 | globalShortcut registered | `globalShortcut.register(accelerator, handler)` returns `true` OR logs "shortcut taken" if false |
| L4-T5 | powerMonitor suspend | Programmatically emit `suspend` → registered listener marks state `'paused'` AND logs event |
| L4-T6 | Deep link routing | `app.emit('open-url', {}, 'electron-l4://action?x=1')` → action `'action'` with `x:'1'` dispatched to handler |
| L4-T7 | Auto-launch query | `getLoginItemSettings().openAtLogin` returns a boolean (not undefined); status logged |
| L4-T8 | nativeTheme IPC | `nativeTheme.themeSource = 'dark'` → `nativeTheme.updated` fires → IPC pushes `{ dark: true }` to renderer |
| L4-T9 | Shortcuts unregistered on quit | After `will-quit`, `globalShortcut.isRegistered(accelerator)` returns `false` |

Acceptance bar: L4-T1, T2, T4–T9 pass. L4-T3 documents expected failure with error logged (not counted as failure).

---

### L5 — Packaging, Code Signing, Auto-Update

| ID | Behavior | Measurable Form |
|----|----------|----------------|
| L5-T1 | DMG produced | `npm run make` exits 0; `out/make/` contains a `.dmg` file for current arch |
| L5-T2 | ZIP produced | `out/make/` contains a `.zip` file for current arch |
| L5-T3 | Packaged app boots | Launching the binary from `out/` produces a main window; no unhandled exception in first 10s |
| L5-T4 | Unsigned build skips signing | Forge run without `APPLE_IDENTITY` logs "signing skipped" and produces an unsigned artifact |
| L5-T5 | simulated-signing.md produced | The file exists with ≥5 lines documenting production codesign/notarize flow |
| L5-T6 | Update check fires | With local fixture server running, `autoUpdater.checkForUpdates()` fires `update-available` within 5s |
| L5-T7 | crashReporter initialized | Log line `[crash] crashReporter started` appears in app log before `app.ready` |

Acceptance bar: L5-T1 through L5-T7 all pass. L5-T4 explicitly verifies graceful unsigned flow. L5-T6 may require `forceDevUpdateConfig = true`.

---

### Capstone — "Pulse"

| ID | Behavior | Measurable Form |
|----|----------|----------------|
| C-T1 | Menu-bar only, no dock icon | `app.dock.isVisible()` returns false after boot |
| C-T2 | Focus session starts via shortcut | After global shortcut fire, session state = `'running'`; tray title contains remaining time |
| C-T3 | Sleep pause/resume | programmatic `suspend` → state = `'paused'`; `resume` → state = `'running'`; elapsed excludes sleep interval |
| C-T4 | Notification +5min | programmatic notification action `'+5min'` → `remainingMs()` increases by 300_000ms |
| C-T5 | Deep link journal append | `pulse://log?text=hello` → SQLite row exists with `text='hello'`; confirmation notification shown |
| C-T6 | Journal persistence across restart | Quit app; relaunch; `db.prepare('SELECT COUNT(*) AS n FROM entries').get().n` matches pre-quit count |
| C-T7 | Touch ID gate (or fallback) | `promptTouchID()` resolves OR throws with expected error type → fallback passphrase prompt shown |
| C-T8 | safeStorage encrypt/decrypt round-trip | `encryptString('secret')` returns a Buffer; `decryptString(buffer)` returns `'secret'` |
| C-T9 | DMG produces menu-bar app | `npm run make` → `.dmg` launches → no dock icon visible |
| C-T10 | Playwright boot | `electron.launch()` → `electronApp.evaluate(({ app }) => app.isReady())` returns `true` within 30s |

Acceptance bar: C-T1 through C-T6, C-T8, C-T10 must pass. C-T7 documented as "Touch ID or fallback active." C-T9 is a manual verification step.

---

## 3. Quality Gate Criteria

### Gate 1: Research Quality Gate

- [ ] ≥15 research files exist in `01_research/` (DONE: 23)
- [ ] Official Electron docs reviewed (DONE: S1, S2, S3, S4 cited throughout)
- [ ] Setup documented (`../01_research/16-packaging-electron-forge.md`)
- [ ] Security model documented (`../01_research/05-security-model.md`)
- [ ] Testing model documented (`../01_research/20-testing-strategies.md`)
- [ ] Observability documented (`../01_research/19-crash-reporting-and-observability.md`)
- [ ] Failure modes documented (`../01_research/21-failure-modes.md`, 15 modes)
- [ ] Open questions listed (`../01_research/23-open-questions.md`, 11 questions)

### Gate 2: POC Quality Gate

- [ ] All 6 POCs selected intentionally (poc-selection.md scoring complete)
- [ ] Tests written before implementation (git commit timestamps prove test precedes implementation)
- [ ] Behavioral tests exist for every POC (all Given/When/Then from poc-plan.md covered)
- [ ] Structured logs emitted by every POC
- [ ] Commands recorded in each POC's `commands.md`
- [ ] Failures and surprises recorded per POC
- [ ] Behavioral evidence exists: test output with ≥1 passing test per POC

### Gate 3: Distillation Quality Gate

- [ ] `05_distillation/gotchas.md` has ≥8 entries (one per documented failure mode)
- [ ] `05_distillation/patterns.md` covers IPC, storage, tray, security patterns
- [ ] `05_distillation/anti-patterns.md` covers ≥5 anti-patterns (nodeIntegration, local Tray var, etc.)
- [ ] `05_distillation/debugging-playbooks.md` covers ≥5 failure modes
- [ ] `05_distillation/testing-playbooks.md` references vitest + Playwright setup
- [ ] `05_distillation/observability-playbooks.md` references electron-log conventions
- [ ] `05_distillation/before-you-build.md` has ≥10 "must-know" items
- [ ] Every distillation claim cites a POC or log entry

### Gate 4: Skill Pack Quality Gate

- [ ] `06_skill_pack/index.md` references all lessons, labs, recipes, checklists
- [ ] `06_skill_pack/quickstart.md` covers: install, first run, first test, first log, first verification
- [ ] `06_skill_pack/agent-instructions.md` uses direct imperative language ("do this / not that")
- [ ] `06_skill_pack/lessons/` contains ≥5 lesson files
- [ ] `06_skill_pack/labs/` contains ≥3 lab files
- [ ] `06_skill_pack/recipes/` contains ≥3 recipe files
- [ ] `06_skill_pack/checklists/` contains ≥3 checklists
- [ ] `06_skill_pack/troubleshooting/` contains ≥3 guides

### Gate 5: Evidence Quality Gate

- [ ] `07_evaluation/final-report.md` distinguishes verified facts from assumptions (uses "VERIFIED" / "ASSUMED" / "UNVERIFIED" labels)
- [ ] Test results are recorded with pass/fail counts in `04_logs/test-results.md`
- [ ] Command outputs or summaries are in `04_logs/command-log.md`
- [ ] Expectation-gap ledger has ≥3 real entries with evidence
- [ ] Known limitations are explicit in `07_evaluation/known-limitations.md`
- [ ] No passing test claims behavior that was not actually exercised (verified by cross-checking test IDs against POC behavioral test IDs)
