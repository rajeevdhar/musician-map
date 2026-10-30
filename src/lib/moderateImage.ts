// Client-side image moderation using NSFW.js (free, no API key, runs in-browser)
// Model loads lazily on first call (~25MB, cached after first load).
// Returns { flagged: boolean, reason?: string }

import { load, NSFWJS } from 'nsfwjs'

let model: NSFWJS | null = null

async function getModel() {
  if (!model) {
    model = await load()
  }
  return model
}

export async function moderateImage(
  source: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement,
): Promise<{ flagged: boolean; reason?: string }> {
  try {
    const m = await getModel()
    const predictions = await m.classify(source as HTMLImageElement)
    const porn = predictions.find(p => p.className === 'Porn')?.probability ?? 0
    const hentai = predictions.find(p => p.className === 'Hentai')?.probability ?? 0
    const sexy = predictions.find(p => p.className === 'Sexy')?.probability ?? 0

    if (porn > 0.6) return { flagged: true, reason: 'explicit content' }
    if (hentai > 0.7) return { flagged: true, reason: 'explicit content' }
    if (sexy > 0.85) return { flagged: true, reason: 'explicit content' }
    return { flagged: false }
  } catch {
    return { flagged: false }
  }
}

// Loads an image blob into an HTMLImageElement for classification
export function blobToImg(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load failed')) }
    img.src = url
  })
}
