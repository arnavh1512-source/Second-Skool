// Client-side logo processing. Centre logos are stored as small data-URLs in
// the DB (no storage bucket needed for the pilot), so the source image is
// downscaled to a square and re-encoded to keep the payload tiny.

const MAX_SOURCE_BYTES = 5 * 1024 * 1024 // reject > 5MB uploads before decoding
const OUT_SIZE = 256 // final logo edge, px

// Decode an image File, center-crop to a square, downscale to OUT_SIZE, and
// return a PNG data-URL (PNG keeps logo transparency). Rejects non-images and
// oversized files with a user-friendly message.
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Image is too large — pick one under 5MB')

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2

    const canvas = document.createElement('canvas')
    canvas.width = OUT_SIZE
    canvas.height = OUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process the image')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

// A support screenshot. Long edge capped and re-encoded as JPEG, which drops
// EXIF (location, device serial) for free and keeps the data URL inside the
// 400,000-character CHECK on support_tickets.shot. Quality steps down rather
// than failing: a phone screenshot of a dense fees table at q0.7 is ~180KB,
// but a tablet screenshot can be twice that, and telling someone their bug
// report is too big is not an acceptable answer.
const SHOT_MAX_EDGE = 1000
const SHOT_MAX_CHARS = 400_000

export async function fileToScreenshotDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That image is too large — under 5MB please')

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, SHOT_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process that image')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    for (const q of [0.7, 0.5, 0.35]) {
      const out = canvas.toDataURL('image/jpeg', q)
      if (out.length <= SHOT_MAX_CHARS) return out
    }
    throw new Error('That image is too detailed to attach — try cropping it')
  } finally {
    URL.revokeObjectURL(url)
  }
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = src
  })
