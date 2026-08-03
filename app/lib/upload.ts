import { supabase } from './supabase'

export const MAX_BYTES = 10 * 1024 * 1024 // 10 MB cap — keeps storage + egress costs sane
// MIME allowlist → storage extension. The extension always derives from the
// validated MIME type, never the (attacker-controlled) filename. No videos —
// they're the bandwidth killer; teachers paste a YouTube/Drive link instead.
export const NOTE_MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
}

// Pure guard: returns the storage extension for an allowed file, or an error.
// Split out from the upload so the security boundary is unit-testable.
export function validateNoteFile(file: { size: number; type: string }): { ext?: string; error?: string } {
  if (file.size > MAX_BYTES) return { error: 'File too large (max 10 MB)' }
  const ext = NOTE_MIME_EXT[file.type]
  if (!ext) return { error: 'Only PDF or image files' }
  return { ext }
}

// Uploads a note file to the public 'notes' bucket under a random path and
// returns its public URL. Oversized / non-PDF-or-image files are rejected first.
export async function uploadNoteFile(file: File): Promise<{ url?: string; error?: string }> {
  const { ext, error: bad } = validateNoteFile(file)
  if (bad) return { error: bad }
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('notes').upload(path, file, {
    contentType: file.type, upsert: false,
  })
  if (error) return { error: 'Upload failed — check your connection' }
  return { url: supabase.storage.from('notes').getPublicUrl(path).data.publicUrl }
}
