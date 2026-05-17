# Final Report — Electron Degree 01-electron-overview

Completed: 2026-05-17. All six POCs reached their REGRESSION commit.
All behavioral and regression tests pass on macOS 15.7.7 / arm64 with Electron 42.1.0 / Node 24.15.0.

---

## Overview

This degree produced a complete, evidence-backed Electron skill pack through six
proof-of-concept apps, twelve expectation-gap entries, twelve distillation
decisions, eighteen distilled principles, 74 distillation files, and 82 skill-pack
files. The degree target is autonomous LLM coding agents that need to build
production-quality macOS Electron apps from scratch.

The research corpus covers every major Electron subsystem: the three-process model,
IPC security, storage and encryption, ten macOS-native surfaces (Tray, notifications,
globalShortcut, powerMonitor, deep links, autolaunch, nativeTheme, Touch ID, dock,
recent documents), packaging with electron-forge, code signing and notarization,
auto-update, crash reporting, and structured observability.

Six POCs progressed from a minimal Hello Electron smoke test through a fully packaged
"Pulse" menu-bar focus and journal companion. Every POC followed strict RED → GREEN →
REGRESSION TDD discipline, with verbatim test output captured in
`04_logs/test-results.md`.

Total elapsed time (all sessions): one calendar day (2026-05-17).

---

## Phase-by-Phase Summary

### Phase 0 — Initialize the Degree

**Deliverables**: `00_metadata/degree-metadata.md`, `assumptions.md`, `environment.md`,
`source-inventory.md`, `scope.md`.

**Learned**: The environment probe confirmed Electron 42.1.0 on arm64; the Apple
Developer credential gap was logged as an assumption up front, shaping every
packaging test as "simulated-signing." The early decision to document unsigned-dev
limitations explicitly as `@signed-only` tags prevented confusion throughout later
phases.

**Deviations**: A sixth metadata file (`poc-plan.md`) was created during Phase 0
reflecting the user's capstone specification; it bridges Phases 0 and 2.

**Evidence**: `00_metadata/degree-metadata.md`.

---

### Phase 1 — Deep Research

**Deliverables**: 23 research files in `01_research/`, including all 15 required by
the doctrine plus eight additional topic files (power monitor, dock/autolaunch,
Touch ID, safeStorage, native modules, crash reporting, version compatibility, and
open questions).

**Learned**:
- Electron's sandbox preload cannot `require()` relative files — a documentation
  gap that surfaces later as Expectation Gap 1 (L1 build).
- The signed-vs-unsigned capability split for macOS surfaces (Tray OK; notifications
  fail silently; deep links require packaging) was established in research and confirmed
  by every subsequent POC.
- `better-sqlite3` and Electron's bundled V8 are on independent version clocks; the
  research flagged this risk but could not quantify the ABI delta until the capstone hit
  V8 14.x compile errors.

**Deviations**: None material. Open-questions file (`23-open-questions.md`) seeded
with eleven items that drove the POC test surfaces.

**Evidence**: `01_research/00-research-index.md` (master file list).

---

### Phase 2 — Synthesize Before Building

**Deliverables**: `02_planning/degree-plan.md`, `risk-register.md`,
`success-criteria.md`.

**Learned**: The risk register correctly flagged native-module ABI drift, unsigned-dev
notification silencing, and autolaunch non-determinism as top risks — all three
materialized in the build phases. The success criteria table gave the evidence-auditor
a clear checklist; every measurable criterion was met by the time Phase 11 ran.

**Deviations**: None.

**Evidence**: `02_planning/risk-register.md`.

---

### Phase 3 — Select POCs

**Deliverables**: `02_planning/poc-selection.md`.

**Learned**: The six-POC progression (L1 = smoke, L2 = secure IPC, L3 = storage,
L4 = macOS deep integration, L5 = packaging, capstone = combined Pulse app) correctly
prioritized the surfaces where Electron surprises are densest. L4 alone surfaced six
distinct expectation gaps.

**Deviations**: None.

**Evidence**: `02_planning/poc-selection.md`.

---

### Phase 4 — Test Strategy

**Deliverables**: `02_planning/test-strategy.md`.

**Learned**: The Given/When/Then behavioral test format was adopted uniformly and
became the primary audit trail. The strategy's three-layer model (unit via Vitest,
behavioral/e2e via Playwright `_electron`, static/source-grep) proved effective at
covering surfaces that Playwright cannot drive with real OS events (power events,
notification action buttons, Touch ID prompts).

