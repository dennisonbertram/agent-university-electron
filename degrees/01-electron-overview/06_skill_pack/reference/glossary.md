# Glossary

Key terms used throughout this skill pack.

Back to [../index.md](../index.md) | [api-cheatsheet.md](./api-cheatsheet.md)

---

## A

**ABI (Application Binary Interface)**
The numeric version identifier that determines whether a compiled `.node` native module can be loaded by a given Node.js runtime. Different Node.js and Electron versions have different ABI numbers. See [electron-version-compatibility.md](./electron-version-compatibility.md).

**asar**
Electron Archive format. A single-file archive (like a zip) that bundles your app's source files. Required for security fuses `OnlyLoadAppFromAsar` and `EnableEmbeddedAsarIntegrityValidation`. Native `.node` files must be excluded (unpacked) via `AutoUnpackNativesPlugin`.

**Atomic Write-Rename**
A crash-safe file write pattern: write to a `.tmp` file, then rename it atomically to the target. If the process crashes mid-write, the original file is intact. See [../recipes/recipe-atomic-json-write.md](../recipes/recipe-atomic-json-write.md).

**autoUpdater / electron-updater**
The update mechanism for Electron apps. `electron-updater` is the more full-featured third-party package (recommended over the built-in `autoUpdater`). Requires a server serving update manifests (`.yml` files). See [../lessons/10-auto-update.md](../lessons/10-auto-update.md).

---

## B

**better-sqlite3**
A synchronous SQLite3 binding for Node.js. Popular in Electron apps for local data storage. Requires `electron-rebuild` and `AutoUnpackNativesPlugin` in Forge. See [../recipes/recipe-better-sqlite3-with-auto-unpack.md](../recipes/recipe-better-sqlite3-with-auto-unpack.md).

**BrowserWindow**
The main window type in Electron. Each BrowserWindow runs a separate renderer process. Must always be created through a secure factory function with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.

---

## C

**contextBridge**
The safe API for exposing functionality from the preload script to the renderer. Used to expose named async functions that call `ipcRenderer.invoke`. **Never** expose `ipcRenderer` or `require` directly.

**contextIsolation**
A BrowserWindow security flag. When `true`, the preload script and renderer script run in separate JavaScript contexts (separate `window` objects). This prevents renderer code from modifying the preload's scope. Required: always set to `true`.

**crashReporter**
Electron's built-in crash reporting module. Must be started with `crashReporter.start()` before `app.whenReady()` to capture early boot crashes.

**CSP (Content Security Policy)**
An HTTP header or HTML meta tag that restricts what resources a page can load. In Electron, specified as a meta tag in every HTML file. Must exclude `unsafe-inline` and `unsafe-eval` from `script-src`.

---

## D

**deep link**
A custom URL scheme (e.g., `myapp://action/foo`) that opens and sends data to your app. On macOS, handled via the `open-url` event. On Windows/Linux, handled via `second-instance` event. Requires `setAsDefaultProtocolClient` before `whenReady`, and packaging on macOS for OS routing.

**Developer ID Application**
The macOS code-signing certificate required for distributing apps outside the Mac App Store. Required for Gatekeeper acceptance. Different from "Apple Development" certificate (dev only).

---

## E

**electron-rebuild**
A tool (`@electron/rebuild`) that recompiles native Node.js modules (`.node` files) against the Electron-bundled Node.js ABI. Must run after `npm install` whenever native modules are present.

**Entitlements**
macOS permissions declared in a plist file and embedded in the code signature. The minimum required for Electron are `allow-jit` and `disable-library-validation`. See [entitlements-reference.md](./entitlements-reference.md).

---

## F

**Fuses**
Binary-level hardening flags baked into the Electron binary at packaging time by `@electron/fuses`. Six fuses must be set for production: `RunAsNode:false`, `EnableCookieEncryption:true`, `EnableNodeOptionsEnvironmentVariable:false`, `EnableNodeCliInspectArguments:false`, `EnableEmbeddedAsarIntegrityValidation:true`, `OnlyLoadAppFromAsar:true`. See [fuses-reference.md](./fuses-reference.md).

**forceDevUpdateConfig**
An `electron-updater` property that enables update checking in development mode. Not in the TypeScript type; must be set via `(autoUpdater as any).forceDevUpdateConfig = true`.

---

## G

**Gatekeeper**
macOS security mechanism that verifies apps are signed and notarized before allowing them to run. Controlled by `spctl`. Apps must be signed with Developer ID and notarized to pass.

---

## H

**Hardened Runtime**
A macOS code-signing mode that restricts certain dangerous capabilities (JIT compilation, dynamic library loading). Required for notarization. Enabled via `hardenedRuntime: true` in `osxSign`. Requires entitlements for capabilities Electron needs.

---

## I

**IPC (Inter-Process Communication)**
The mechanism for communication between main and renderer processes. Electron provides `ipcMain` (main side) and `ipcRenderer` (renderer/preload side). In this skill pack, all IPC is centralized in a registry with per-channel validators.

