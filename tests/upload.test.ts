import { describe, it, expect } from 'vitest'
import { validateNoteFile, MAX_BYTES, NOTE_MIME_EXT } from '../app/lib/upload'

describe('validateNoteFile', () => {
  it('accepts each allowed MIME type and derives the extension from MIME, not filename', () => {
    expect(validateNoteFile({ size: 1000, type: 'application/pdf' })).toEqual({ ext: 'pdf' })
    expect(validateNoteFile({ size: 1000, type: 'image/png' })).toEqual({ ext: 'png' })
    expect(validateNoteFile({ size: 1000, type: 'image/jpeg' })).toEqual({ ext: 'jpg' })
    expect(validateNoteFile({ size: 1000, type: 'image/webp' })).toEqual({ ext: 'webp' })
  })

  it('rejects disallowed MIME types (no executables, scripts, videos)', () => {
    for (const type of ['video/mp4', 'text/html', 'application/x-msdownload', 'image/svg+xml', 'application/javascript', '']) {
      expect(validateNoteFile({ size: 1000, type })).toEqual({ error: 'Only PDF or image files' })
    }
  })

  it('rejects files over the size cap (boundary-exact)', () => {
    expect(validateNoteFile({ size: MAX_BYTES + 1, type: 'application/pdf' })).toEqual({ error: 'File too large (max 10 MB)' })
    expect(validateNoteFile({ size: MAX_BYTES, type: 'application/pdf' })).toEqual({ ext: 'pdf' }) // exactly at cap is allowed
  })

  it('checks size before MIME (an oversized bad type reports size)', () => {
    expect(validateNoteFile({ size: MAX_BYTES + 1, type: 'video/mp4' })).toEqual({ error: 'File too large (max 10 MB)' })
  })

  it('the extension map never yields a double-dot or script extension', () => {
    for (const ext of Object.values(NOTE_MIME_EXT)) {
      expect(ext).toMatch(/^[a-z0-9]+$/)
    }
  })
})
