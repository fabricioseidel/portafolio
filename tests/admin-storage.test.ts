import { createHash } from 'node:crypto';
import { clearDraft, draftKey, loadDraft, saveDraft } from '@/admin/draft';
import { clearToken, loadToken, saveToken } from '@/admin/session';
import type { PendingFile } from '@/admin/types';
import { MAX_UPLOAD_BYTES, prepareUpload, slugify } from '@/admin/uploads';
import type { SiteInput } from '@/core/schema';

const bytesOf = (data: string | Uint8Array) => (typeof data === 'string' ? Buffer.from(data) : Buffer.from(data));
const sha8 = (data: string | Uint8Array) => createHash('sha256').update(bytesOf(data)).digest('hex').slice(0, 8);
const b64 = (data: string | Uint8Array) => bytesOf(data).toString('base64');
const blocked = () => {
  throw new DOMException('bloqueado', 'SecurityError');
};

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('slugify', () => {
  it.each([
    ['Canción de Ñandú', 'cancion-de-nandu'],
    ['  Mi   foto   final  ', 'mi-foto-final'],
    ['CV (2025) — versión #2!', 'cv-2025-version-2'],
    ['Captura_de_pantalla.2025', 'captura-de-pantalla-2025'],
    ['', 'archivo'],
    ['¿¡…!?', 'archivo'],
  ])('slugify(%j) = %j', (input, out) => expect(slugify(input)).toBe(out));

  it('corta en 40 caracteres sin dejar un guion al final', () => {
    expect(slugify('x'.repeat(60))).toBe('x'.repeat(40));
    expect(slugify(`${'a'.repeat(39)} bcd`)).toBe('a'.repeat(39));
  });
});

describe('prepareUpload: archivos', () => {
  it('sube un PDF tal cual', async () => {
    const content = '%PDF-1.7 currículum';
    const up = await prepareUpload(new File([content], 'CV Ana Prueba.pdf', { type: 'application/pdf' }), 'file');
    const name = `cv-ana-prueba-${sha8(content)}.pdf`;
    expect(up).toEqual({
      path: `public/uploads/${name}`,
      publicPath: `/uploads/${name}`,
      base64: b64(content),
      mime: 'application/pdf',
      size: Buffer.byteLength(content),
      dataUrl: `data:application/pdf;base64,${b64(content)}`,
    });
    expect(up.publicPath).toMatch(/^\/uploads\/cv-ana-prueba-[0-9a-f]{8}\.pdf$/);
  });

  it('codifica en base64 por bloques archivos grandes', async () => {
    const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => (i * 7) % 256);
    const up = await prepareUpload(new File([bytes], 'datos'), 'file');
    expect(up.base64).toBe(b64(bytes));
    expect(up.size).toBe(200_000);
    expect(up.mime).toBe('application/octet-stream');
    expect(up.path).toBe(`public/uploads/datos-${sha8(bytes)}.bin`);
  });

  it('usa Blob.arrayBuffer() cuando existe y conserva la extensión original', async () => {
    const file = new File(['ignorado'], 'Notas.TXT', { type: 'text/plain' });
    const arrayBuffer = vi.fn(async () => new Uint8Array([104, 111, 108, 97]).buffer);
    Object.defineProperty(file, 'arrayBuffer', { value: arrayBuffer });
    const up = await prepareUpload(file, 'file');
    expect(arrayBuffer).toHaveBeenCalled();
    expect(up.base64).toBe(b64('hola'));
    expect(up.path).toBe(`public/uploads/notas-${sha8('hola')}.txt`);
  });

  it('sin crypto.subtle (http en la red local) igual nombra el archivo', async () => {
    vi.stubGlobal('crypto', {});
    const up = await prepareUpload(new File(['hola'], 'a.pdf', { type: 'application/pdf' }), 'file');
    expect(up.path).toBe('public/uploads/a-b2c65197.pdf');
  });

  it('rechaza archivos de más de 8 MB', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: MAX_UPLOAD_BYTES + 1 });
    await expect(prepareUpload(file, 'image')).rejects.toThrow('El archivo pesa más de 8 MB.');
    await expect(prepareUpload(file, 'file')).rejects.toThrow('El archivo pesa más de 8 MB.');
  });

  it('rechaza lo que no es imagen cuando se pide una', async () => {
    const file = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    await expect(prepareUpload(file, 'image')).rejects.toThrow('El archivo no es una imagen.');
    await expect(prepareUpload(new File(['x'], 'notas.txt'), 'image')).rejects.toThrow('El archivo no es una imagen.');
  });
});

