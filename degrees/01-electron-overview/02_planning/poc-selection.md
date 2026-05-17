# POC Selection — 01-electron-overview

Scoring each POC against doctrine criteria (1=low, 5=high). Weights reflect the macOS-integration emphasis of this degree. Evidence: `../01_research/00-research-index.md`, `../00_metadata/poc-plan.md`.

---

## Scoring Criteria Definitions

| Criterion | What "5" Means |
|-----------|----------------|
| Coverage of major surfaces | POC exercises ≥5 distinct Electron API surfaces |
| Gotcha-likelihood / learning value | High probability of revealing expectation gaps not visible in docs |
| Integration value with other POCs | Other POCs inherit this POC's code or patterns |
| Testing value | POC drives test patterns that carry forward throughout the degree |
| Observability value | POC reveals what must be logged to understand Electron app behavior |
| Deployment value | POC exercises packaging, signing, or distribution concerns |
| Feasibility within time budget | 5=straightforward, 1=extremely complex |

---

## L1 — Hello Electron

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Coverage of major surfaces | 2 | Covers only: main process, BrowserWindow, basic renderer, devtools, hot reload |
| Gotcha-likelihood / learning value | 3 | Forge template defaults are opinionated; hot reload uses non-obvious Vite+Electron process restart; macOS close-but-keep-alive is a common wrong assumption |
| Integration value | 5 | All subsequent POCs inherit the project skeleton, tsconfig, forge.config, package.json |
| Testing value | 4 | Establishes vitest + Playwright config; first Given/When/Then template; test runner integration |
| Observability value | 2 | Minimal logging; establishes electron-log stub only |
| Deployment value | 1 | No packaging in L1 |
| Feasibility | 5 | Well-documented; minimal surface area; lowest risk |
| **Total weighted score** | **22/35** | |

**Rationale**: L1 is the foundation. Its score on coverage and deployment is intentionally low — that is by design. Its inheritance value (5) and feasibility (5) justify its position. Without L1, nothing else can be built. Every agent reading this degree starts here.

---

## L2 — Secure IPC

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Coverage of major surfaces | 3 | Covers: contextBridge, contextIsolation, sandbox, CSP, will-navigate, setWindowOpenHandler, invoke/handle, IPC validation |
| Gotcha-likelihood / learning value | 5 | Security misconfiguration is the #1 Electron LLM failure. Sandbox + preload interaction (FM-03) is non-obvious. contextBridge serialization (FM-14) surprises every developer. CSP vs. inline scripts is a common blocker. |
| Integration value | 5 | L3, L4, L5, capstone all inherit L2's preload.ts, ipc.ts, security hardening. No subsequent POC regresses security. |
| Testing value | 5 | IPC testing patterns (dependency injection, vitest mocks, Playwright evaluate) established here carry forward to every level |
| Observability value | 3 | IPC entry/exit logging pattern established here |
| Deployment value | 1 | No packaging in L2 |
| Feasibility | 4 | No native modules; some subtlety in sandbox+preload interaction |
| **Total weighted score** | **26/35** | |

**Rationale**: L2 scores second-highest among standalone POCs because it establishes the security and IPC patterns that every subsequent level inherits. The learning value is highest here — security misconfiguration is silently catastrophic and LLMs commonly get it wrong.

---

## L3 — Storage & Native I/O

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Coverage of major surfaces | 3 | Covers: userData, atomic writes, dialog, drag-drop, file watcher, application menu |
| Gotcha-likelihood / learning value | 4 | native module ABI mismatch (FM-02/R-01) is highly likely here; userData path differences packaged vs unpackaged; dialog behavior differences; File.path removal (FM-15/R-07) |
| Integration value | 4 | SQLite + storage pattern reused in capstone; atomic-write pattern reused in L4 state persistence; menu pattern carried forward |
| Testing value | 3 | Dialog mocking, file I/O testing patterns established |
| Observability value | 3 | Storage write/read logging with byte sizes; file watcher event logging |
| Deployment value | 2 | First POC to add better-sqlite3 (native module rebuild exercises Forge integration) |
| Feasibility | 3 | Native module rebuild adds complexity; dialog tests require macOS runner |
| **Total weighted score** | **22/35** | |

