// Strong, human-readable student codes. Alphabet excludes confusable
// characters (0/O, 1/I/L) so codes are easy to read aloud and hard to guess.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function genStudentCode(): string {
  // Rejection sampling: only accept bytes below the largest multiple of the
  // alphabet size, so every character is uniformly likely (no modulo bias).
  const max = 256 - (256 % CODE_ALPHABET.length)
  let s = ''
  while (s.length < 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    for (const b of bytes) {
      if (b < max && s.length < 8) s += CODE_ALPHABET[b % CODE_ALPHABET.length]
    }
  }
  return `TUT-${s}`
}
