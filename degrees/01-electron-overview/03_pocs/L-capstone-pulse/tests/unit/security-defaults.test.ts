/**
 * Secure-defaults invariant: every BrowserWindow construction goes through
 * createMainWindow and inherits SECURE_WEB_PREFERENCES.
 */
import { describe, it, expect } from 'vitest'
import { SECURE_WEB_PREFERENCES } from '../../src/window'

describe('SECURE_WEB_PREFERENCES', () => {
  it('contextIsolation:true, sandbox:true, nodeIntegration:false, webSecurity:true', () => {
    expect(SECURE_WEB_PREFERENCES.contextIsolation).toBe(true)
    expect(SECURE_WEB_PREFERENCES.sandbox).toBe(true)
    expect(SECURE_WEB_PREFERENCES.nodeIntegration).toBe(false)
    expect(SECURE_WEB_PREFERENCES.webSecurity).toBe(true)
  })
})