**Deviations**: None.

**Evidence**: `02_planning/test-strategy.md`.

---

### Phase 5 — Observability Strategy

**Deliverables**: `02_planning/observability-strategy.md`.

**Learned**: Synchronous JSON-lines logging (`appendFileSync`) is essential for
deterministic behavioral test assertions — electron-log's buffered writes would require
indeterminate sleeps. The `{ts, level, process, module, event, payload?}` schema was
established in Phase 5 and held unchanged through the capstone.

**Deviations**: `electron-log` (named in the strategy as the L4 target) was never
adopted; the hand-rolled logger proved sufficient through the capstone because the
capstone didn't need multi-transport or renderer-side forwarding.

**Evidence**: `02_planning/observability-strategy.md`.

---

### Phase 6 — Build POCs (TDD)

**Deliverables**: Six POC directories in `03_pocs/`, each with README, test-plan,
implementation, and poc-report. Full test audit trail in `04_logs/test-results.md`.

**Summary of test results**:

| POC | Vitest | Playwright BTs | Playwright Rs | Total Passing | Status |
|-----|--------|---------------|--------------|---------------|--------|
| L1  | 14/14  | 4/4           | 4/4          | 22            | PASS   |
| L2  | 24/24  | 9/9           | 4/4          | 37            | PASS   |
| L3  | 50/50  | 9/9           | 4/4          | 63            | PASS   |
| L4  | 98/98  | 12/12         | 6/6          | 116           | PASS   |
| L5  | 126/126| 9/9 + 1 skip  | 5/5          | 140 + 1 skip  | PASS   |
| Cap | 87/87  | 14/14         | 8/8          | 109           | PASS   |
| **Total** | **399** | **57** | **31** | **487** | **ALL PASS** |

BT-L5-4 (universal binary build) is the sole skip, tagged `@long-running` — the
forge config supports it; the build was not exercised.

**Learned**:
- Pre-ready boot ordering is more fragile than the docs suggest; every subsequent POC
  inherited the explicit `requestSingleInstanceLock` → `crashReporter.start()` →
  `setAsDefaultProtocolClient` → `app.whenReady()` ordering constraint.
- The two-ABI problem (`better-sqlite3` rebuilt for Electron cannot be loaded by
  system Node vitest) is solved by rebuilding per test class and routing DB inspection
  through an IPC seam.
- Programmatic test seams (`test:*` IPC channels gated by `NODE_ENV === 'test'` or
  an env flag) are the correct pattern for surfaces that require real OS interaction.

**Deviations**:
- electron-forge was introduced at L5 (not L1) to keep L1-L4 build graphs simple.
- esbuild was introduced at L2 (not L5) to solve the sandbox preload require problem.
- electron-log was never adopted; the hand-rolled logger was sufficient.

---

### Phase 7 — Behavioral Tests (embedded in Phase 6)

**Deliverables**: Behavioral test specs for all six POCs (part of Phase 6 output).

**Learned**: The three-layer test strategy (unit / e2e / static-source) caught a
category of regression that pure behavioral tests miss: structural invariants
(module-scope tray, pre-ready ordering, `will-quit` cleanup). R-L4-1 through R-L4-6
and R-C-4/5/7 are the clearest examples.

**Deviations**: None.

---

### Phase 8 — Packaging and Signing

**Deliverables**: `04_logs/deployment-log.md` (Attempts 1-3, covering L5, Capstone).

**Learned**: Forge's `packageAfterCopy` hook receives the staging dir, not the final
`.app` path. `packagerConfig.protocols` overrides rather than merges with
`extendInfo.CFBundleURLTypes`. The simulated-signing skip path is the correct model
for credential-free environments; the `simulated-signing.md` artifact provides the
exact command sequence a developer with creds would run.

**Deviations**: Real codesign / notarization was not exercised (no Apple Developer
account). The `@signed-only` tag convention documents these paths throughout the
skill pack.

---

### Phase 9 — Distillation

**Deliverables**: 74 files across `05_distillation/`. Structure:

