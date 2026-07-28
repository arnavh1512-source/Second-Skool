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

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = src
  })
