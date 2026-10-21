import type { PendingFile } from '@/admin/types';

/**
 * Prepara en el navegador los archivos que el panel sube al repositorio: valida, optimiza las
 * imágenes y les da un nombre estable a partir de su contenido.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Imágenes que se reescalan y recomprimen. SVG, GIF y el resto se suben tal cual. */
const RASTER = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp']);

const EXT_BY_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

/** Para cuando el navegador no informa el tipo del archivo. */
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

/** Safari en iOS no dibuja canvas de más de ~16,7 megapíxeles. */
const MAX_PIXELS = 16_000_000;

const EXTENSION = /\.([a-z0-9]{1,10})$/i;

export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .slice(0, 40)
    .replace(/-$/, '');
  return slug || 'archivo';
}

export async function prepareUpload(
  file: File,
  kind: 'image' | 'file',
  opts: { maxWidth?: number; quality?: number } = {},
): Promise<PendingFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('El archivo pesa más de 8 MB.');
  const ext = EXTENSION.exec(file.name)?.[1].toLowerCase() ?? '';
  const type = (file.type || MIME_BY_EXT[ext] || 'application/octet-stream').toLowerCase();

  let blob: Blob = file;
  let mime = type;
  if (kind === 'image') {
    if (!type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
    if (RASTER.has(type)) {
      blob = await optimize(file, type, opts.maxWidth ?? 1600, opts.quality ?? 0.82);
      mime = blob.type;
    }
  }

  const bytes = await readBytes(blob);
  const name = `${slugify(file.name.replace(EXTENSION, ''))}-${await hash8(bytes)}.${EXT_BY_MIME[mime] ?? (ext || 'bin')}`;
  const base64 = toBase64(bytes);
  return {
    path: `public/uploads/${name}`,
    publicPath: `/uploads/${name}`,
    base64,
    mime,
    size: bytes.length,
    dataUrl: `data:${mime};base64,${base64}`,
  };
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };
type Ctx = CanvasDrawImage & CanvasImageData & CanvasImageSmoothing;
type Canvas = { ctx: Ctx; encode: (type: string, quality?: number) => Promise<Blob> };

async function optimize(file: File, type: string, maxWidth: number, quality: number): Promise<Blob> {
  const image = await decode(file);
  try {
    const scale = Math.min(1, maxWidth / image.width, Math.sqrt(MAX_PIXELS / (image.width * image.height)));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = createCanvas(width, height);
    canvas.ctx.imageSmoothingQuality = 'high';
    canvas.ctx.drawImage(image.source, 0, 0, width, height);

    const webp = await canvas.encode('image/webp', quality);
    if (webp.type === 'image/webp') return webp;
    // Safari no codifica WebP y entrega PNG. Se usa JPEG salvo que haya transparencias, que JPEG pintaría de negro.
    if (type !== 'image/jpeg' && hasAlpha(canvas.ctx, width, height)) {
      return webp.type === 'image/png' ? webp : await canvas.encode('image/png');
    }
    return await canvas.encode('image/jpeg', 0.85);
  } catch {
    throw new Error('No se pudo procesar la imagen.');
  } finally {
    image.release();
  }
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Opción o formato no soportado por createImageBitmap: se intenta con <img>.
    }
  }
  let url = '';
  try {
    url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    if (url) URL.revokeObjectURL(url);
    throw new Error('No se pudo leer la imagen.');
  }
}

function createCanvas(width: number, height: number): Canvas {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) return { ctx, encode: (type, quality) => canvas.convertToBlob({ type, quality }) };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible.');
  return {
    ctx,
    encode: (type, quality) =>
      new Promise((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo codificar la imagen.'))), type, quality),
      ),
  };
}

/** Recorre la imagen por franjas para no reservar de golpe la memoria de todos los píxeles. */
function hasAlpha(ctx: Ctx, width: number, height: number): boolean {
  try {
    for (let y = 0; y < height; y += 256) {
      const { data } = ctx.getImageData(0, y, width, Math.min(256, height - y));
      for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return true;
  }
}

async function readBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  try {
    if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
    // jsdom y navegadores antiguos no tienen Blob.arrayBuffer().
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  } catch {
    throw new Error('No se pudo leer el archivo.');
  }
}

/** Primeros 8 caracteres hex del SHA-256 del contenido. */
async function hash8(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = new Uint8Array(await subtle.digest('SHA-256', bytes), 0, 4);
    return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fuera de un contexto seguro (http en la red local) no existe crypto.subtle: FNV-1a basta para nombrar el archivo.
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // Por bloques: String.fromCharCode(...bytes) con varios MB revienta la pila.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