```
distilled-principles.md    (18 principles)
gotchas/                   (18 gotcha files: G-01..G-18)
patterns/                  (18 pattern files: P-01..P-18)
anti-patterns/             (8 anti-pattern files: AP-01..AP-08)
before-you-build/          (3 files: BYB-01..BYB-03)
decision-records/          (12 files: DR-01..DR-12)
playbooks/                 (10 files: PB-01..PB-10)
production-readiness-checklist.md
security-checklist.md
open-questions.md
before-you-build.md        (root-level summary)
```

**Learned**: Distillation revealed that 12 of the 18 distilled principles were
directly traceable to expectation gaps or debugging sessions rather than docs — the
"documentation says X but reality is Y" ratio is higher for Electron than for most
platforms, driven primarily by the macOS unsigned-vs-signed capability split and the
V8 version mismatch in native modules.

**Deviations**: None.

---

### Phase 10 — Skill Pack

**Deliverables**: 82 files in `06_skill_pack/`. Structure:

```
README.md, index.md, quickstart.md, curriculum.md, agent-instructions.md
lessons/        (12 files: L01..L12)
labs/           (10 files)
recipes/        (23 files)
checklists/     (4 files)
troubleshooting/(9 files including index)
reference/      (6 files)
examples/       (6 files)
assessments/    (6 files)
```

**Learned**: The agent-instructions.md task-to-file mapping was the most important
navigability investment — it transforms a 82-file pack into a lookup table that an
autonomous agent can use without reading the entire pack first.

**Deviations**: None.

---

### Phase 11 — Evaluation (this phase)

**Deliverables**: This file plus `skill-pack-readiness.md`, `known-limitations.md`,
`future-work.md`.

---

## POC Summary Table

| POC | RED commit | GREEN commit | REGRESSION | Vitest | Playwright BTs | Playwright Rs | New EG entries | New Decisions |
|-----|------------|--------------|------------|--------|---------------|--------------|----------------|---------------|
| L1  | `09ebd88`  | `9661b22`    | (REGR)     | 14     | 4             | 4            | 2 (EG-1, EG-2) | 4 (D1-D4)     |
| L2  | `69a1499`  | `477565d`    | (REGR)     | 24     | 9             | 4            | 1 (EG-3)       | 2 (D5-D6)     |
| L3  | (RED)      | (GREEN)      | (REGR)     | 50     | 9             | 4            | 1 (EG-4)       | 3 (D7-D9)     |
| L4  | `4ae3e3b`  | `04bc083`    | (REGR)     | 98     | 12            | 6            | 2 (EG-5, EG-6) | 1 (D10)       |
| L5  | (RED)      | (GREEN)      | (REGR)     | 126    | 9 + 1 skip    | 5            | 5 (EG-7..11)   | 1 (D11)       |
| Cap | (RED)      | (GREEN)      | (REGR)     | 87     | 14            | 8            | 1 (EG-12)      | 1 (D12)       |

Key technical artifact produced per POC:

- **L1**: Structured JSON-lines logger (`log.ts`) + minimal 3-process architecture.
- **L2**: IPC registry with validators (`ipc.ts`), security guard module, esbuild preload bundling.
- **L3**: Atomic write-rename storage, dialog seam, `fs.watch` watcher with listing-diff.
- **L4**: Ten macOS native module integrations in one app (tray, notifications, shortcuts, powerMonitor, open-url, autolaunch, nativeTheme, dock, recentDocuments, popover window).
- **L5**: electron-forge packaging shell with fuses, entitlements, simulated signing, `electron-updater` with local-fixture server, `crashReporter` pre-ready wiring.
- **Capstone**: Full Pulse menu-bar app: focus engine + journal-store (SQLite + safeStorage + PBKDF2) + Touch ID with env-flag seam + per-state tray + notifications + shortcuts + power events + deep links + autolaunch + theme + packaged with `AutoUnpackNativesPlugin` and `better-sqlite3` V8 14.x patch.

---

## Quality Gates Assessment

### Research Quality Gate

**Status: PASS** (cleared by evidence-auditor pre-Phase 6).

- 23 research files exist, all non-empty with source citations.
- Setup, configuration, security, testing, observability, failure modes, and open
  questions are all documented.
- Every research file uses `[S-N]` citation style pointing to `source-inventory.md`.

Evidence: `01_research/00-research-index.md`.

### POC Quality Gate

**Status: PASS**

