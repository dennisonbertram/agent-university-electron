# Conventions — Electron

Writing, code, and process conventions that apply across the repo.

## Writing

- Audience is autonomous LLM coding agents. Prefer concise, declarative statements over prose narrative.
- Every claim must be verifiable from a cited POC, log entry, or research file. Use inline references: `(evidence: 04_logs/expectation-gap-ledger.md#entry-7)`.
- Use Given/When/Then framing for behavior descriptions.
- Avoid marketing language. State limitations as plainly as capabilities.

## Code

- **TypeScript everywhere.** No plain JavaScript. `tsconfig.json` per POC; strict mode on.
- File-per-concern in the main process: `main.ts`, `windows.ts`, `ipc.ts`, `tray.ts`, `notifications.ts`, `shortcuts.ts`, `storage.ts`, `updater.ts`.
- Preload script: a single `preload.ts` that re-exports a typed API. Renderer imports the type via a `.d.ts` declaration.
- Renderer code is a normal web app (HTML + TS); no `require`, no Node APIs.
- Prefer `import` over `require`. Use `import type` for type-only imports.
- Prefer named exports.
- Every public function in the main process has a one-line JSDoc explaining what it does and any IPC channel it owns.

## Security

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` in every BrowserWindow.
- Strict CSP meta tag in every HTML file (no `unsafe-inline` or `unsafe-eval`).
- `will-navigate` and `setWindowOpenHandler` blocking external navigations by default.
- Validate every IPC message arg before acting on it. Never `eval` IPC payloads.
- No secrets in renderer. Tokens live in main process, accessed via IPC.
- Use `safeStorage` for sensitive local data.

## Tests

- Co-locate tests under `tests/` inside each POC, or beside source as `*.test.ts`.
- Behavioral tests use Given/When/Then naming.
- Capstone uses Playwright with `_electron` for e2e.
- Negative tests required for every error path triggerable by user input or OS state.
- Capture command and output in `04_logs/test-results.md`.

## IPC Channel Naming

- `verb:noun` form, namespaced: `app:get-version`, `journal:append`, `focus:start`, `focus:stop`.
- Document every channel in the POC README's "IPC Surface" section.

## Commits

- Conventional commits: `phase(scope): subject`.
  - Examples: `phase-1(research): document tray template image behavior`, `phase-6(L4): green — global shortcut roundtrip test passes`.
- Reference POC level (L1–L5, capstone) in the scope.

## Doc Library Lookups

- Use `npx ctx7@latest library "Electron" "<question>"` then `npx ctx7@latest docs <id> "<question>"` for current Electron docs.
- Never rely on training data for current API surface. Verify every API reference against ctx7 output or the official site.
