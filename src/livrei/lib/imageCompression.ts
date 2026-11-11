/** Longest side, in pixels, of every photo sent to storage. */
export const MAX_PHOTO_SIDE = 1080;
const QUALITY = 0.8;

export interface CompressedPhoto {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

/** Scales (w, h) so the longest side is at most `max`, keeping proportions. Never upscales. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const ratio = max / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/** Resizes a camera/gallery photo to max 1080px and re-encodes it as WebP (JPEG where WebP is unsupported). */
export async function compressPhoto(file: Blob): Promise<CompressedPhoto> {
  const source = await loadBitmap(file);
  const { width, height } = fitWithin(source.width, source.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.drawImage(source, 0, 0, width, height);
  if ('close' in source) source.close();

  let blob = await toBlob(canvas, 'image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg');
  if (!blob) throw new Error('Não foi possível compactar a foto');
  return { blob, url: URL.createObjectURL(blob), width, height };
}