- All six POCs followed RED → GREEN → REGRESSION discipline.
- Every POC has README, test-plan, implementation, and poc-report.
- Behavioral tests are written in Given/When/Then style before implementation.
- All 57 behavioral tests and 31 regression tests pass.
- The one skip (BT-L5-4) is `@long-running`-tagged with justification.
- Failures were recorded in logs before fixes were applied.
- Expectation gaps were logged immediately when encountered.

Evidence: `04_logs/test-results.md`; each POC's `poc-report.md`.

### Distillation Quality Gate

**Status: PASS**

- 18 gotchas documented with diagnostics and regression test pointers.
- 18 patterns documented with production code examples.
- 8 anti-patterns documented with "what breaks" explanations.
- 10 debugging/testing/observability/packaging playbooks.
- 3 "before you build" files covering upgrade notes, macOS deep integration, and
  production shipping checklist.
- Every distillation claim references a log entry, POC file, or research file.

Evidence: `05_distillation/distilled-principles.md` (18 principles with evidence
pointers); `05_distillation/gotchas/` (18 files).

### Skill Pack Quality Gate

**Status: PASS**

- Index, quickstart, curriculum, agent-instructions all present.
- 12 lessons, 10 labs, 23 recipes, 4 checklists, 9 troubleshooting guides,
  6 reference files, 6 example pointers, 6 assessments.
- The `agent-instructions.md` task-to-file mapping enables an autonomous agent to
  navigate the pack without reading raw research.
- No skill-pack file references raw research paths as the primary citation.

Evidence: `06_skill_pack/index.md` (master file table); `06_skill_pack/README.md`.

### Evidence Quality Gate

**Status: PASS-WITH-WARNINGS** (per doctrine: flagged items below are openly documented)

Warnings:
- Code signing and notarization: documented in detail but not exercised against real
  Apple infrastructure. Paths are documented as simulated throughout the signing flow
  (the literal "@signed-only" tag is used in POC tests; the skill-pack documents these
  as "Skip Path (Dev / No Creds)" sections).
- Universal binary (BT-L5-4): config is verified correct; the multi-arch build was not
  run end-to-end.
- Real Touch ID prompt: tested via env-flag stub only; real biometric interaction
  requires human presence.
- Production autolaunch round-trip: non-deterministic on unsigned dev; deferred to a
  signed packaged build.

---

## Verified vs. Assumed

### Verified (with evidence)

| Claim | Evidence |
|-------|---------|
| Sandbox preload cannot `require()` relative files | EG-1; L1 poc-report; `05_distillation/gotchas/G-01` |
| `contextBridge` drops `Error.name` across IPC boundary | EG-3; L2 poc-report; BT-L2-5 |
| Tray instance must be module-scope or GC collects it | EG-6; L4 poc-report; R-L4-1 |
| `notification.show()` fails silently on unsigned dev | L4 poc-report BT-L4-3; `05_distillation/gotchas/G-07` |
| Deep links do not fire in unpackaged dev apps on macOS | L4 poc-report BT-L4-7; `01_research/11-deep-links-protocol.md` |
| `electron-updater` appends `?noCache=<token>` to feed URLs | EG-7; L5 poc-report; `05_distillation/gotchas/G-08` |
| `packagerConfig.protocols` overrides `extendInfo.CFBundleURLTypes` | EG-8; L5 poc-report; `05_distillation/gotchas/G-09` |
| `electron-updater` silently skips check in unpackaged mode without `forceDevUpdateConfig` | EG-9; L5 poc-report; `05_distillation/gotchas/G-10` |
| `better-sqlite3@12.10.0` fails to compile against Electron 42's V8 14.x | EG-12; capstone poc-report; debugging-log |
| Two-ABI problem: Electron-rebuilt native module cannot be loaded by system Node vitest | capstone poc-report; `04_logs/decision-log.md` D12 |
| `crashReporter.start()` must precede `app.whenReady()` to catch renderer crashes | L5 R-L5-1; `05_distillation/distilled-principles.md` #16 |
| Fuses (`RunAsNode:false`, `OnlyLoadAppFromAsar:true`, etc.) verified in packaged binary | L5 BT-L5-9 / R-L5-2; capstone R-C-5 |
| `AutoUnpackNativesPlugin` is required for `better-sqlite3` to load from asar | capstone BT-C-11; R-C-8 |
| `safeStorage.isEncryptionAvailable()` returns `true` on macOS dev with Keychain | capstone R-C-1 |

### Assumed (with location)