**Rationale**: L3 is the "integration seam" level where native modules first appear. The gotcha density is high (ABI, File.path, asar unpacking). Its storage patterns are foundational for the capstone.

---

## L4 — Deep macOS System Integration ★

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Coverage of major surfaces | 5 | Covers: Tray, Notification, globalShortcut, powerMonitor, app lifecycle, deep links, Dock, auto-launch, nativeTheme, recent docs — 10 surfaces |
| Gotcha-likelihood / learning value | 5 | Every surface has at least one non-obvious behavior: Tray GC (FM-04), notification signing (FM-05), deep link packaged-only (FM-06), shortcut collision (FM-10), auto-launch requires-approval (FM-09) |
| Integration value | 4 | L5 packages the L4 shell; capstone inherits all L4 modules |
| Testing value | 4 | Most complex test setup; Playwright evaluate trick for deep links; powerMonitor event simulation |
| Observability value | 5 | Every subsystem requires structured logging: power events, tray state transitions, shortcut registration, notification outcomes |
| Deployment value | 3 | Deep links and notifications require packaged app; first opportunity to test ad-hoc signing |
| Feasibility | 2 | Most complex standalone POC; 9 behavioral tests; multiple macOS-specific APIs |
| **Total weighted score** | **28/35** | |

**Rationale**: L4 is the centerpiece of the degree. It scores highest among standalone POCs because it exercises the macOS-specific surfaces that are the primary reason this degree exists. The learning value and observability value are maximal. Feasibility is low — this level is the most likely to surface open questions.

---

## L5 — Packaging, Code Signing, Auto-Update

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Coverage of major surfaces | 3 | Covers: Forge makers (DMG, ZIP), universal binary, hardened runtime, code signing (simulated), notarization (simulated), electron-updater, crashReporter |
| Gotcha-likelihood / learning value | 5 | Auto-update silent failure (FM-11), native module universal binary (OQ-04), notarization flow complexity (R-12), crashReporter ordering (FM-12) — all high-value discoveries |
| Integration value | 3 | L5 wraps L4; packaging lessons carry directly to capstone |
| Testing value | 3 | Local update fixture server; smoke test of packaged binary; crash sink |
| Observability value | 3 | Update state machine logging; crash report submission; signing decision logging |
| Deployment value | 5 | THE deployment-focused level; first real artifact production |
| Feasibility | 2 | HTTPS server requirement for real updater test; signing requires workarounds; universal binary rebuild adds complexity |
| **Total weighted score** | **24/35** | |

**Rationale**: L5 has the highest deployment value in the degree and surfaces the highest-impact production gotchas. Its low feasibility score reflects real friction — but that friction IS the learning value. Every agent that ships an Electron app will encounter these obstacles.

---

## Capstone — "Pulse"

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Coverage of major surfaces | 5 | Covers ALL surfaces from L1–L5 PLUS: SQLite (better-sqlite3), safeStorage, Touch ID, Playwright e2e, complete menu-bar-only app lifecycle |
| Gotcha-likelihood / learning value | 5 | All prior gotchas surface again in integration; new ones: popover positioning, safeStorage Keychain scoping (OQ-10), Touch ID entitlements (OQ-05), SQLite universal binary (OQ-04) |
| Integration value | 5 | The reference implementation every future agent studies; combines all prior POC patterns |
| Testing value | 5 | First Playwright full e2e; first behavioral test of packaged binary; first Touch ID mock injection |
| Observability value | 5 | Full structured logging across all subsystems; debug menu opening log viewer; crashReporter to local sink |
| Deployment value | 4 | Produces packaged DMG; notarization simulated; updater exercised against fixture |
| Feasibility | 1 | Intentionally the hardest level; 10 behavioral tests; multiple open questions; integration risk |
| **Total weighted score** | **30/35** | |

