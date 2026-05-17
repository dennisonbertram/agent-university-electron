# G-09 — `packagerConfig.protocols` overrides `extendInfo.CFBundleURLTypes`

**Severity**: medium
**Surface**: Packaging, Info.plist generation
**Discovered in**: L5 BT-L5-3 design (`04_logs/expectation-gap-ledger.md#entry-8`)

## Symptom

You declare a URL scheme in BOTH `packagerConfig.protocols` AND `Info.plist.template`'s `CFBundleURLTypes` array (the latter providing extra keys like `CFBundleTypeRole: Viewer`). The packaged Info.plist's `CFBundleURLTypes` contains ONLY the entries from `protocols`. The template's URL-types declaration — including the `CFBundleTypeRole` you wanted — is silently dropped.

## Root cause

Electron Forge's merge step for `extendInfo` treats `CFBundleURLTypes` as a "primary" key claimed by `protocols`. When both are present, `protocols` wins outright; no key-level merge happens within the array.

## Fix

Two options:

1. **Declare the scheme exclusively via `protocols`** (the ergonomic path) and accept that you cannot specify role / icon / handler metadata. This is what L5 and the capstone do.
2. **Drop `protocols` entirely** and put the FULL `CFBundleURLTypes` array (including scheme list AND role metadata) in `extendInfo`. Then Forge does not generate its own entries.

```typescript
// forge.config.ts — option 1
packagerConfig: {
  protocols: [{ name: 'Pulse', schemes: ['pulse'] }],
  extendInfo: baseExtendInfo, // CFBundleURLTypes here will be dropped
}

// forge.config.ts — option 2
packagerConfig: {
  // NO protocols field
  extendInfo: {
    ...baseExtendInfo,
    CFBundleURLTypes: [{
      CFBundleURLName: 'Pulse',
      CFBundleURLSchemes: ['pulse'],
      CFBundleTypeRole: 'Viewer',
    }],
  },
}
```

## Test that catches a regression

`tests/e2e/packaging.spec.ts > BT-L5-3` (L5) — `plutil -p out/<App>.app/Contents/Info.plist | grep -A 8 CFBundleURLTypes`; assert the expected scheme appears.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-8`
- `03_pocs/L5-packaging-signing-update/forge.config.ts:190-196`
- `03_pocs/L5-packaging-signing-update/poc-report.md` Entry 8