| Assumption | Location of assumption |
|------------|----------------------|
| Real code signing / notarization commands work as documented | `03_pocs/L5-packaging-signing-update/simulated-signing.md`; `06_skill_pack/lessons/09-code-signing-and-notarization.md` |
| `setLoginItemSettings` round-trips reliably on signed packaged builds | EG-5; `05_distillation/gotchas/G-05` |
| Universal binary (`--arch=universal`) produces a valid fat binary with both better-sqlite3 arches | capstone poc-report §"Universal binary"; `05_distillation/open-questions.md` OQ-04 |
| Touch ID entitlement in a hardened-runtime packaged build works with `promptTouchID` | `05_distillation/open-questions.md` OQ-05 |
| Auto-launch `type: 'mainAppService'` round-trips on macOS 14+ with a signed build | OQ-03 |
| Notarization completes in 1-3 minutes in 2026 (simulated-signing.md claim) | OQ-15; no real test run |

---

## Notable Findings

The ten most consequential discoveries for future agents:

1. **Sandbox preload module isolation is stricter than the docs imply.** Under
   `sandbox: true`, relative `require()` calls silently abort the preload without
   any console error. Always bundle the preload with esbuild (`external: ['electron']`)
   or inline constants and add a drift-detector unit test. (EG-1)

2. **Electron's IPC strips `Error.name`.** Only `Error.message` survives the
   `ipcMain.handle` → renderer journey AND the subsequent contextBridge clone step.
   Typed errors must be encoded as sentinel-prefix messages and reconstituted as plain
   objects in the preload. (EG-3; `05_distillation/gotchas/G-03`)

3. **The macOS signed-vs-unsigned capability split is wide.** Notifications,
   notification action buttons, deep links via `open-url`, and reliable auto-launch
   all require a signed packaged build. An agent building and testing on an unsigned
   dev binary will see silent failures on these surfaces. (L4 poc-report; `06_skill_pack/lessons/06-macos-system-integration.md`)

4. **Native modules and Electron's bundled V8 are on independent release clocks.**
   `better-sqlite3@latest` (12.10.0) could not compile against Electron 42's V8 14.x
   without source patches. Future agents must plan for a `postinstall` patch script
   and a per-test-class rebuild workflow. (EG-12; `05_distillation/gotchas/G-13`)

5. **Pre-ready boot ordering is load-bearing for four critical features.**
   `requestSingleInstanceLock`, `crashReporter.start`, `setAsDefaultProtocolClient`,
   and the `open-url` listener must all run BEFORE `app.whenReady()`. Wrapping
   boot in an async function breaks cold-launch deep links and second-instance
   routing silently. (`05_distillation/distilled-principles.md` #2; capstone R-C-4/5)

6. **`electron-updater` has two invisible defaults that break naive setups.**
   It appends `?noCache=<token>` to feed URL GETs (breaking `endsWith` path matching
   on local servers) and silently skips checks in unpackaged dev mode without
   `forceDevUpdateConfig = true`. (EG-7, EG-9; `05_distillation/gotchas/G-08`, G-10)

7. **`packagerConfig.protocols` in Forge does not merge with `extendInfo.CFBundleURLTypes`.**
   It replaces the array entirely. Extra URL-type metadata (role, icons) must be in
   `protocols` or `extendInfo` must exclusively own the key. (EG-8; G-09)

8. **Tray icon GC is the single most common silent Electron bug.**
   `const tray = new Tray(...)` inside a function is collected within seconds. Module-
   scope `let trayInstance: Tray | null = null` is required. Static regression tests
   (R-L4-1) are the reliable catch. (`05_distillation/gotchas/G-06`)

9. **Test-only IPC channels are a first-class testing pattern for macOS events.**
   powerMonitor suspend/resume, notification action buttons, Touch ID prompts,
   key-event-fired shortcuts, and second-instance events cannot be driven from
   Playwright. `test:*` IPC channels gated by `NODE_ENV === 'test'` provide 100%
   code-path coverage without requiring human interaction or real OS events. (D10, D12)

10. **`Notification.failed` must be wired BEFORE `.show()`.**
    On unsigned dev the OS rejects the notification before any action is taken; `failed`
    fires in the same tick as `.show()`. If you attach the listener after `.show()`, you
    race against the OS and miss the signal. There is no error log if you miss it.
    (`05_distillation/gotchas/G-07`)
