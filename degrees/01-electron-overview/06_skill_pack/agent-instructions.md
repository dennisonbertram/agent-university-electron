# Agent Instructions — How to Use This Skill Pack

You are an autonomous LLM coding agent. This file tells you when to read what.

## Decision Tree — What to Read First

```
Am I building a new Electron app from scratch?
  YES → Read quickstart.md, then curriculum.md Phase 1
  NO  →
    Am I debugging a runtime error or unexpected behavior?
      YES → Go to troubleshooting/index.md — find your symptom
      NO  →
        Am I adding a specific feature?
          YES → Find the relevant lesson, then the relevant recipe
          NO  →
            Am I preparing to package and ship?
              YES → Read lessons/08-09-10 + checklists/production-readiness-checklist.md
              NO  → Read curriculum.md and pick your entry point
```

## When in Doubt

When you are unsure about anything Electron-related:

1. Read [curriculum.md](./curriculum.md) to orient
2. Read [quickstart.md](./quickstart.md) for the minimal working baseline
3. Read the relevant lesson (lessons/01 through 12)
4. If you hit a runtime error, go to [troubleshooting/index.md](./troubleshooting/index.md) first — it links to detailed playbooks

## Task-to-File Mapping

| Task | Primary Files |
|---|---|
| Starting a new app | quickstart.md, lessons/01, lessons/02, lessons/03 |
| Setting up IPC | lessons/03, recipes/recipe-ipc-handler-with-validator.md |
| Secure BrowserWindow | lessons/02, recipes/recipe-secure-window.md |
| Tray icon | lessons/06, recipes/recipe-tray-with-template-image.md |
| Notifications | lessons/06, recipes/recipe-notification-with-failed-listener.md |
| Global shortcuts | lessons/06, recipes/recipe-global-shortcut-with-cleanup.md |
| Deep links | lessons/06, recipes/recipe-deep-link-handler.md |
| SQLite storage | lessons/04, recipes/recipe-better-sqlite3-with-auto-unpack.md |
| Encryption at rest | lessons/04, recipes/recipe-safestorage-encryption.md |
| Touch ID | lessons/06, recipes/recipe-touch-id-with-fallback.md |
| Packaging (Forge) | lessons/08, recipes/recipe-forge-config-with-fuses.md |
| Code signing | lessons/09, checklists/packaging-checklist.md |
| Auto-update | lessons/10, recipes/recipe-electron-updater-generic-provider.md |
| Crash reporting | lessons/11, recipes/recipe-crashreporter-pre-ready.md |
| Logging | lessons/11, recipes/recipe-structured-jsonl-logger.md |
| Writing tests | lessons/12, recipes/recipe-playwright-electron-launch.md |
| Test seams for OS events | lessons/12, recipes/recipe-test-seam-ipc-channel.md |
| Power monitor | lessons/06, recipes/recipe-power-monitor-aware-timer.md |
| Single-instance | lessons/07, recipes/recipe-single-instance-lock.md |
| Menu bar only (no Dock) | lessons/06, recipes/recipe-app-dock-hide-menu-bar-only.md |
| Context menu | recipes/recipe-context-menu-on-renderer.md |
| Application menu | recipes/recipe-application-menu-template-macos.md |
| Passphrase fallback | recipes/recipe-pbkdf2-passphrase.md |
| Drag-drop file paths | reference/api-cheatsheet.md (webUtils section) |
| Electron 30/32/35 upgrades | reference/electron-version-compatibility.md |
| White screen | troubleshooting/white-screen.md |
| Native module error | troubleshooting/native-module-load-failure.md |
| Deep link not firing | troubleshooting/deep-link-not-firing.md |
| Tray icon disappears | troubleshooting/tray-icon-disappears.md |
| Notification silent | troubleshooting/notification-not-displaying.md |
| Updater not checking | troubleshooting/electron-updater-not-checking.md |
| Packaged app won't launch | troubleshooting/packaged-app-wont-launch.md |
| Code signing failure | troubleshooting/code-signing-failure.md |
| IPC validation error | troubleshooting/ipc-validation-error-shape.md |

## Citation Style

When you write code or documentation that uses patterns from this skill pack, cite the relevant skill-pack file:

```
// Evidence: skill_pack/recipes/recipe-secure-window.md
// Evidence: skill_pack/lessons/02-secure-renderer-defaults.md
```

Do not cite raw distillation or research paths to end-users. Those are internal evidence chains.

## Escalation Paths

**If you are stuck and the skill pack does not answer your question:**

1. Check [reference/electron-version-compatibility.md](./reference/electron-version-compatibility.md) — your issue may be a version-specific breaking change
2. Check [reference/glossary.md](./reference/glossary.md) — verify your terminology is correct
3. The raw research files are at `../../01_research/` — 24 files covering every API surface
4. The distillation open questions are at `../../05_distillation/open-questions.md`

**If you encounter a runtime behavior not documented here:**

Check whether it is a signed vs. unsigned behavior. Many macOS features (notifications, deep links, Touch ID) behave differently when the app is unsigned. The table at [lessons/06-macos-system-integration.md](./lessons/06-macos-system-integration.md) covers which features work unsigned.

## Common Agent Mistakes to Avoid

1. **Do NOT set `nodeIntegration: true`** — it is a security regression with no valid use case
2. **Do NOT put `require()` in preload.ts under `sandbox: true`** — it silently aborts the preload (G-01)
3. **Do NOT assign Tray to a function-local variable** — V8 GC collects it within seconds (G-06)
4. **Do NOT call `crashReporter.start()` inside `whenReady`** — renderers spawned before start are not monitored
5. **Do NOT call `requestSingleInstanceLock()` inside `whenReady`** — too late
6. **Do NOT expose `ipcRenderer` directly through `contextBridge`** — expose a wrapper object only
7. **Do NOT use `file.path`** for drag-drop (Electron 32+) — use `webUtils.getPathForFile(file)` via preload

## Pre-flight Check for Production

Before shipping, walk through:
- [checklists/security-checklist.md](./checklists/security-checklist.md)
- [checklists/production-readiness-checklist.md](./checklists/production-readiness-checklist.md)

Both have verify-how columns. Every item must pass.

Back to [index.md](./index.md)