**Rationale**: The capstone has the highest total score precisely because it integrates everything. Its feasibility is 1 — this is by design. The capstone's difficulty is the mechanism by which the degree validates that all prior learnings can be synthesized into a working, polished application.

---

## Summary Scoring Table

| POC | Coverage | Gotcha | Integration | Testing | Observability | Deployment | Feasibility | Total |
|-----|----------|--------|-------------|---------|---------------|------------|-------------|-------|
| L1 Hello Electron | 2 | 3 | 5 | 4 | 2 | 1 | 5 | 22 |
| L2 Secure IPC | 3 | 5 | 5 | 5 | 3 | 1 | 4 | 26 |
| L3 Storage & I/O | 3 | 4 | 4 | 3 | 3 | 2 | 3 | 22 |
| L4 macOS Integration | 5 | 5 | 4 | 4 | 5 | 3 | 2 | 28 |
| L5 Packaging | 3 | 5 | 3 | 3 | 3 | 5 | 2 | 24 |
| Capstone Pulse | 5 | 5 | 5 | 5 | 5 | 4 | 1 | **30** |

The progression is internally consistent:
- L1 and L3 tie at 22 (scaffolding roles; value is foundational, not intrinsic)
- L2 scores 26 (security patterns propagate to every subsequent level)
- L5 scores 24 (deployment focus is specialized; lower integration than L4)
- L4 scores 28 (macOS integration is the degree's primary thesis)
- Capstone scores 30 (synthesis of everything; hardest; most valuable reference)

---

## Alternatives Considered and Rejected

### Multi-window POC
- **Considered**: A dedicated POC for managing multiple BrowserWindows (settings window, modal, secondary view).
- **Rejected because**: L4 already exercises multi-context behavior via the Tray (creates a popover window), the main window, and potential dialog windows. The capstone exercises a debug log viewer as a secondary window. A standalone multi-window POC would add 2 weeks of build time for marginal incremental learning. The `WebContentsView` migration (FM-13) is documented as an expectation gap without requiring its own POC.

### Drag-and-Drop / Media Handler POC
- **Considered**: A POC focused on media file handling (video player, image gallery).
- **Rejected because**: File.path removal (FM-15) and drag-drop path handling are covered in L3. A media-specific POC would be macOS-adjacent but doesn't exercise novel Electron surfaces. Out of scope per command-intent.md.

### Cross-Platform POC (Windows + Linux)
- **Considered**: A POC that explicitly exercises Windows-specific (NSIS, Squirrel) and Linux-specific (AppImage, Snap) behavior.
- **Rejected because**: command-intent.md explicitly scopes to macOS-first. Cross-platform notes are captured in research files but not POC'd.

### Electron + React Renderer POC
- **Considered**: A POC using React (or Vue) in the renderer to exercise the framework integration.
- **Rejected because**: The renderer framework is not the degree's focus — Electron's main-process APIs are. The capstone renderer is intentionally minimal (vanilla TS) to avoid framework overhead obscuring the Electron-specific patterns being learned.

### Crash-First / Fault-Injection POC
- **Considered**: A POC that intentionally triggers each failure mode (white screen, ABI mismatch, etc.) to build debugging playbooks.
- **Rejected because**: Failure modes are better documented as negative test cases within each level's behavioral test suite. A standalone fault-injection POC risks instability in CI. The failure-mode documentation in `../01_research/21-failure-modes.md` provides the playbook foundation without needing a dedicated POC.

---

## Refinements vs. Initial poc-plan.md

The following deltas emerged from Phase 1 research. Each refinement cites evidence.

### REF-01: Deep Link Strategy (L4 + Capstone)

**Initial plan**: Use `open-url` event to receive deep links in L4.

**Refinement**: `open-url` fires ONLY in packaged apps registered with Launch Services (FM-06). For L4 dev-mode testing, use Playwright's `electronApp.evaluate(() => app.emit('open-url', ..., url))` to simulate the event programmatically. The pure URL-parsing logic is unit-tested separately. Real `open-url` end-to-end is deferred to L5/capstone where packaging is exercised.

**Evidence**: `../01_research/21-failure-modes.md` FM-06; `../01_research/11-deep-links-protocol.md`.

---

### REF-02: BrowserView → WebContentsView

**Initial plan**: poc-plan.md did not specify whether to use BrowserView or WebContentsView for any in-window embedded content.

**Refinement**: If any POC requires a secondary embedded content view (e.g., capstone debug log viewer or popover), use `WebContentsView` inside a `BaseWindow`. Never use `BrowserView` — deprecated since Electron 30 (FM-13).

**Evidence**: `../01_research/21-failure-modes.md` FM-13; `../01_research/22-version-compatibility.md`.

---

### REF-03: File Path in Drag-Drop (L3)

**Initial plan**: poc-plan.md described drag-drop returning file paths to main process.

**Refinement**: The renderer MUST use `webUtils.getPathForFile(file)` exposed via contextBridge — NOT `file.path` (removed in Electron 32, FM-15). The behavioral test for L3 must explicitly assert that `window.api.getFilePath(file)` returns a valid path (not `undefined`).

**Evidence**: `../01_research/21-failure-modes.md` FM-15; `../01_research/22-version-compatibility.md`.

---

### REF-04: Notification Tests (L4)

**Initial plan**: Behavioral test for notifications assumes delivery is observable.

**Refinement**: Notification delivery is BLOCKED in unsigned dev builds (FM-05, R-02). The L4 notification test must be redesigned:
- Unit test: assert `Notification` constructor called with correct args (mock).
- Behavioral test: assert `notification.failed` event fires and is logged — this is the EXPECTED behavior in unsigned builds, not a test failure.
- Integration note: real delivery tested via ad-hoc signed build, result documented in POC report.

**Evidence**: `../01_research/21-failure-modes.md` FM-05; `../01_research/23-open-questions.md` OQ-01.

---

### REF-05: Package Manager (all POCs)

**Initial plan**: poc-plan.md did not specify package manager; command-intent.md says "decide bun vs npm during Phase 1."

**Refinement**: Use npm throughout. Bun's native module support (node-gyp) is incomplete as of May 2026, making it incompatible with better-sqlite3 + `@electron/rebuild`. pnpm hoisting issues with native modules are documented community concerns.

**Evidence**: `../01_research/22-version-compatibility.md` (Package Manager Compatibility Note section).

---

### REF-06: L4 powerMonitor event simulation

**Initial plan**: poc-plan.md test "Given powerMonitor's suspend fires, when received, then..." implies an OS event.

**Refinement**: Real OS sleep cannot be reliably triggered in automated tests. Use `powerMonitor.emit('suspend')` in test mode to simulate the event programmatically. Verify in L4 implementation notes that the event handler is registered correctly and the simulation works. Document that production behavior is confirmed only manually.

**Evidence**: `../01_research/10-power-monitor.md`; `../01_research/20-testing-strategies.md` (Mocks vs reality section).

---

### REF-07: console-message event.level type change

**Initial plan**: Not in initial poc-plan; emerged from research.

**Refinement**: In `win.webContents.on('console-message', event => ...)`, `event.level` is a STRING (`'info'` | `'warning'` | `'error'`) since Electron 35 — NOT a number. Any renderer→main log forwarding code must use string comparisons, not numeric comparisons. Add a test that verifies the level type.

**Evidence**: `../01_research/19-crash-reporting-and-observability.md` (Console Logging from Renderer section); `../01_research/22-version-compatibility.md` (Electron 34/35 breaking changes).
