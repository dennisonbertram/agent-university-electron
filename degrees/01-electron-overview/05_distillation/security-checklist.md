# Security Checklist — Electron App

Every item must be verified before shipping. Each has a `verify` method.

---

## BrowserWindow defaults

1. **`contextIsolation: true`** — verify by source-inspecting every BrowserWindow constructor for the literal flag (evidence: `01_research/05-security-model.md` lines 6-20).
2. **`sandbox: true`** — verify same as above. Static check is the only reliable assert; runtime probes only catch the active window (evidence: `01_research/02-three-process-model.md` lines 86-95).
3. **`nodeIntegration: false`** — static-source check. Renderer is a Chromium tab without Node access (evidence: `01_research/05-security-model.md` lines 217-220).
4. **`webSecurity: true`** — static-source check. Disabling kills same-origin policy (evidence: `01_research/05-security-model.md` lines 178-180).
5. **Every BrowserWindow goes through one `createMainWindow()` factory** — static check for `new BrowserWindow(` outside the factory file (evidence: `03_pocs/L2-secure-ipc/poc-report.md` §5 invariant 2).

## Content Security Policy

6. **Strict CSP meta tag (no `unsafe-inline`, no `unsafe-eval` in script-src)** — runtime probe: load DevTools and trigger inline `<script>`; verify CSP violation in console (evidence: `01_research/05-security-model.md` lines 46-73; `03_pocs/L2-secure-ipc/poc-report.md` §5 invariant 3).
7. **No remote content (HTTPS) loaded into the main BrowserWindow** — source inspection: only `loadFile()` from `__dirname` (evidence: `01_research/05-security-model.md` line 24).

## Navigation guards

8. **`will-navigate` blocks non-`file://` navigation** — runtime test: attempt navigation to `https://example.com`; assert the `security:navigation:blocked` log marker fires (evidence: `01_research/05-security-model.md` lines 75-94; `03_pocs/L2-secure-ipc/src/security.ts`).
9. **`setWindowOpenHandler` returns `{ action: 'deny' }`** — runtime test: trigger a `window.open()` from renderer; verify no new window and the security log fires (evidence: `01_research/05-security-model.md` lines 96-108).
10. **`will-redirect` guard parallel to `will-navigate`** — static source check + runtime test for `Refresh` HTTP redirects (evidence: `03_pocs/L2-secure-ipc/src/security.ts`; `01_research/05-security-model.md` line 78).

## IPC

11. **Every IPC channel is in `IPC_REGISTRY` with a validator** — static check for `ipcMain.handle(` outside the registry registration site (evidence: `03_pocs/L2-secure-ipc/poc-report.md` §5 invariant 1; `01_research/04-ipc-patterns.md` lines 200-218).
12. **Validators emit `ipc:<ch>:validation-failed` on rejection** — runtime test: send invalid arg; grep log for the marker (evidence: `03_pocs/L2-secure-ipc/src/ipc.ts`).
13. **`ipcRenderer` is NEVER exposed via contextBridge directly** — static check: `contextBridge.exposeInMainWorld` value is an object with named function wrappers only (evidence: `01_research/05-security-model.md` lines 144-154; `01_research/04-ipc-patterns.md` line 102).
14. **No `ipcRenderer.sendSync` calls** — static grep (evidence: `01_research/04-ipc-patterns.md` lines 129-141).
15. **IPC sender validation for sensitive channels** — runtime test: send from non-`file://` frame; assert rejection (evidence: `01_research/05-security-model.md` lines 182-203).

## Permission handler

16. **`session.setPermissionRequestHandler` denies by default** — runtime test: request the camera permission; assert `false` (evidence: `01_research/05-security-model.md` lines 110-130; `03_pocs/L2-secure-ipc/src/security.ts`).

## Fuses (packaged builds only)

17. **`RunAsNode: false`** — static-source check on `forge.config.ts`; runtime probe via `codesign --display --verbose=4 <App>.app` looking for the fuse bytes (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:227`).
18. **`EnableNodeOptionsEnvironmentVariable: false`** — static-source check (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:229`).
19. **`EnableNodeCliInspectArguments: false`** — static-source check (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:230`).
20. **`EnableCookieEncryption: true`** — static-source check (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:228`).
21. **`OnlyLoadAppFromAsar: true`** + **`EnableEmbeddedAsarIntegrityValidation: true`** — static-source check (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:231-232`).

## Code signing & notarization

22. **`osxSign` is conditional on `APPLE_ID` env var** — static-source check + runtime test: run package without creds; assert `simulated-signing.md` is generated + `packaging:signing:skipped:no-credentials` log marker fires (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:198-213`; `03_pocs/L5-packaging-signing-update/poc-report.md` R-L5-4).
23. **`osxNotarize` is conditional on same env triplet** — same as above (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:207-211`).
24. **`entitlements.mac.plist` contains `com.apple.security.cs.disable-library-validation` and `com.apple.security.cs.allow-jit`** — static-source check (evidence: `03_pocs/L5-packaging-signing-update/poc-report.md` BT-L5-9 row).

## Test-seam hygiene

25. **All `test:*` IPC channels are gated by `NODE_ENV === 'test'` OR a named flag env var** — static check that the registration site checks `testHooksEnabled()` (evidence: `04_logs/decision-log.md#decision-10`; `03_pocs/L-capstone-pulse/poc-report.md` §"Invariants" 6).
