# Open Questions — Distillation

Items the research / POCs identified but did not definitively answer. Each has a hypothesis and a recommended verification path for a future agent.

(Carried forward from `01_research/23-open-questions.md` and supplemented with capstone-era findings.)

---

## OQ-01 — Notification Actions in Unsigned Dev Builds

**Question**: Can `Notification` with `actions` (buttons) be tested without code signing, or do all notification features require signing?

**Status**: PARTIALLY ANSWERED. L4 BT-L4-3 confirmed that even basic `notification.show()` fails silently on unsigned dev. Action buttons are entirely untestable for OS display on unsigned dev. The handler-invocation path is tested via the `test:trigger-notification-action` IPC seam (BT-C-3 in capstone).

**Open**: How does a signed but unstapled build behave? Does the `failed` event fire with a different error string?

**Verify in**: a future POC with ad-hoc signing (`codesign --sign - app.app`).

---

## OQ-02 — globalShortcut in Sandboxed/MAS Builds

**Status**: NOT VERIFIED. L4 tested unsigned dev (works) and L5 tested unsigned packaged (also works for register, no real key-event test). Behavior in MAS (App Store sandboxed) builds is unverified.

**Verify in**: a MAS-targeted POC if/when one is built.

---

## OQ-03 — Auto-Launch on macOS 13+ Service Management API

**Status**: PARTIALLY ANSWERED. L4 BT-L4-8 confirmed the non-determinism on unsigned dev (G-05). Whether a signed packaged build with `type: 'mainAppService'` round-trips reliably is NOT verified in this degree.

**Verify in**: a signed packaged build on macOS 14+.

---

## OQ-04 — better-sqlite3 Universal Binary Rebuild

**Status**: NOT VERIFIED. BT-L5-4 was marked `@long-running` and SKIPPED. The capstone uses single-arch builds. Universal-binary path with `AutoUnpackNativesPlugin` is documented but not exercised.

**Verify in**: a future capstone run with `npm run make -- --arch=universal`.

---

## OQ-05 — promptTouchID Entitlements for Packaged Hardened Runtime

**Status**: NOT VERIFIED. The capstone uses the env-flag test seam (P-17) because real Touch ID would hang in CI. Real entitlement requirements are documented in research file 15 but not validated against a real packaged build.

**Verify in**: a future signed packaged build with `com.apple.security.cs.disable-library-validation: true`.

---

## OQ-06 — Tray Icon in Dev vs Packaged (Asset Path)

**Status**: PARTIALLY ANSWERED. L4 and capstone generate the template image from an embedded base64 buffer to side-step the `__dirname` problem. Real per-state PNG files would need `app.isPackaged ? process.resourcesPath : __dirname` branching.

**Verify in**: a future POC that ships real PNG variants.

---

## OQ-07 — powerMonitor.querySystemIdleState vs getSystemIdleState

**Status**: ANSWERED. `getSystemIdleState(threshold)` is the synchronous API; `querySystemIdleState` does not exist in Electron 42. The capstone's power service uses `getSystemIdleState`.

---

## OQ-08 — Notification Behavior in Focus/DND Mode on macOS

**Status**: NOT VERIFIED. The capstone uses the IPC seam for action testing; real Focus-filter behavior is untested.

**Verify in**: a manual smoke test on a signed packaged build with Focus mode enabled.

---

## OQ-09 — Electron Forge + Vite Hot Reload in Main

**Status**: NOT TESTED. The degree adopted the hybrid `tsc + esbuild + forge` build (DR-11) and never exercised Vite's HMR path. A future agent who needs HMR will need to verify the restart mechanism + latency.

---

## OQ-10 — safeStorage Cross-Bundle-ID Migration

**Status**: NOT VERIFIED. The capstone uses one bundle ID; migrating data across bundle IDs is an open question. Hypothesis: bundle-ID change breaks decryption; migration requires decrypting with old key + re-encrypting with new key.

**Verify in**: a future POC that changes `appBundleId` and attempts to read existing data.

---

## OQ-11 — Tray.popUpContextMenu Position Behavior

**Status**: DOCUMENTED, NOT VERIFIED IN CODE. The capstone uses the tray's natural macOS positioning. Whether explicit `position` is silently ignored on macOS is documented but not e2e-tested.

---

## OQ-12 — `fs.watch` rename latency tightening (post-L3)

**Status**: ACCEPTED with slack. L3 relaxed the gate from `< 500ms` to `< 1500ms` (G-04). If sub-200ms latency is required, the swap to `@parcel/watcher` is the path. Untested.

---

## OQ-13 — Universal binary with better-sqlite3 patch script

**Status**: NOT TESTED. The patch script (G-13) was written for arm64. The script reads V8 version preprocessors so it should work for x64 too, but the build has not been exercised.

---

## OQ-14 — `LSUIElement: true` in dev vs `app.dock.hide()`

**Status**: CONFIRMED IN PARALLEL. BT-C-10 in the capstone asserts both paths fire (LSUIElement check on the packaged plist + dock.hide log marker for dev). Both are kept as defense in depth.

---

## OQ-15 — Real notarization timing in 2026

**Status**: SIMULATED ONLY. The capstone's `simulated-signing.md` documents the flow ("typically 1-3 minutes in 2026") but no actual notarization ran in this degree (no Apple Dev creds).

**Verify in**: any future degree run with creds set.

## Evidence

- `01_research/23-open-questions.md` (original 11 items)
- `04_logs/expectation-gap-ledger.md` (capstone-era additions OQ-13, OQ-14)
- `03_pocs/L-capstone-pulse/poc-report.md` (which capabilities were and were not exercised against the real OS)