**IpcValidationError**
A custom error class thrown by IPC validators on invalid input. Its `code` field does NOT survive Electron's IPC serialization — only `message` does. See [../troubleshooting/ipc-validation-error-shape.md](../troubleshooting/ipc-validation-error-shape.md).

---

## J

**JSON Lines (JSONL)**
A log format where each line is a complete, valid JSON object. Parseable line-by-line. Used for structured logging in this skill pack. See [log-format.md](./log-format.md).

---

## M

**Main Process**
The Node.js process that is the entry point of an Electron app. Has access to all Electron APIs and Node.js APIs. Runs `main.ts`. There is exactly one main process per Electron app.

**Module-Scope Variable**
A variable declared at the top level of a JavaScript/TypeScript module (not inside a function). V8's garbage collector cannot collect module-scope variables as long as the module is imported. Critical for the `Tray` instance.

---

## N

**Native Module**
A Node.js module that contains compiled C/C++ code (`.node` binary file). Must be rebuilt for the target Electron ABI using `electron-rebuild`. Must be unpacked from asar. Example: `better-sqlite3`.

**nodeIntegration**
A BrowserWindow option that, when `true`, gives the renderer direct access to Node.js APIs. Must always be `false` for security. Use IPC instead.

**Notarization**
Apple's automated security scan for macOS apps. After signing, the app `.dmg` or `.pkg` is submitted to Apple's notarization service. Upon approval, a ticket is stapled to the app. Required for Gatekeeper acceptance outside the Mac App Store.

---

## P

**PBKDF2**
Password-Based Key Derivation Function 2. A standard for deriving a cryptographic key from a passphrase. Used in this skill pack with 100,000 iterations and a random salt for passphrase storage. See [../recipes/recipe-pbkdf2-passphrase.md](../recipes/recipe-pbkdf2-passphrase.md).

**Preload Script**
A script that runs in a sandboxed context before the renderer. Has access to both Electron APIs (`contextBridge`, `ipcRenderer`) and the DOM. The only safe bridge between main and renderer. Specified in `webPreferences.preload`.

---

## R

**Renderer Process**
The Chromium web page process. Each `BrowserWindow` runs one renderer. Has access to DOM APIs and (via `contextBridge`) to the `window.api` object. Has NO direct access to Node.js or Electron APIs.

---

## S

**safeStorage**
Electron API that encrypts/decrypts strings using the OS keychain (macOS Keychain, Windows DPAPI, Linux libsecret). Scoped to the app's bundle ID. See [../recipes/recipe-safestorage-encryption.md](../recipes/recipe-safestorage-encryption.md).

**sandbox**
A BrowserWindow security flag. When `true`, the renderer process is run in Chromium's sandbox with minimal OS privileges. Required for security; always set to `true`.

**Single Instance Lock**
`app.requestSingleInstanceLock()` ensures only one instance of the app runs at a time. Must be called before `app.whenReady()`. If the lock fails, the app quits. The `second-instance` event fires on the primary instance when a second is launched.

**Structured Clone Algorithm**
The serialization mechanism used by Electron's IPC. Handles most JavaScript types but strips custom class properties. `Error` objects survive with only `message` preserved.

---

## T

**Template Image**
A macOS tray icon convention. Images with filenames ending in `Template` (e.g., `icon-Template.png`) are treated as template images by macOS: automatically inverted for dark/light mode. Do NOT hash/rename these files.

**Test Seam**
An IPC channel (`test:*`) registered only when `testHooksEnabled()` is true. Used to trigger OS events (power, deep links, shortcuts) from Playwright tests without OS interaction. Same validation pattern as production channels. See [../recipes/recipe-test-seam-ipc-channel.md](../recipes/recipe-test-seam-ipc-channel.md).

**timingSafeEqual**
`crypto.timingSafeEqual(a, b)` — a constant-time comparison function that prevents timing attacks on passphrase verification. Always use instead of `===` for secret comparison.

**Two-ABI Problem**
The situation where native modules built for system Node.js (e.g., ABI 137) cannot be used in Electron (e.g., ABI 146) and vice versa. Solved by maintaining two separate rebuilt binaries or using IPC seams.

---

## V

**V8 Memory Cage**
An Electron 32+ security feature that prevents unsafe `ArrayBuffer` sharing between the main and renderer processes. Requires `better-sqlite3 >= 11.1.2`.

---

## W

**WAL (Write-Ahead Logging)**
A SQLite journaling mode (`PRAGMA journal_mode=WAL`) that improves concurrent read performance and crash recovery. Recommended for Electron apps using SQLite.

**webSecurity**
A BrowserWindow option. When `true` (the default), enforces same-origin policy. Must never be set to `false` in production.

**whenReady**
`app.whenReady()` — a Promise that resolves when Electron is initialized and ready to create windows. Most setup code (window creation, tray creation, IPC registration) goes inside `.then()`. Some critical setup (crashReporter, singleInstanceLock, protocol registration) must happen BEFORE it.

Evidence: `../../../05_distillation/distilled-principles.md`, `../../../05_distillation/before-you-build.md`
