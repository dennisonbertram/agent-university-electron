# Troubleshooting Index

Quick reference: match the symptom you see to the cause and the dedicated file.

Back to [../index.md](../index.md)

---

## Symptom → Cause → File

| Symptom | Most Likely Cause | File |
|---|---|---|
| BrowserWindow loads white / blank screen | `loadFile` path wrong; CSP blocks JS; contextIsolation + nodeIntegration conflict | [white-screen.md](./white-screen.md) |
| `Error: Cannot find module '...'` for `.node` native | Not unpacked from asar; wrong ABI; `electron-rebuild` not run | [native-module-load-failure.md](./native-module-load-failure.md) |
| Deep link `myapp://` does nothing | Protocol not registered; `open-url` listener after `whenReady`; not packaged on macOS | [deep-link-not-firing.md](./deep-link-not-firing.md) |
| Tray icon appears then disappears immediately | `Tray` instance is function-local (GC'd) | [tray-icon-disappears.md](./tray-icon-disappears.md) |
| macOS notification never shows (no error logged) | App unsigned; `failed` listener not attached before `show()` | [notification-not-displaying.md](./notification-not-displaying.md) |
| `electron-updater` never fires `update-available` | Missing `forceDevUpdateConfig`; server returns 404; `?noCache` not stripped | [electron-updater-not-checking.md](./electron-updater-not-checking.md) |
| Packaged app crashes/fails to launch from `out/` | Missing `asar:true`; `dist/main.js` not built; wrong `main` field | [packaged-app-wont-launch.md](./packaged-app-wont-launch.md) |
| `codesign --verify` fails; Gatekeeper rejects | Wrong certificate; missing entitlements; notarization not stapled | [code-signing-failure.md](./code-signing-failure.md) |
| IPC call rejects with unexpected error shape | Validator throwing raw Error; round-trip serialization loses `.code` field | [ipc-validation-error-shape.md](./ipc-validation-error-shape.md) |

---

## Diagnostic First Steps

When nothing obvious stands out:

1. **Read the log file** — `tail -f "$(dirname $(electron .))/logs/main.log"`. Structured JSON lines tell you which module emitted what event.
2. **Check boot order** — Open `src/main.ts`. Confirm `crashReporter.start()` is line 1, singleInstanceLock before `whenReady`, `open-url` before `whenReady`.
3. **Run static regressions** — `grep -n 'new BrowserWindow(' src/ -r` must only appear in `src/window.ts`.
4. **Check asar contents** — `npx @electron/asar list app.asar | grep '\.ts$'` must return empty.
5. **Verify fuses** — `npx @electron/fuses read --app <App>.app` shows current fuse state.

---

## Troubleshooting Files

| File | Topic |
|---|---|
| [white-screen.md](./white-screen.md) | BrowserWindow shows blank/white on launch |
| [native-module-load-failure.md](./native-module-load-failure.md) | `.node` module fails to load in packaged build |
| [deep-link-not-firing.md](./deep-link-not-firing.md) | Custom URL scheme does nothing |
| [tray-icon-disappears.md](./tray-icon-disappears.md) | Tray icon GC'd after creation |
| [notification-not-displaying.md](./notification-not-displaying.md) | macOS notification never appears |
| [electron-updater-not-checking.md](./electron-updater-not-checking.md) | Auto-update does not check for updates |
| [packaged-app-wont-launch.md](./packaged-app-wont-launch.md) | App crashes or fails immediately after `npm run make` |
| [code-signing-failure.md](./code-signing-failure.md) | Signing, notarization, or Gatekeeper errors |
| [ipc-validation-error-shape.md](./ipc-validation-error-shape.md) | IPC rejection error loses `.code` or `.message` |

Evidence: `../../../05_distillation/playbooks/PB-01` through `PB-10`