/** Simula createImageBitmap y OffscreenCanvas. `encodes`: tipos que el "navegador" sabe codificar. */
function stubImages({ width, height, encodes = ['image/webp', 'image/jpeg', 'image/png'], alpha = false }: {
  width: number;
  height: number;
  encodes?: string[];
  alpha?: boolean;
}) {
  const bitmap = { width, height, close: vi.fn() };
  const createImageBitmap = vi.fn(async () => bitmap);
  const canvases: FakeCanvas[] = [];
  class FakeCanvas {
    requests: { type?: string; quality?: number }[] = [];
    ctx = {
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4).fill(alpha ? 0 : 255),
      })),
    };
    constructor(
      readonly width: number,
      readonly height: number,
    ) {
      canvases.push(this);
    }
    getContext() {
      return this.ctx;
    }
    async convertToBlob(opts: { type?: string; quality?: number }) {
      this.requests.push(opts);
      const type = opts.type && encodes.includes(opts.type) ? opts.type : 'image/png';
      return new Blob([`${type}|${opts.quality}`], { type });
    }
  }
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
  return { bitmap, createImageBitmap, canvases };
}

describe('prepareUpload: imágenes', () => {
  const png = () => new File(['png'], 'Foto Perfil.png', { type: 'image/png' });

  it('reduce las imágenes anchas a 1600 px y las pasa a WebP', async () => {
    const { bitmap, createImageBitmap, canvases } = stubImages({ width: 3200, height: 2000 });
    const file = png();
    const up = await prepareUpload(file, 'image');
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    const [canvas] = canvases;
    expect([canvas.width, canvas.height]).toEqual([1600, 1000]);
    expect(canvas.ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1000);
    expect(canvas.ctx.imageSmoothingQuality).toBe('high');
    expect(canvas.requests).toEqual([{ type: 'image/webp', quality: 0.82 }]);
    expect(bitmap.close).toHaveBeenCalled();
    const encoded = 'image/webp|0.82';
    expect(up).toMatchObject({
      path: `public/uploads/foto-perfil-${sha8(encoded)}.webp`,
      mime: 'image/webp',
      size: encoded.length,
      base64: b64(encoded),
      dataUrl: `data:image/webp;base64,${b64(encoded)}`,
    });
  });

  it('no agranda imágenes pequeñas y respeta las opciones', async () => {
    const { canvases } = stubImages({ width: 800, height: 600 });
    await prepareUpload(png(), 'image', { quality: 0.5 });
    await prepareUpload(png(), 'image', { maxWidth: 400 });
    expect(canvases.map((c) => [c.width, c.height])).toEqual([
      [800, 600],
      [400, 300],
    ]);
    expect(canvases[0].requests).toEqual([{ type: 'image/webp', quality: 0.5 }]);
  });

  it('sin WebP (Safari) usa JPEG 0,85', async () => {
    const { canvases } = stubImages({ width: 1200, height: 900, encodes: ['image/jpeg', 'image/png'] });
    const up = await prepareUpload(new File(['jpg'], 'retrato.jpg', { type: 'image/jpeg' }), 'image');
    expect(canvases[0].requests).toEqual([
      { type: 'image/webp', quality: 0.82 },
      { type: 'image/jpeg', quality: 0.85 },
    ]);
    expect(canvases[0].ctx.getImageData).not.toHaveBeenCalled();
    expect(up.mime).toBe('image/jpeg');
    expect(up.path).toMatch(/^public\/uploads\/retrato-[0-9a-f]{8}\.jpg$/);
  });

  it('sin WebP conserva en PNG las imágenes con transparencias', async () => {
    const { canvases } = stubImages({ width: 600, height: 600, encodes: ['image/jpeg', 'image/png'], alpha: true });
    const up = await prepareUpload(new File(['png'], 'logo.png', { type: 'image/png' }), 'image');
    expect(canvases[0].requests).toEqual([{ type: 'image/webp', quality: 0.82 }]);
    expect(up.mime).toBe('image/png');
    expect(up.path).toMatch(/^public\/uploads\/logo-[0-9a-f]{8}\.png$/);
  });

  it('sin WebP pasa a JPEG los PNG opacos', async () => {
    stubImages({ width: 600, height: 600, encodes: ['image/jpeg', 'image/png'] });
    const up = await prepareUpload(png(), 'image');
    expect(up.mime).toBe('image/jpeg');
  });

  it('sin createImageBitmap decodifica con <img> y libera la URL', async () => {
    const { canvases } = stubImages({ width: 1, height: 1 });
    vi.stubGlobal('createImageBitmap', undefined);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: () => 'blob:foto', revokeObjectURL }));
    class FakeImage {
      src = '';
      naturalWidth = 2000;
      naturalHeight = 1000;
      decode = vi.fn(async () => {});
    }
    vi.stubGlobal('Image', FakeImage);
    const up = await prepareUpload(png(), 'image');
    expect([canvases[0].width, canvases[0].height]).toEqual([1600, 800]);
    expect(canvases[0].ctx.drawImage.mock.calls[0][0]).toMatchObject({ src: 'blob:foto' });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:foto');
    expect(up.mime).toBe('image/webp');
  });

  it('avisa si la imagen no se puede leer', async () => {
    const { createImageBitmap } = stubImages({ width: 1, height: 1 });
    createImageBitmap.mockRejectedValue(new DOMException('corrupta', 'InvalidStateError'));
    await expect(prepareUpload(png(), 'image')).rejects.toThrow('No se pudo leer la imagen.');
  });

  it('sube SVG y GIF tal cual, sin reescalar', async () => {
    const { createImageBitmap } = stubImages({ width: 10, height: 10 });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
    const up = await prepareUpload(new File([svg], 'Logo Final.SVG', { type: 'image/svg+xml' }), 'image');
    expect(up).toMatchObject({
      path: `public/uploads/logo-final-${sha8(svg)}.svg`,
      publicPath: `/uploads/logo-final-${sha8(svg)}.svg`,
      mime: 'image/svg+xml',
      size: svg.length,
      dataUrl: `data:image/svg+xml;base64,${b64(svg)}`,
    });
    expect(atob(up.base64)).toBe(svg);
    const gif = await prepareUpload(new File(['GIF89a'], 'anim.gif', { type: 'image/gif' }), 'image');
    expect(gif.path).toBe(`public/uploads/anim-${sha8('GIF89a')}.gif`);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('deduce el tipo por la extensión si el navegador no lo informa', async () => {
    const up = await prepareUpload(new File(['<svg/>'], 'icono.svg'), 'image');
    expect(up.mime).toBe('image/svg+xml');
    expect(up.path).toMatch(/\.svg$/);
  });
});

