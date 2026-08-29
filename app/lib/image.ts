// Client-side image processing. Centre logos and support screenshots are both
// stored as data-URLs in the DB (no storage bucket needed for the pilot), so a
// source image is downscaled and re-encoded to keep the payload tiny.

const MAX_SOURCE_BYTES = 5 * 1024 * 1024 // reject > 5MB uploads before decoding
const OUT_SIZE = 256 // final logo edge, px

// What to draw: the output size, and which rectangle of the source fills it.
// Omitting the source rectangle means the whole image.
type Plan = { width: number; height: number; sx?: number; sy?: number; sw?: number; sh?: number }

// Both callers do the same five things — reject a non-image, decode it, draw it
// onto a sized canvas, encode, release the object URL. Only the sizing and the
// encoding differ, so those are what they pass in.
async function render<T>(file: File, plan: (img: HTMLImageElement) => Plan, encode: (canvas: HTMLCanvasElement) => T): Promise<T> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That image is too large — pick one under 5MB')

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const { width, height, sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight } = plan(img)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process that image')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
    return encode(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// A centre logo: centre-cropped to a square and re-encoded as PNG, which is the
// one format here that keeps transparency.
export const fileToLogoDataUrl = (file: File): Promise<string> =>
  render(file, img => {
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    return { width: OUT_SIZE, height: OUT_SIZE, sx: (img.naturalWidth - side) / 2, sy: (img.naturalHeight - side) / 2, sw: side, sh: side }
  }, canvas => canvas.toDataURL('image/png'))

// A support screenshot. Long edge capped and re-encoded as JPEG, which drops
// EXIF (location, device serial) for free and keeps the data URL inside the
// 400,000-character CHECK on support_tickets.shot. Quality steps down rather
// than failing: a phone screenshot of a dense fees table at q0.7 is ~180KB,
// but a tablet screenshot can be twice that, and telling someone their bug
// report is too big is not an acceptable answer.
const SHOT_MAX_EDGE = 1000
const SHOT_MAX_CHARS = 400_000

export const fileToScreenshotDataUrl = (file: File): Promise<string> =>
  render(file, img => {
    const scale = Math.min(1, SHOT_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    return { width: Math.max(1, Math.round(img.naturalWidth * scale)), height: Math.max(1, Math.round(img.naturalHeight * scale)) }
  }, canvas => {
    for (const q of [0.7, 0.5, 0.35]) {
      const out = canvas.toDataURL('image/jpeg', q)
      if (out.length <= SHOT_MAX_CHARS) return out
    }
    throw new Error('That image is too detailed to attach — try cropping it')
  })

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = src
  })