describe('sesión', () => {
  const KEY = 'portafolio:gh-token';

  it('sin "recordar" el token vive solo en la pestaña', () => {
    saveToken('  ghp_uno\n', false);
    expect(sessionStorage.getItem(KEY)).toBe('ghp_uno');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(loadToken()).toEqual({ token: 'ghp_uno', remembered: false });
  });

  it('con "recordar" sobrevive al cierre de la pestaña', () => {
    saveToken('ghp_dos', true);
    expect(loadToken()).toEqual({ token: 'ghp_dos', remembered: true });
    sessionStorage.clear();
    expect(loadToken()).toEqual({ token: 'ghp_dos', remembered: true });
  });

  it('dejar de recordar borra la copia del navegador', () => {
    saveToken('ghp_dos', true);
    saveToken('ghp_tres', false);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(loadToken()).toEqual({ token: 'ghp_tres', remembered: false });
  });

  it('clearToken y un token vacío borran ambos', () => {
    saveToken('ghp_cuatro', true);
    clearToken();
    expect(loadToken()).toBeNull();
    saveToken('ghp_cinco', true);
    saveToken('   ', true);
    expect(loadToken()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('no falla con el almacenamiento bloqueado', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    expect(() => saveToken('ghp_seis', true)).not.toThrow();
    expect(loadToken()).toBeNull();
    expect(() => clearToken()).not.toThrow();
  });
});

describe('borrador', () => {
  const repo = 'usuario/portafolio@main';
  const site: SiteInput = {
    meta: { title: 'Portafolio', description: { es: 'Hola', en: 'Hi' } },
    brand: { name: 'Ana' },
    sections: [{ type: 'hero', id: 'inicio', headline: ['Hola'] }],
  };
  const file: PendingFile = {
    path: 'public/uploads/foto-1a2b3c4d.webp',
    publicPath: '/uploads/foto-1a2b3c4d.webp',
    base64: 'UklGRg==',
    mime: 'image/webp',
    size: 4,
    dataUrl: 'data:image/webp;base64,UklGRg==',
  };
  const files = { [file.publicPath]: file };

  it('ida y vuelta', () => {
    expect(draftKey(repo)).toBe('portafolio:draft:usuario/portafolio@main');
    expect(saveDraft(repo, { site, files, baseHeadSha: 'abc123' }, 1700)).toEqual({ ok: true });
    expect(loadDraft(repo)).toEqual({ site, files, baseHeadSha: 'abc123', savedAt: 1700 });
    expect(loadDraft('otra/cuenta@main')).toBeNull();
    clearDraft(repo);
    expect(loadDraft(repo)).toBeNull();
  });

  it('usa la hora actual y no guarda la vista previa duplicada', () => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
    saveDraft(repo, { site, files, baseHeadSha: null });
    expect(localStorage.getItem(draftKey(repo))).not.toContain('data:');
    expect(loadDraft(repo)).toMatchObject({ savedAt: 42, baseHeadSha: null, files });
  });

  it('sin espacio guarda el contenido sin los archivos', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('lleno', 'QuotaExceededError');
    });
    expect(saveDraft(repo, { site, files, baseHeadSha: 'abc123' }, 5)).toEqual({ ok: true, withoutFiles: true });
    expect(loadDraft(repo)).toEqual({ site, files: {}, baseHeadSha: 'abc123', savedAt: 5 });
  });

  it('avisa cuando no pudo guardar nada', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    expect(saveDraft(repo, { site, files, baseHeadSha: null })).toEqual({ ok: false });
    expect(() => clearDraft(repo)).not.toThrow();
  });

  it('descarta borradores corruptos o con otra forma', () => {
    const put = (raw: string) => localStorage.setItem(draftKey(repo), raw);
    put('{no es json');
    expect(loadDraft(repo)).toBeNull();
    put(JSON.stringify({ site: { sections: 'x' }, files: {} }));
    expect(loadDraft(repo)).toBeNull();
    put(JSON.stringify({ site, files: [] }));
    expect(loadDraft(repo)).toBeNull();
    put(JSON.stringify([site]));
    expect(loadDraft(repo)).toBeNull();
  });

  it('ignora archivos dañados dentro de un borrador válido', () => {
    localStorage.setItem(draftKey(repo), JSON.stringify({ site, files: { ...files, '/uploads/roto.png': { path: 1 } }, savedAt: 9 }));
    expect(loadDraft(repo)).toEqual({ site, files, baseHeadSha: null, savedAt: 9 });
  });
});
